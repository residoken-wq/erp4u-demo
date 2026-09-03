import React, { useEffect, useState, useMemo } from 'react';
import { Table, Button, Statistic, Row, Col, Divider, Modal, Form, InputNumber, Radio, Input, message, DatePicker, Tag, Space, Tooltip } from 'antd';
import { DollarOutlined, QrcodeOutlined, CheckCircleOutlined } from '@ant-design/icons';
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
    const [settings, setSettings] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
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

    const fetchSettings = async () => {
        try {
            const res = await api.get('/system/settings');
            setSettings(res.data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        fetchHistory();
        fetchSettings();
    }, [orderCode]);

    const realTimePaidAmount = useMemo(() => {
        return Math.round(history.reduce((sum, item) => sum + (item.status === 'COMPLETED' ? (Number(item.amount) || 0) : 0), 0));
    }, [history]);

    const remainingAmount = Math.round(totalAmount - realTimePaidAmount);

    const handlePayment = async (status: 'DRAFT' | 'COMPLETED') => {
        if (amount <= 0) return message.warning('Nhập số tiền hợp lệ');

        const overpayment = amount - remainingAmount;
        const isOverpaying = overpayment > 0;

        const prefix = type === 'DEPOSIT' ? '[ĐẶT CỌC]' : type === 'FINAL' ? '[TẤT TOÁN]' : '[THANH TOÁN]';
        let finalNote = `${prefix} ${note}`.trim();

        if (isOverpaying && status === 'COMPLETED') {
            finalNote += ` | Số dư: ${overpayment.toLocaleString()}đ - ${overpaymentAction === 'REFUND' ? 'Hoàn tiền' : 'Tạo Credit cho KH'}`;
        }

        try {
            // 1. Create payment transaction
            await api.post(`/finance/payment`, {
                type: 'INCOME',
                amount,
                refCode: orderCode,
                note: finalNote,
                customerName: customerName,
                date: date,
                attachments: attachments,
                status: status
            });

            // 2. If overpayment and COMPLETED, handle based on action
            if (isOverpaying && status === 'COMPLETED') {
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

            message.success(status === 'DRAFT' ? 'Đã tạo yêu cầu thanh toán (Nháp)!' : 'Đã lưu thanh toán!');
            setIsModalOpen(false);
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

    const openModal = () => {
        // Gợi ý số tiền còn lại khi mở modal
        const remain = totalAmount - realTimePaidAmount;
        setAmount(remain > 0 ? remain : 0);
        setNote('');
        setAttachments([]);
        setIsModalOpen(true);
    };

    const showQR = (item: any) => {
        if (!settings) return message.warning('Chưa cấu hình tài khoản ngân hàng trong hệ thống.');
        const rawBankCode = getVietQRBankCode(settings.bank);
        if (!rawBankCode || !settings.bank_account) {
            return message.warning('Cấu hình tài khoản ngân hàng chưa đầy đủ.');
        }
        setQrModalData({
            amount: item.amount,
            bankCode: rawBankCode,
            bankAccount: settings.bank_account,
            bankHolder: settings.bank_holder,
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
                        width: 150,
                        render: (status: string, r: any) => (
                            <Space direction="vertical" size="small">
                                {status === 'DRAFT' ? (
                                    <Tag color="warning">Nháp (Chờ TT)</Tag>
                                ) : (
                                    <Tag color="success">Đã Thu</Tag>
                                )}
                                {status === 'DRAFT' && (
                                    <Space size="small">
                                        <Tooltip title="Xem QR">
                                            <Button size="small" icon={<QrcodeOutlined />} onClick={() => showQR(r)} />
                                        </Tooltip>
                                        <Tooltip title="Xác nhận đã thu">
                                            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleConfirmPayment(r.id)} />
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
                title="Thêm Đợt Thanh Toán" 
                open={isModalOpen} 
                onCancel={() => setIsModalOpen(false)}
                footer={[
                    <Button key="cancel" onClick={() => setIsModalOpen(false)}>
                        Hủy
                    </Button>,
                    <Button key="draft" type="default" onClick={() => handlePayment('DRAFT')} style={{ borderColor: '#faad14', color: '#faad14' }}>
                        Tạo Nháp (Lấy QR)
                    </Button>,
                    <Button key="submit" type="primary" onClick={() => handlePayment('COMPLETED')}>
                        Lưu Đã Thu Tiền
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
                    width={400}
                    centered
                >
                    <div style={{ textAlign: 'center' }}>
                        <img 
                            src={`https://img.vietqr.io/image/${qrModalData.bankCode}-${qrModalData.bankAccount}-compact2.jpg?amount=${Math.floor(qrModalData.amount)}&addInfo=${qrModalData.description}&accountName=${encodeURIComponent(qrModalData.bankHolder)}`} 
                            alt="VietQR" 
                            style={{ width: '100%', maxWidth: 300, borderRadius: 8, marginBottom: 16 }} 
                        />
                        <div style={{ fontSize: 16 }}>
                            <b>Ngân hàng:</b> {settings?.bank}<br />
                            <b>Số tài khoản:</b> {qrModalData.bankAccount}<br />
                            <b>Chủ tài khoản:</b> {qrModalData.bankHolder}<br />
                            <b>Số tiền:</b> <span style={{ color: 'red', fontWeight: 'bold' }}>{Number(qrModalData.amount).toLocaleString()}đ</span><br />
                            <b>Nội dung:</b> {qrModalData.description}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};
export default SalesPayments;