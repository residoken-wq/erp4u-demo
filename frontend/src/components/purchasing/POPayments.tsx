import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Statistic, Row, Col, Modal, Form, InputNumber, Radio, Input, message, DatePicker, Tag, Alert, Tooltip, Popconfirm, Card } from 'antd';
import { DollarOutlined, PlusOutlined, DeleteOutlined, InfoCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';
import AttachmentUpload from '../common/AttachmentUpload';

interface Props {
    po: any; // Current PO
    onSuccess?: () => void;
}

const POPayments: React.FC<Props> = ({ po, onSuccess }) => {
    const [historyData, setHistoryData] = useState<any>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [amount, setAmount] = useState<number>(0);
    const [type, setType] = useState('PAYMENT');
    const [note, setNote] = useState('');
    const [vatCode, setVatCode] = useState('');
    const [date, setDate] = useState(dayjs());
    const [attachments, setAttachments] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const fetchHistory = async () => {
        if (!po?.id) return;
        setLoading(true);
        try {
            const res = await api.get(`/purchasing/${po.id}/payment-history`);
            setHistoryData(res.data);
        } catch (e) {
            console.error('Error loading payment history:', e);
            try {
                const res = await api.get(`/finance/history/${po.po_code}`);
                setHistoryData({
                    po_id: po.id,
                    po_code: po.po_code,
                    total_amount: Number(po.total_amount || 0),
                    paid_amount: Number(po.paid_amount || 0),
                    history: (res.data || []).map((t: any) => ({
                        ...t,
                        source: 'DIRECT',
                        source_label: 'Trực tiếp',
                        allocated_amount: t.amount
                    }))
                });
            } catch (err) {
                console.error(err);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [po?.id, po?.po_code]);

    const totalAmount = useMemo(() => {
        return Number(historyData?.total_amount ?? po?.total_amount ?? 0);
    }, [historyData, po]);

    const historyList = useMemo(() => {
        return historyData?.history || [];
    }, [historyData]);

    const realTimePaidAmount = useMemo(() => {
        if (historyList.length > 0) {
            return historyList.reduce((sum: number, item: any) => {
                const itemAmt = Number(item.allocated_amount ?? item.amount ?? 0);
                return sum + itemAmt;
            }, 0);
        }
        return Number(po?.paid_amount || 0);
    }, [historyList, po]);

    const remainingAmount = Math.max(0, totalAmount - realTimePaidAmount);

    const openPaymentModal = () => {
        setAmount(remainingAmount > 0 ? remainingAmount : 0);
        setType(realTimePaidAmount === 0 ? 'DEPOSIT' : remainingAmount <= 0 ? 'FINAL' : 'PAYMENT');
        setNote('');
        setVatCode('');
        setDate(dayjs());
        setAttachments([]);
        setIsModalOpen(true);
    };

    const handlePayment = async () => {
        if (amount <= 0) return message.warning('Vui lòng nhập số tiền hợp lệ (> 0)');

        setSubmitting(true);
        try {
            const prefix = type === 'DEPOSIT' ? '[ĐẶT CỌC]' : type === 'FINAL' ? '[TẤT TOÁN]' : '[THANH TOÁN]';
            const finalNote = `${prefix} ${note}`.trim();

            await api.post('/finance/payment/po', {
                poCode: po.po_code,
                amount,
                note: finalNote,
                date: date ? date.format('YYYY-MM-DD') : new Date().toISOString().split('T')[0],
                vatCode: vatCode || undefined,
                attachments: attachments,
                supplier_id: po.supplier?.id,
                partnerName: po.supplier?.name
            });

            message.success('Ghi nhận thanh toán thành công!');
            setIsModalOpen(false);
            fetchHistory();
            if (onSuccess) onSuccess();
        } catch (e: any) {
            console.error(e);
            message.error(e.response?.data?.message || 'Lỗi khi ghi nhận thanh toán');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteTransaction = async (transId: number) => {
        try {
            await api.delete(`/finance/transactions/${transId}`);
            message.success('Đã xóa giao dịch và hoàn lại công nợ');
            fetchHistory();
            if (onSuccess) onSuccess();
        } catch (e: any) {
            message.error(e.response?.data?.message || 'Lỗi khi xóa giao dịch');
        }
    };

    const isPooledParent = po?.type === 'POOLED';
    const isPooledChild = Boolean(po?.parent_po_id || po?.parent_po || historyData?.parent_po);
    const parentPoCode = po?.parent_po?.po_code || historyData?.parent_po?.po_code;

    const columns = [
        {
            title: 'Ngày GD',
            dataIndex: 'date',
            width: 110,
            render: (v: any, r: any) => <span>{dayjs(v || r.created_at).format('DD/MM/YYYY')}</span>
        },
        {
            title: 'Nguồn',
            dataIndex: 'source',
            width: 160,
            render: (v: string, r: any) => {
                if (v === 'POOLED') {
                    return (
                        <Tooltip title={`Thanh toán thực hiện trên PO Gộp ${r.parent_po_code || ''}, được phân bổ tự động sang đơn này`}>
                            <Tag color="purple" style={{ cursor: 'pointer' }}>
                                🔗 PO Gộp: {r.parent_po_code || 'Gộp'}
                            </Tag>
                        </Tooltip>
                    );
                }
                if (v === 'CHILD_PO') {
                    return <Tag color="cyan">Từ PO con: {r.child_po_code}</Tag>;
                }
                return <Tag color="blue">Trực tiếp</Tag>;
            }
        },
        {
            title: 'Số tiền thanh toán',
            dataIndex: 'allocated_amount',
            width: 160,
            align: 'right' as const,
            render: (v: any, r: any) => {
                const isFromPooled = r.source === 'POOLED';
                const displayAmt = isFromPooled ? (r.allocated_amount ?? r.amount) : r.amount;
                return (
                    <div>
                        <b style={{ color: '#cf1322', fontSize: 14 }}>
                            {Number(displayAmt || 0).toLocaleString()} ₫
                        </b>
                        {isFromPooled && r.amount !== displayAmt && (
                            <div style={{ fontSize: 11, color: '#888' }}>
                                (Tổng GD gộp: {Number(r.amount).toLocaleString()} ₫)
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Nội dung / Ghi chú',
            dataIndex: 'description',
            render: (v: string, r: any) => {
                return (
                    <div>
                        <div>{v || r.note || '-'}</div>
                        {r.vat_invoice_code && (
                            <Tag color="green" style={{ marginTop: 4 }}>
                                HĐ VAT: {r.vat_invoice_code}
                            </Tag>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Chứng từ đính kèm',
            dataIndex: 'attachments',
            width: 220,
            render: (files: string[]) => {
                if (!files || files.length === 0) {
                    return <span style={{ color: '#999', fontSize: 12 }}>Không có</span>;
                }
                return (
                    <div style={{ maxWidth: 200 }}>
                        <AttachmentUpload value={files} maxFiles={0} />
                    </div>
                );
            }
        },
        {
            title: '',
            key: 'action',
            width: 50,
            render: (_: any, r: any) => {
                if (r.source === 'POOLED') {
                    return (
                        <Tooltip title="Giao dịch từ PO Gộp. Vui lòng vào PO Gộp để quản lý hoặc xóa nếu cần.">
                            <InfoCircleOutlined style={{ color: '#999' }} />
                        </Tooltip>
                    );
                }
                return (
                    <Popconfirm
                        title="Xác nhận xóa giao dịch thanh toán này?"
                        onConfirm={() => handleDeleteTransaction(r.id)}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                    >
                        <Button danger size="small" type="text" icon={<DeleteOutlined />} />
                    </Popconfirm>
                );
            }
        }
    ];

    return (
        <div style={{ padding: '4px 0' }}>
            {/* ALERT CHO PO GỘP */}
            {isPooledChild && (
                <Alert
                    message={
                        <span>
                            ℹ️ Đơn này đang được <b>gộp mua chung</b> trong đơn PO Gộp{' '}
                            <Tag color="purple" style={{ fontSize: 13, fontWeight: 'bold' }}>
                                {parentPoCode || 'PO Gộp'}
                            </Tag>
                            . Các khoản thanh toán thực hiện trên PO Gộp sẽ tự động phân bổ và hiển thị tại đây.
                        </span>
                    }
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {isPooledParent && (
                <Alert
                    message={
                        <span>
                            ⭐ Đây là <b>PO Gộp (Mua Chung)</b> gồm{' '}
                            <b>{po?.child_pos?.length || historyData?.child_pos?.length || 0} đơn PO con</b>. Khi bạn ghi nhận thanh toán cho PO Gộp này, hệ thống sẽ tự động cập nhật số tiền thanh toán cho tất cả các PO con theo tỷ lệ giá trị đơn.
                        </span>
                    }
                    type="success"
                    showIcon
                    style={{ marginBottom: 16 }}
                />
            )}

            {/* THỐNG KÊ TIỀN */}
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 6, background: '#fafafa' }}>
                        <Statistic
                            title={<span style={{ color: '#666' }}>Tổng tiền đơn hàng (PO)</span>}
                            value={totalAmount}
                            precision={0}
                            suffix="₫"
                            valueStyle={{ fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 6, background: '#f6ffed', borderColor: '#b7eb8f' }}>
                        <Statistic
                            title={<span style={{ color: '#389e0d' }}>Đã thanh toán</span>}
                            value={realTimePaidAmount}
                            precision={0}
                            suffix="₫"
                            valueStyle={{ color: '#52c41a', fontWeight: 'bold' }}
                            prefix={<CheckCircleOutlined />}
                        />
                    </Card>
                </Col>
                <Col xs={24} sm={8}>
                    <Card size="small" style={{ borderRadius: 6, background: remainingAmount > 0 ? '#fff2f0' : '#f6ffed', borderColor: remainingAmount > 0 ? '#ffccc7' : '#b7eb8f' }}>
                        <Statistic
                            title={<span style={{ color: remainingAmount > 0 ? '#cf1322' : '#389e0d' }}>Còn lại cần thanh toán</span>}
                            value={remainingAmount}
                            precision={0}
                            suffix="₫"
                            valueStyle={{ color: remainingAmount > 0 ? '#cf1322' : '#52c41a', fontWeight: 'bold' }}
                        />
                    </Card>
                </Col>
            </Row>

            {/* HEADER VÀ NÚT TẠO THANH TOÁN */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14 }}>
                    <DollarOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                    Lịch sử các lần chi tiền thanh toán ({historyList.length})
                </div>
                <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openPaymentModal}
                    style={{ background: '#1890ff' }}
                >
                    Thêm thanh toán
                </Button>
            </div>

            {/* BẢNG LỊCH SỬ */}
            <Table
                dataSource={historyList}
                columns={columns}
                rowKey="id"
                loading={loading}
                pagination={false}
                size="small"
                locale={{ emptyText: 'Chưa có khoản thanh toán nào được ghi nhận cho đơn này' }}
                style={{ marginBottom: 16 }}
            />

            {/* MODAL THÊM THANH TOÁN */}
            <Modal
                title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <DollarOutlined style={{ color: '#1890ff' }} />
                        <span>Ghi nhận Thanh toán cho PO: <b>{po?.po_code}</b></span>
                    </div>
                }
                open={isModalOpen}
                onCancel={() => setIsModalOpen(false)}
                onOk={handlePayment}
                confirmLoading={submitting}
                okText="Xác nhận chi tiền"
                cancelText="Hủy"
                width={600}
                destroyOnClose
            >
                <Form layout="vertical" style={{ marginTop: 16 }}>
                    <Form.Item label="Ngày thanh toán" required>
                        <DatePicker
                            value={date}
                            onChange={(d) => setDate(d || dayjs())}
                            format="DD/MM/YYYY"
                            style={{ width: '100%' }}
                            allowClear={false}
                        />
                    </Form.Item>

                    <Form.Item label="Số tiền chi (₫)" required>
                        <InputNumber
                            style={{ width: '100%', fontSize: 16, fontWeight: 'bold' }}
                            value={amount}
                            onChange={(v) => setAmount(Number(v || 0))}
                            formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={(v) => Number(v?.replace(/\$\s?|(,*)/g, '') || 0)}
                            min={0}
                            addonAfter="₫"
                        />
                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            {remainingAmount > 0 && (
                                <Button size="small" type="dashed" onClick={() => setAmount(remainingAmount)}>
                                    Trả hết còn lại ({remainingAmount.toLocaleString()} ₫)
                                </Button>
                            )}
                            {totalAmount > 0 && (
                                <Button size="small" type="dashed" onClick={() => setAmount(Math.round(totalAmount * 0.5))}>
                                    Đặt cọc 50% ({Math.round(totalAmount * 0.5).toLocaleString()} ₫)
                                </Button>
                            )}
                        </div>
                    </Form.Item>

                    <Form.Item label="Phân loại">
                        <Radio.Group value={type} onChange={(e) => setType(e.target.value)}>
                            <Radio.Button value="DEPOSIT">Đặt cọc</Radio.Button>
                            <Radio.Button value="PAYMENT">Thanh toán đợt</Radio.Button>
                            <Radio.Button value="FINAL">Tất toán</Radio.Button>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item label="Số hóa đơn VAT (Nếu có)">
                        <Input
                            placeholder="Nhập số hóa đơn điện tử / VAT..."
                            value={vatCode}
                            onChange={(e) => setVatCode(e.target.value)}
                        />
                    </Form.Item>

                    <Form.Item label="Ghi chú nội dung chuyển khoản / tiền mặt">
                        <Input.TextArea
                            rows={2}
                            placeholder="Ghi chú thêm (VD: CK đợt 1, VCB ủy nhiệm chi...)"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </Form.Item>

                    <Form.Item label="Chứng từ đính kèm (Ảnh ủy nhiệm chi, Hóa đơn, Biên nhận)">
                        <AttachmentUpload value={attachments} onChange={setAttachments} />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
};

export default POPayments;
