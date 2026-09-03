import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Statistic, Row, Col, Divider, Modal, Form, InputNumber, Radio, Input, message, DatePicker, Tag, Space, Tooltip, Popconfirm } from 'antd';
import { DollarOutlined, QrcodeOutlined, CheckCircleOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../../utils/api';
import dayjs from 'dayjs';
import AttachmentUpload from '../common/AttachmentUpload';
import useMobile from '../../hooks/useMobile';
import { getVietQRBankCode } from '../../utils/vietqr';

interface Props {
    orderId: number;
    orderCode: string;
    totalAmount: number;
    paidAmount: number;
    customerName?: string;
    customerId?: number;
    orderStatus?: string; // NEW: order status to control delete/upload
    onSuccess: () => void;
}

const SalesPayments: React.FC<Props> = ({ orderId, orderCode, totalAmount, paidAmount, customerName, customerId, orderStatus, onSuccess }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [companyConfig, setCompanyConfig] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<any>(null);
    const [amount, setAmount] = useState<number>(0);
    const [type, setType] = useState('DEPOSIT');
    const [note, setNote] = useState('');
    const [date, setDate] = useState(dayjs());
    const [attachments, setAttachments] = useState<string[]>([]);
    const [overpaymentAction, setOverpaymentAction] = useState<'REFUND' | 'CREDIT'>('CREDIT');
    const [qrModalData, setQrModalData] = useState<any>(null);
    const isMobile = useMobile();

    const fetchHistory = async () => {
        try {
            const res = await api.get(`/sales/${orderCode}/payment-history`);
            // Chỉ hiển thị phiếu thu (INCOME), không hiển thị phiếu chi
            setHistory(res.data.filter((item: any) => item.type === 'INCOME'));
        } catch (e) {
            console.error(e);
        }
    };

    const fetchCompanyConfig = async () => {
        try {
            const res = await api.get('/system/company');
            setCompanyConfig(res.data);
            return res.data;
        } catch (e) {
            console.error(e);
            return null;
        }
    };

    useEffect(() => {
        fetchHistory();
        fetchCompanyConfig();
    }, [orderCode]);

    const realTimePaidAmount = useMemo(() => {
        return Math.round(history.reduce((sum, item) => sum + (item.status === 'COMPLETED' ? (Number(item.amount) || 0) : 0), 0));
    }, [history]);

    const remainingAmount = Math.round(totalAmount - realTimePaidAmount);

    const handlePayment = async (targetStatus: 'DRAFT' | 'COMPLETED') => {
        if (amount <= 0) return message.warning('Nhập số tiền hợp lệ');

        const overpayment = amount - remainingAmount;
        const isOverpaying = overpayment > 0;

        const prefix = type === 'DEPOSIT' ? '[ĐẶT CỌC]' : type === 'FINAL' ? '[TẤT TOÁN]' : '[THANH TOÁN]';
        let finalNote = `${prefix} ${note}`.trim();

        if (isOverpaying && targetStatus === 'COMPLETED') {
            finalNote += ` | Số dư: ${overpayment.toLocaleString()}đ - ${overpaymentAction === 'REFUND' ? 'Hoàn tiền' : 'Tạo Credit cho KH'}`;
        }

        try {
            if (editingPayment) {
                // 1. Cập nhật thanh toán nháp hiện có
                await api.put(`/finance/transactions/${editingPayment.id}`, {
                    amount,
                    date: date ? date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                    description: finalNote,
                    attachments: attachments,
                    status: targetStatus
                });
                message.success(targetStatus === 'DRAFT' ? 'Đã cập nhật thanh toán nháp!' : 'Đã xác nhận thu tiền thành công!');
            } else {
                // 1. Tạo thanh toán mới
                await api.post(`/finance/payment`, {
                    type: 'INCOME',
                    amount,
                    refCode: orderCode,
                    note: finalNote,
                    customerName: customerName,
                    date: date,
                    attachments: attachments,
                    status: targetStatus
                });

                // 2. If overpayment and COMPLETED, handle based on action
                if (isOverpaying && targetStatus === 'COMPLETED') {
                    if (overpaymentAction === 'CREDIT') {
                        if (customerId) {
                            await api.post(`/customers/${customerId}/credits`, {
                                amount: overpayment,
                                type: 'ADD',
                                reference_code: orderCode,
                                note: `Số dư từ đơn ${orderCode} - Khách hàng: ${customerName}`,
                            });
                            message.success(`Đã tạo Credit ${overpayment.toLocaleString()}đ cho khách hàng!`);
                        } else {
                            message.warning(`Không thể tạo Credit vì không xác định được ID khách hàng.`);
                        }
                    } else if (overpaymentAction === 'REFUND') {
                        // Create refund expense transaction
                        await api.post(`/finance/transactions`, {
                            type: 'EXPENSE',
                            amount: overpayment,
                            reference_code: orderCode,
                            reference_type: 'SALES_REFUND',
                            description: `[HOÀN TIỀN] Số dư từ đơn ${orderCode} - Khách hàng: ${customerName}`,
                            partner_name: customerName,
                            date: date?.format('YYYY-MM-DD') || new Date().toISOString().split('T')[0]
                        });
                        message.success(`Đã ghi nhận hoàn tiền ${overpayment.toLocaleString()}đ!`);
                    }
                }

                message.success(targetStatus === 'DRAFT' ? 'Đã tạo yêu cầu thanh toán (Nháp)!' : 'Đã lưu thanh toán!');
            }

            setIsModalOpen(false);
            setEditingPayment(null);
            setAmount(0);
            setNote('');
            setDate(dayjs());
            setAttachments([]);

            await fetchHistory(); // Load lại history -> Tự động update realTimePaidAmount
            onSuccess(); // Báo cho parent reload nếu cần
        } catch (e) {
            message.error('Lỗi lưu thanh toán');
        }
    };

    const handleConfirmPayment = async (transactionId: number) => {
        try {
            await api.put(`/finance/transactions/${transactionId}`, { status: 'COMPLETED' });
            message.success('Đã xác nhận thu tiền thành công!');
            await fetchHistory();
            onSuccess();
        } catch (error) {
            message.error('Lỗi khi xác nhận thanh toán!');
        }
    };

    const handleDeleteDraft = async (id: number) => {
        try {
            await api.delete(`/finance/transactions/${id}`);
            message.success('Đã xóa đợt thanh toán nháp thành công!');
            if (editingPayment?.id === id) {
                setIsModalOpen(false);
                setEditingPayment(null);
            }
            await fetchHistory();
            onSuccess();
        } catch (e) {
            message.error('Lỗi khi xóa đợt thanh toán');
        }
    };

    const handleOpenEdit = (item: any) => {
        setEditingPayment(item);
        setAmount(Number(item.amount) || 0);
        setDate(item.date ? dayjs(item.date) : (item.created_at ? dayjs(item.created_at) : dayjs()));
        setAttachments(item.attachments || []);

        const desc = item.description || '';
        let parsedType = 'DEPOSIT';
        let parsedNote = desc;
        const match = desc.match(/^\[(.*?)\]/);
        if (match) {
            if (match[1].includes('ĐẶT CỌC')) parsedType = 'DEPOSIT';
            else if (match[1].includes('TẤT TOÁN')) parsedType = 'FINAL';
            else if (match[1].includes('THANH TOÁN')) parsedType = 'PAYMENT';
            parsedNote = desc.replace(match[0], '').trim();
        }
        setType(parsedType);
        setNote(parsedNote);
        setIsModalOpen(true);
    };

    const openModal = () => {
        setEditingPayment(null);
        // Gợi ý số tiền còn lại khi mở modal
        const remain = totalAmount - realTimePaidAmount;
        setAmount(remain > 0 ? remain : 0);
        setNote('');
        setType('DEPOSIT');
        setDate(dayjs());
        setAttachments([]);
        setIsModalOpen(true);
    };

    const handleUpdateAttachments = async (transactionId: number, newAttachments: string[]) => {
        // 1. Optimistic Update
        const oldHistory = [...history];
        setHistory(prev => prev.map(item =>
            item.id === transactionId ? { ...item, attachments: newAttachments } : item
        ));

        try {
            // 2. Call API
            await api.put(`/finance/transactions/${transactionId}`, {
                attachments: newAttachments
            });
            message.success('Đã cập nhật chứng từ');
        } catch (e) {
            console.error(e);
            message.error('Lỗi lưu chứng từ');
            // Revert on error
            setHistory(oldHistory);
        }
    };



    const showQR = async (item: any) => {
        let config = companyConfig;
        if (!config) {
            config = await fetchCompanyConfig();
        }

        const bankName = config?.COMPANY_BANK_NAME || 'ACB - TP.HCM';
        const bankAccount = config?.COMPANY_BANK_ACCOUNT || '141847859';
        const bankHolder = config?.COMPANY_BANK_HOLDER || 'CTY TNHH TM DV TUONG LINH';

        if (!bankAccount) {
            return message.warning('Chưa cấu hình tài khoản ngân hàng trong hệ thống (Cài đặt > Doanh nghiệp & Ngân hàng).');
        }

        const rawBankCode = getVietQRBankCode(bankName);
        setQrModalData({
            amount: item.amount,
            bankCode: rawBankCode,
            bankName: bankName,
            bankAccount: bankAccount,
            bankHolder: bankHolder,
            description: orderCode
        });
    };

    return (
        <div>
            {/* STATS - HORIZONTAL SCROLL ON MOBILE */}
            <div style={{ overflowX: isMobile ? 'auto' : 'visible' }}>
                <Row gutter={[isMobile ? 8 : 16, 8]} wrap={!isMobile} style={{ flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: isMobile ? 400 : 'auto' }}>
                    <Col flex={isMobile ? '130px' : 1}>
                        <Statistic title={<span style={{ fontSize: isMobile ? 11 : 14 }}>Tổng</span>} value={totalAmount} suffix="đ" valueStyle={{ fontSize: isMobile ? 16 : 24 }} />
                    </Col>
                    <Col flex={isMobile ? '130px' : 1}>
                        <Statistic
                            title={<span style={{ fontSize: isMobile ? 11 : 14 }}>Đã TT</span>}
                            value={realTimePaidAmount}
                            valueStyle={{ color: 'green', fontSize: isMobile ? 16 : 24 }}
                            suffix="đ"
                        />
                    </Col>
                    <Col flex={isMobile ? '130px' : 1}>
                        <Statistic
                            title={<span style={{ fontSize: isMobile ? 11 : 14 }}>Còn lại</span>}
                            value={remainingAmount}
                            valueStyle={{ color: remainingAmount > 0 ? 'red' : 'gray', fontSize: isMobile ? 16 : 24 }}
                            suffix="đ"
                        />
                    </Col>
                </Row>
            </div>

            <Divider />

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <b>Lịch sử thanh toán:</b>
                <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    onClick={openModal}
                    size={isMobile ? 'small' : 'middle'}
                >
                    {isMobile ? 'Thêm TT' : 'Thêm thanh toán'}
                </Button>
            </div>

            <Table
                dataSource={history}
                rowKey="id"
                pagination={false}
                size="small"
                bordered
                columns={[
                    { title: 'Ngày tạo', dataIndex: 'created_at', render: (t: any) => dayjs(t).format('DD/MM/YYYY HH:mm'), width: 140 },
                    { title: 'Ngày TT', dataIndex: 'date', render: (t: any) => t ? dayjs(t).format('DD/MM/YYYY') : '-', width: 100 },
                    { 
                        title: 'Số tiền', 
                        dataIndex: 'amount', 
                        align: 'right' as const, 
                        render: (v: any, r: any) => (
                            <b style={{ color: r.status === 'COMPLETED' ? 'green' : '#faad14' }}>
                                {Number(v).toLocaleString()}
                            </b>
                        ), 
                        width: 120 
                    },
                    { title: 'Nội dung', dataIndex: 'description' },
                    {
                        title: 'Trạng thái',
                        dataIndex: 'status',
                        width: 175,
                        render: (status: string, r: any) => (
                            <Space direction="vertical" size="small">
                                {status === 'DRAFT' ? (
                                    <Tag color="warning">Nháp (Chờ TT)</Tag>
                                ) : (
                                    <Tag color="success">Đã Thu</Tag>
                                )}
                                {status === 'DRAFT' && (
                                    <Space size={4}>
                                        <Tooltip title="Xem QR">
                                            <Button size="small" icon={<QrcodeOutlined />} onClick={() => showQR(r)} />
                                        </Tooltip>
                                        <Tooltip title="Sửa thanh toán nháp">
                                            <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(r)} />
                                        </Tooltip>
                                        <Tooltip title="Xác nhận đã thu">
                                            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleConfirmPayment(r.id)} />
                                        </Tooltip>
                                        <Tooltip title="Xóa nháp">
                                            <Popconfirm
                                                title="Xóa đợt thanh toán nháp này?"
                                                onConfirm={() => handleDeleteDraft(r.id)}
                                                okText="Xóa"
                                                cancelText="Hủy"
                                                okButtonProps={{ danger: true }}
                                            >
                                                <Button size="small" danger icon={<DeleteOutlined />} />
                                            </Popconfirm>
                                        </Tooltip>
                                    </Space>
                                )}
                            </Space>
                        )
                    },
                    {
                        title: 'Chứng từ', render: (r: any) => {
                            const isOrderCompleted = orderStatus === 'COMPLETED';
                            return (
                                <AttachmentUpload
                                    value={r.attachments || []}
                                    allowDelete={!isOrderCompleted}
                                    allowUpload={true}
                                    maxFiles={5}
                                    onChange={(newFiles) => handleUpdateAttachments(r.id, newFiles)}
                                />
                            );
                        }
                    }
                ]}
            />

            <Modal 
                title={editingPayment ? `Chỉnh Sửa Đợt Thanh Toán Nháp (#${editingPayment.id})` : "Thêm Đợt Thanh Toán"} 
                open={isModalOpen} 
                onCancel={() => { setIsModalOpen(false); setEditingPayment(null); }}
                footer={[
                    editingPayment && (
                        <Popconfirm
                            key="delete"
                            title="Xóa đợt thanh toán nháp này?"
                            onConfirm={() => handleDeleteDraft(editingPayment.id)}
                            okText="Xóa"
                            cancelText="Hủy"
                            okButtonProps={{ danger: true }}
                        >
                            <Button danger type="text" icon={<DeleteOutlined />} style={{ float: 'left' }}>
                                Xóa Nháp
                            </Button>
                        </Popconfirm>
                    ),
                    <Button key="cancel" onClick={() => { setIsModalOpen(false); setEditingPayment(null); }}>
                        Hủy
                    </Button>,
                    <Button key="draft" type="default" onClick={() => handlePayment('DRAFT')} style={{ borderColor: '#faad14', color: '#faad14' }}>
                        {editingPayment ? 'Lưu Nháp' : 'Tạo Nháp (Lấy QR)'}
                    </Button>,
                    <Button key="submit" type="primary" onClick={() => handlePayment('COMPLETED')}>
                        {editingPayment ? 'Xác Nhận Đã Thu' : 'Lưu Đã Thu Tiền'}
                    </Button>
                ]}
            >
                <Form layout="vertical">
                    <Form.Item label="Ngày thanh toán">
                        <DatePicker
                            showTime
                            format="DD/MM/YYYY HH:mm"
                            value={date}
                            onChange={(d) => setDate(d || dayjs())}
                            style={{ width: '100%' }}
                        />
                    </Form.Item>
                    <Form.Item label="Số tiền">
                        <InputNumber
                            style={{ width: '100%' }}
                            value={amount}
                            onChange={(v: any) => setAmount(v)}
                            formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            addonAfter="₫"
                            min={0}
                        />
                        {amount > remainingAmount && remainingAmount >= 0 && (
                            <div style={{ marginTop: 8, padding: 10, background: '#fff7e6', borderRadius: 6, border: '1px solid #ffd591' }}>
                                <div style={{ color: '#d46b08', marginBottom: 8 }}>
                                    <b>⚠️ Số tiền dư: {(amount - remainingAmount).toLocaleString()}đ</b>
                                </div>
                                <Radio.Group value={overpaymentAction} onChange={e => setOverpaymentAction(e.target.value)} size="small">
                                    <Radio value="CREDIT">Tạo Credit (cấn trừ đơn khác)</Radio>
                                    <Radio value="REFUND">Hoàn tiền mặt</Radio>
                                </Radio.Group>
                            </div>
                        )}
                    </Form.Item>
                    <Form.Item label="Loại">
                        <Radio.Group value={type} onChange={e => setType(e.target.value)} buttonStyle="solid">
                            <Radio.Button value="DEPOSIT">Đặt Cọc</Radio.Button>
                            <Radio.Button value="PAYMENT">Thanh Toán</Radio.Button>
                            <Radio.Button value="FINAL">Tất Toán</Radio.Button>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item label="Ghi chú">
                        <Input.TextArea rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Nhập ghi chú..." />
                    </Form.Item>
                    <Form.Item label="Chứng từ kèm theo">
                        <AttachmentUpload value={attachments} onChange={setAttachments} />
                    </Form.Item>
                </Form>
            </Modal>

            {qrModalData && (
                <Modal
                    title="Mã VietQR Thanh Toán"
                    open={!!qrModalData}
                    onCancel={() => setQrModalData(null)}
                    footer={null}
                    width={420}
                    centered
                >
                    <div style={{ textAlign: 'center' }}>
                        <img 
                            src={`https://img.vietqr.io/image/${qrModalData.bankCode}-${qrModalData.bankAccount}-compact2.jpg?amount=${Math.floor(qrModalData.amount)}&addInfo=${encodeURIComponent(qrModalData.description)}&accountName=${encodeURIComponent(qrModalData.bankHolder)}`} 
                            alt="VietQR" 
                            style={{ width: '100%', maxWidth: 280, borderRadius: 8, marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} 
                        />
                        <div style={{ fontSize: 13, textAlign: 'left', background: '#fafafa', padding: 14, borderRadius: 8, border: '1px solid #f0f0f0', lineHeight: 1.8 }}>
                            <div><b>Ngân hàng:</b> {qrModalData.bankName} <b>({qrModalData.bankCode})</b></div>
                            <div><b>Số tài khoản:</b> <span style={{ color: '#1677ff', fontWeight: 700, fontSize: 15 }}>{qrModalData.bankAccount}</span></div>
                            <div><b>Chủ tài khoản:</b> {qrModalData.bankHolder}</div>
                            <div><b>Số tiền:</b> <span style={{ color: '#cf1322', fontWeight: 700, fontSize: 15 }}>{Number(qrModalData.amount).toLocaleString()}₫</span></div>
                            <div><b>Nội dung CK:</b> <span style={{ fontWeight: 600, background: '#fff1f0', padding: '2px 6px', borderRadius: 4, color: '#cf1322' }}>{qrModalData.description}</span></div>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
export default SalesPayments;