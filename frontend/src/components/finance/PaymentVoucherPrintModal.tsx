import React, { useRef } from 'react';
import { Modal, Button, Space, Typography, Tag } from 'antd';
import { PrinterOutlined, CloseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { numberToWords } from '../../utils/numberToWords';

const { Text } = Typography;

interface PaymentVoucherPrintModalProps {
    open: boolean;
    onClose: () => void;
    transaction: any;
}

export const PaymentVoucherPrintModal: React.FC<PaymentVoucherPrintModalProps> = ({
    open,
    onClose,
    transaction,
}) => {
    const printAreaRef = useRef<HTMLDivElement>(null);

    if (!transaction) return null;

    const isExpense = transaction.type === 'EXPENSE';
    const title = isExpense ? 'PHIẾU CHI' : 'PHIẾU THU';
    const codePrefix = isExpense ? 'PC' : 'PT';
    const voucherNumber = `${codePrefix}-${String(transaction.id).padStart(6, '0')}`;
    const dateObj = dayjs(transaction.date || transaction.created_at);

    const amount = Number(transaction.amount) || 0;
    const amountWords = numberToWords(amount);
    const partnerName = transaction.partner_name || (transaction.supplier?.name) || 'Chưa xác định';
    const description = transaction.description || (isExpense ? 'Chi phí hoạt động sản xuất kinh doanh' : 'Thu tiền bán hàng');
    const refCode = transaction.reference_code || '';
    const invoiceCode = transaction.accounting_invoice_code || transaction.vat_invoice_code || '';

    const handlePrint = () => {
        window.print();
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            width={820}
            footer={[
                <Button key="close" icon={<CloseOutlined />} onClick={onClose}>
                    Đóng
                </Button>,
                <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
                    In Phiếu (A5)
                </Button>,
            ]}
            title={
                <Space>
                    <PrinterOutlined style={{ color: '#eb6100' }} />
                    <span>Xem & In {title}</span>
                    <Tag color={isExpense ? 'red' : 'green'}>{voucherNumber}</Tag>
                    {transaction.status === 'DRAFT' && <Tag color="gold">Bản nháp</Tag>}
                </Space>
            }
        >
            <div className="payment-voucher-print-wrapper" ref={printAreaRef}>
                <style>{`
                    .payment-voucher-print-wrapper {
                        font-family: "Times New Roman", Times, serif;
                        color: #000;
                        background: #fff;
                        padding: 24px 32px;
                        font-size: 14px;
                        line-height: 1.5;
                    }
                    .pv-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        margin-bottom: 16px;
                    }
                    .pv-company-name {
                        font-weight: bold;
                        font-size: 15px;
                        text-transform: uppercase;
                    }
                    .pv-company-sub {
                        font-size: 12px;
                        color: #333;
                    }
                    .pv-template-info {
                        text-align: right;
                        font-size: 12px;
                    }
                    .pv-template-info b {
                        display: block;
                    }
                    .pv-title-box {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .pv-main-title {
                        font-size: 22px;
                        font-weight: bold;
                        letter-spacing: 1px;
                        margin: 0;
                    }
                    .pv-date {
                        font-style: italic;
                        font-size: 13px;
                        margin-top: 4px;
                    }
                    .pv-voucher-no {
                        font-size: 13px;
                        margin-top: 2px;
                    }
                    .pv-content-row {
                        margin-bottom: 8px;
                        display: flex;
                    }
                    .pv-label {
                        white-space: nowrap;
                        margin-right: 6px;
                    }
                    .pv-dots {
                        flex: 1;
                        border-bottom: 1px dotted #888;
                        position: relative;
                        bottom: 3px;
                    }
                    .pv-value {
                        font-weight: 500;
                    }
                    .pv-amount-box {
                        margin: 12px 0;
                        padding: 8px 12px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .pv-signatures {
                        display: grid;
                        grid-template-columns: repeat(5, 1fr);
                        text-align: center;
                        margin-top: 24px;
                        gap: 8px;
                    }
                    .pv-sign-title {
                        font-weight: bold;
                        font-size: 13px;
                    }
                    .pv-sign-sub {
                        font-size: 11px;
                        font-style: italic;
                        color: #666;
                        margin-bottom: 55px;
                    }
                    .pv-sign-name {
                        font-weight: bold;
                        font-size: 12px;
                    }
                    .pv-footer-receipt {
                        margin-top: 20px;
                        border-top: 1px dashed #ccc;
                        padding-top: 8px;
                        font-style: italic;
                        font-size: 12px;
                    }

                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .payment-voucher-print-wrapper, .payment-voucher-print-wrapper * {
                            visibility: visible;
                        }
                        .payment-voucher-print-wrapper {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                            padding: 0 !important;
                            margin: 0 !important;
                            background: transparent;
                        }
                        .ant-modal-mask, .ant-modal-wrap, .ant-modal-header, .ant-modal-footer {
                            display: none !important;
                        }
                        @page {
                            size: A5 landscape;
                            margin: 8mm 10mm 8mm 10mm;
                        }
                    }
                `}</style>

                {/* Header */}
                <div className="pv-header">
                    <div>
                        <div className="pv-company-name">CÔNG TY TNHH ERP4U</div>
                        <div className="pv-company-sub">Sản xuất & Phân phối Thiết bị Mầm non</div>
                        <div className="pv-company-sub">Địa chỉ: TP. Hồ Chí Minh • Hotline: 0908 005 771</div>
                    </div>
                    <div className="pv-template-info">
                        <b>Mẫu số {isExpense ? '02 - TT' : '01 - TT'}</b>
                        <span>(Ban hành theo TT số 200/2014/TT-BTC)</span>
                        <div style={{ marginTop: 4, fontWeight: 'bold' }}>
                            Số: <span style={{ color: '#eb6100' }}>{voucherNumber}</span>
                        </div>
                    </div>
                </div>

                {/* Title */}
                <div className="pv-title-box">
                    <h1 className="pv-main-title">{title}</h1>
                    <div className="pv-date">
                        Ngày {dateObj.format('DD')} tháng {dateObj.format('MM')} năm {dateObj.format('YYYY')}
                    </div>
                </div>

                {/* Content */}
                <div className="pv-content">
                    <div className="pv-content-row">
                        <span className="pv-label">Họ và tên người {isExpense ? 'nhận' : 'nộp'} tiền:</span>
                        <span className="pv-value">{partnerName}</span>
                        <span className="pv-dots" />
                    </div>

                    <div className="pv-content-row">
                        <span className="pv-label">Địa chỉ / Bộ phận:</span>
                        <span className="pv-value">
                            {transaction.category?.name ? `[${transaction.category.name}] ` : ''}
                            {transaction.supplier?.address || 'ERP4U Logistics'}
                        </span>
                        <span className="pv-dots" />
                    </div>

                    <div className="pv-content-row">
                        <span className="pv-label">Lý do {isExpense ? 'chi' : 'nộp'}:</span>
                        <span className="pv-value">{description}</span>
                        <span className="pv-dots" />
                    </div>

                    <div className="pv-amount-box">
                        <div>
                            <span style={{ fontWeight: 'bold', marginRight: 8 }}>Số tiền:</span>
                            <span style={{ fontSize: 18, fontWeight: 'bold', color: isExpense ? '#cf1322' : '#389e0d' }}>
                                {amount.toLocaleString('vi-VN')} VND
                            </span>
                        </div>
                        {invoiceCode && (
                            <div style={{ fontSize: 12, color: '#555' }}>
                                Hóa đơn / Chứng từ: <b>{invoiceCode}</b>
                            </div>
                        )}
                    </div>

                    <div className="pv-content-row">
                        <span className="pv-label">Bằng chữ:</span>
                        <span className="pv-value" style={{ fontStyle: 'italic', fontWeight: 'bold' }}>
                            {amountWords}
                        </span>
                        <span className="pv-dots" />
                    </div>

                    <div className="pv-content-row">
                        <span className="pv-label">Kèm theo:</span>
                        <span className="pv-value">
                            {refCode ? `Chứng từ gốc số: ${refCode}` : 'Biên lai giao hàng / Bảng kê cước'}
                            {transaction.allocations?.length > 1 ? ` (Phân bổ ${transaction.allocations.length} vận đơn)` : ''}
                        </span>
                        <span className="pv-dots" />
                    </div>
                </div>

                {/* Signatures */}
                <div className="pv-signatures">
                    <div>
                        <div className="pv-sign-title">Giám đốc</div>
                        <div className="pv-sign-sub">(Ký, họ tên, đóng dấu)</div>
                        <div className="pv-sign-name">&nbsp;</div>
                    </div>
                    <div>
                        <div className="pv-sign-title">Kế toán trưởng</div>
                        <div className="pv-sign-sub">(Ký, họ tên)</div>
                        <div className="pv-sign-name">&nbsp;</div>
                    </div>
                    <div>
                        <div className="pv-sign-title">Thủ quỹ</div>
                        <div className="pv-sign-sub">(Ký, họ tên)</div>
                        <div className="pv-sign-name">&nbsp;</div>
                    </div>
                    <div>
                        <div className="pv-sign-title">Người lập phiếu</div>
                        <div className="pv-sign-sub">(Ký, họ tên)</div>
                        <div className="pv-sign-name">ERP4U System</div>
                    </div>
                    <div>
                        <div className="pv-sign-title">Người {isExpense ? 'nhận' : 'nộp'} tiền</div>
                        <div className="pv-sign-sub">(Ký, họ tên)</div>
                        <div className="pv-sign-name">{partnerName}</div>
                    </div>
                </div>

                {/* Footer Receipt confirmation */}
                <div className="pv-footer-receipt">
                    * Đã nhận đủ số tiền (viết bằng chữ): ............................................................................................................................................
                </div>
            </div>
        </Modal>
    );
};

export default PaymentVoucherPrintModal;
