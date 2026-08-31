import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Spin, Result, Button, message, Modal, Steps, Typography, List, Input, Avatar, Row, Col, Card, Descriptions, Divider, Table, Space, Tag, Empty, Dropdown, Watermark } from 'antd';
import { LinkOutlined, CheckCircleOutlined, SolutionOutlined, FileDoneOutlined, CarOutlined, DollarOutlined, UserOutlined, SendOutlined, ShopOutlined, PrinterOutlined, InfoCircleOutlined, CreditCardOutlined, EyeOutlined, AppstoreAddOutlined, FilePdfOutlined, LockOutlined, FileTextOutlined, PushpinOutlined } from '@ant-design/icons';
import { API_URL } from '../config';
import dayjs from 'dayjs';
import useMobile from '../hooks/useMobile'; // <--- Import Hook
import { getVietQRBankCode } from '../utils/vietqr';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

const { Title, Text } = Typography;

// --- CSS FOR PRINT (fallback for Ctrl+P on portal page) ---
const printStyles = `
@media print {
    @page { 
        size: A4 portrait; 
        margin: 10mm 15mm; 
    }
    body { 
        -webkit-print-color-adjust: exact !important; 
        print-color-adjust: exact !important; 
    }
    .no-print { 
        display: none !important; 
    }
    .ant-card {
        box-shadow: none !important;
        border: 1px solid #eee !important;
    }
    .ant-table {
        font-size: 11px !important;
    }
    #root {
        width: 100% !important;
        margin: 0 !important;
        max-width: none !important;
    }
}
`;

// Fix broken Google Drive image URLs in saved contract HTML
const fixContractImageUrls = (html: string): string => {
    if (!html) return '';
    // Fix deprecated uc?export=view format -> thumbnail format
    let fixed = html.replace(
        /https:\/\/drive\.google\.com\/uc\?export=view&id=([a-zA-Z0-9_-]+)/g,
        'https://drive.google.com/thumbnail?id=$1&sz=w1000'
    );
    // Also fix any remaining /file/d/ID/view links used as img src
    fixed = fixed.replace(
        /https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/[^"']*/g,
        'https://drive.google.com/thumbnail?id=$1&sz=w1000'
    );
    // Fix relative URLs in img src (e.g. src="/uploads/...")
    fixed = fixed.replace(
        /src="(\/[^"]+)"/g,
        `src="${window.location.origin}$1"`
    );
    return fixed;
};

const PortalQuotePage: React.FC = () => {
    const { uuid } = useParams();
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [commentText, setCommentText] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [verifyInput, setVerifyInput] = useState('');
    const [isPasswordCorrect, setIsPasswordCorrect] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const isMobile = useMobile(); // <--- Detect Mobile

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const isAdmin = currentUser.username === 'admin' || currentUser.role === 'ADMIN';

    const handlePreview = (imageUrl: string) => {
        setPreviewImage(imageUrl);
        setPreviewVisible(true);
    };

    // Mask phone: show *****123 (last 3 digits)
    const maskPhone = (phone: string | null | undefined): string => {
        if (!phone) return '-';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length < 3) return '*****';
        return '*****' + cleaned.slice(-3);
    };

    const getWatermarkProps = (fontColor: string, fontSize: number) => {
        if (data?.watermark_image) {
            return {
                image: data.watermark_image.startsWith('/uploads/') ? `${API_URL}/upload/files/${data.watermark_image.replace('/uploads/', '')}` : data.watermark_image,
                width: 140,
                height: 140,
                gap: [100, 100] as [number, number]
            };
        }
        return {
            content: "ERP4U",
            font: { color: fontColor, fontSize }
        };
    };

    const fetchQuote = async () => {
        try {
            const res = await axios.get(`${API_URL}/public/portal/quote/${uuid}`);
            setData(res.data);
        } catch (e) { }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchQuote(); }, [uuid]);

    const isOrder = data?.status && data.status !== 'QUOTATION';

    const handleAction = async (action: 'ACCEPT' | 'REJECT') => {
        if (action === 'ACCEPT') {
            setIsVerifyModalOpen(true);
            return;
        }

        Modal.confirm({
            title: (isOrder || data.is_design_order) ? 'Từ chối đơn hàng?' : 'Từ chối báo giá?',
            content: data.is_design_order ? 'Bạn muốn từ chối bản Demo thiết kế này?' : (isOrder ? 'Bạn muốn từ chối đơn hàng này?' : 'Bạn muốn từ chối báo giá này?'),
            okText: 'Từ Chối',
            cancelText: 'Hủy',
            okType: 'danger',
            onOk: async () => {
                await axios.post(`${API_URL}/public/portal/quote/${uuid}/action`, { action });
                message.success('Thành công!'); window.location.reload();
            }
        });
    };

    const handleVerifyAndAccept = async () => {
        if (!verifyInput || !verifyInput.trim()) {
            message.error('Vui lòng nhập số điện thoại hoặc email');
            return;
        }

        const input = verifyInput.trim().toLowerCase();

        // Collect valid verification data
        const validValues = [
            data.customer?.phone,
            data.customer?.email,
            ...(data.customer?.contacts?.map((c: any) => c.phone) || []),
            ...(data.customer?.contacts?.map((c: any) => c.email) || [])
        ].filter(Boolean).map(v => String(v).toLowerCase().trim());

        // Check match
        // Also allow checking "last 4 digits" of phone if needed? No, user said "enter correct phone/email".
        const isMatch = validValues.some(v => v === input);

        if (!isMatch) {
            message.error('Thông tin xác thực không chính xác. Vui lòng thử lại.');
            return;
        }

        try {
            await axios.post(`${API_URL}/public/portal/quote/${uuid}/action`, { action: 'ACCEPT' });
            message.success(data.is_design_order ? 'Đã duyệt bản Demo thiết kế thành công!' : (isOrder ? 'Xác nhận đơn hàng thành công!' : 'Xác nhận báo giá thành công!'));
            setIsVerifyModalOpen(false);
            window.location.reload();
        } catch (e) {
            message.error('Có lỗi xảy ra.');
        }
    };

    const handleSendComment = async () => {
        if (!commentText) return;
        try {
            await axios.post(`${API_URL}/public/portal/quote/${data.id}/comment`, { content: commentText, sender: 'CUSTOMER', name: data.customer_name || 'Khách hàng' });
            setCommentText(''); fetchQuote(); message.success('Đã gửi tin nhắn');
        } catch (e) { }
    };

    // --- PRINT ORDER: A4 Portrait XÁC NHẬN ĐƠN ĐẶT HÀNG ---
    const handlePrintOrder = (mode: 'standard' | 'b2b_no_total' | 'retail' | 'pos' = 'standard') => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const docTitle = isOrder ? 'XÁC NHẬN ĐƠN ĐẶT HÀNG' : 'BẢNG BÁO GIÁ';
        const docSubTitle = isOrder ? 'ORDER CONFIRMATION' : 'QUOTATION';

        const customerName = data.customer?.name || data.customer_name || data.receiver_name || 'Khách lẻ';
        const customerPhone = data.receiver_phone || data.customer?.phone || '';
        const customerAddress = data.shipping_address || data.customer?.address || '';
        const vatCompany = data.customer?.legal_name || data.vat_company_name || data.customer?.name || '';
        const vatTax = data.customer?.tax_code || data.vat_tax_code || '';
        const vatAddress = data.customer?.legal_address || data.vat_address || customerAddress;

        // Dynamic Company / Seller Info
        const sellerName = data.company_info?.COMPANY_NAME || 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TƯỜNG LINH';
        const sellerAddress = data.company_info?.COMPANY_ADDRESS || '74/21/24 Nguyễn Khuyến, P. Bình Thạnh, TP. HCM, VN';
        const sellerPhone = data.company_info?.COMPANY_PHONE || '0983.882210 - 0983.796654';
        const sellerTaxCode = data.company_info?.COMPANY_TAX_CODE || '0311.874.522';
        const sellerEmail = data.company_info?.COMPANY_EMAIL || 'nemmanonerp4u@gmail.com';
        const sellerBankName = data.company_info?.COMPANY_BANK_NAME || 'ACB - TP.HCM';
        const sellerBankAccount = data.company_info?.COMPANY_BANK_ACCOUNT || '141847859';
        const sellerBankHolder = data.company_info?.COMPANY_BANK_HOLDER || 'CTY TNHH TM DV TUONG LINH';
        
        const bannerUrl = data.print_header_banner
            ? (data.print_header_banner.startsWith('/uploads/') ? `${API_URL}/upload/files/${data.print_header_banner.replace('/uploads/', '')}` : data.print_header_banner)
            : `${window.location.origin}/b2b_header_banner.png`;

        const stampImage = data.company_stamp_image
            ? (data.company_stamp_image.startsWith('/uploads/') ? `${API_URL}/upload/files/${data.company_stamp_image.replace('/uploads/', '')}` : data.company_stamp_image)
            : '';

        const primaryColor = data.print_primary_color || '#0050b3';
        const footerNote = data.print_footer_note || '';

        // Calculate totals
        const subTotal = data.items.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
        const discountAmount = Number(data.discount_amount || 0);
        const vatRate = data.vat_rate || 0;
        const taxable = Math.max(0, subTotal - discountAmount);
        const vatAmount = Math.round(taxable * (vatRate / 100));
        const shippingFee = Number(data.shipping_fee || 0);
        const total = taxable + vatAmount + shippingFee;
        const paidAmount = Number(data.paid_amount || 0);
        const depositAmount = Number(data.deposit_amount || 0);
        const remaining = total - paidAmount;

        // QR Code
        let qrAmount = total;
        if (depositAmount > 0 && paidAmount === 0) {
            qrAmount = depositAmount;
        } else if (paidAmount > 0) {
            qrAmount = remaining > 0 ? remaining : 0;
        }
        qrAmount = Math.floor(qrAmount);

        const rawBankCode = getVietQRBankCode(sellerBankName);
        const qrLink = `https://img.vietqr.io/image/${rawBankCode}-${sellerBankAccount}-compact2.jpg?amount=${qrAmount}&addInfo=${data.order_code}&accountName=${encodeURIComponent(sellerBankHolder)}`;

        if (mode === 'pos') {
            const posHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Hóa Đơn POS - ${data.order_code}</title>
    <style>
        @media print {
            body * { visibility: hidden; }
            #pos-receipt, #pos-receipt * { visibility: visible; }
            #pos-receipt { position: absolute; left: 0; top: 0; width: 300px; margin: 0; padding: 0; }
            html, body { background: #fff; height: auto; margin: 0; }
        }
    </style>
</head>
<body style="background: #f0f0f0; display: flex; justify-content: center; padding: 20px;">
    <div id="pos-receipt" style="width: 300px; font-family: monospace; color: #000; font-size: 13px; padding: 10px; background: #fff;">
        <div style="text-align: center; margin-bottom: 10px;">
            <h2 style="margin: 0; font-size: 18px;">${sellerName}</h2>
            <div>Hóa Đơn Bán Lẻ POS</div>
            <div>================================</div>
        </div>
        <div style="margin-bottom: 10px;">
            <div><strong>Mã đơn:</strong> ${data.order_code}</div>
            <div><strong>Ngày:</strong> ${dayjs(data.order_date || new Date()).format('DD/MM/YYYY HH:mm')}</div>
            <div><strong>Khách hàng:</strong> ${customerName}</div>
            ${customerPhone ? `<div><strong>SĐT:</strong> ${customerPhone}</div>` : ''}
        </div>
        <div>================================</div>
        <table style="width: 100%; margin-bottom: 10px; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 1px dashed #000;">
                    <th style="text-align: left; padding-bottom: 5px;">SP</th>
                    <th style="text-align: center; padding-bottom: 5px; width: 30px;">SL</th>
                    <th style="text-align: right; padding-bottom: 5px; width: 80px;">Thành tiền</th>
                </tr>
            </thead>
            <tbody>
                ${(data.items || []).map((item: any) => {
                const productName = item.product_name_real || item.product?.name || item.sku;
                return `
                    <tr>
                        <td style="padding: 5px 0; vertical-align: top;">
                            <div style="max-width: 170px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${productName}</div>
                            <span style="font-size: 11px;">${Number(item.unit_price).toLocaleString('vi-VN')}</span>
                        </td>
                        <td style="text-align: center; vertical-align: top; padding-top: 5px;">${item.quantity}</td>
                        <td style="text-align: right; vertical-align: top; padding-top: 5px;">${Number(item.subtotal).toLocaleString('vi-VN')}</td>
                    </tr>
                    `;
            }).join('')}
            </tbody>
        </table>
        <div>================================</div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Cộng tiền hàng:</span>
            <span>${subTotal.toLocaleString('vi-VN')}đ</span>
        </div>
        ${discountAmount > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #52c41a;">
            <span>Giảm giá:</span>
            <span>-${discountAmount.toLocaleString('vi-VN')}đ</span>
        </div>` : ''}
        ${vatAmount > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>VAT (${vatRate}%):</span>
            <span>${vatAmount.toLocaleString('vi-VN')}đ</span>
        </div>` : ''}
        ${shippingFee > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
            <span>Phí vận chuyển:</span>
            <span>${shippingFee.toLocaleString('vi-VN')}đ</span>
        </div>` : ''}
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 15px; margin-top: 5px;">
            <span>TỔNG CỘNG:</span>
            <span>${total.toLocaleString('vi-VN')}đ</span>
        </div>
        ${paidAmount > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 5px; color: #52c41a; font-weight: bold;">
            <span>Đã cọc:</span>
            <span>${paidAmount.toLocaleString('vi-VN')}đ</span>
        </div>` : ''}
        <div style="text-align: center; margin-top: 20px;">
            <div style="margin-bottom: 5px; font-size: 12px;">Quét mã để thanh toán / Chuyển khoản</div>
            <img src="${qrLink}" alt="VietQR" style="width: 180px; height: 180px;" />
        </div>
        <div style="text-align: center; margin-top: 15px; font-size: 12px; border-top: 1px dashed #000; padding-top: 10px;">
            Trân trọng cảm ơn quý khách!
        </div>
    </div>
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;
            printWindow.document.write(posHtml);
            printWindow.document.close();
            return;
        }

        // Terms content
        const termsHtml = data.terms_content
            ? data.terms_content.split('\n').map((line: string) => `<div>${line}</div>`).join('')
            : '';

        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${docTitle} - ${data.order_code}</title>
    <style>
        @page { size: A4 portrait; margin: 12mm 15mm 15mm 15mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Times New Roman', Times, serif; 
            font-size: 13px; 
            color: #1a1a1a;
            line-height: 1.5;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        .page { width: 100%; max-width: 210mm; margin: 0 auto; padding: 0; }
        
        /* HEADER */
        .header { display: flex; justify-content: space-between; align-items: stretch; padding-bottom: 12px; border-bottom: 3px solid ${primaryColor}; margin-bottom: 15px; gap: 15px; }
        .header-left { width: calc(50% - 7.5px); display: flex; align-items: center; }
        .header-right { text-align: right; min-width: 200px; }
        .doc-title { font-size: 22px; font-weight: 800; color: ${primaryColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
        .doc-subtitle { font-size: 11px; color: #666; font-style: italic; text-transform: uppercase; letter-spacing: 2px; }
        .doc-meta { font-size: 12px; color: #555; margin-top: 8px; }
        .doc-meta b { color: ${primaryColor}; }
        
        /* PARTY INFO */
        .parties { display: flex; gap: 15px; margin-bottom: 15px; }
        .party-box { flex: 1; padding: 10px 12px; border-radius: 6px; font-size: 12px; line-height: 1.6; }
        .party-a { background: #f0f5ff; border: 1px solid #adc6ff; }
        .party-b { background: #fff7e6; border: 1px solid #ffd591; }
        .party-label { font-weight: 800; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(0,0,0,0.1); }
        .party-a .party-label { color: ${primaryColor}; }
        .party-b .party-label { color: #d46b08; }
        .party-row { margin-bottom: 2px; }
        .party-row b { color: #333; }
        
        /* TABLE */
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 12px; }
        .items-table th { 
            background: ${primaryColor}; 
            color: #fff; 
            padding: 8px 6px; 
            font-weight: 700; 
            font-size: 11px; 
            text-transform: uppercase; 
            letter-spacing: 0.5px;
            border: 1px solid ${primaryColor};
        }
        .items-table td { 
            padding: 6px; 
            border: 1px solid #d9d9d9; 
            vertical-align: middle; 
        }
        .items-table tbody tr:nth-child(even) { background: #fafafa; }
        .items-table tbody tr:hover { background: #f0f5ff; }
        
        /* SUMMARY */
        .summary-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .summary-table td { padding: 5px 8px; border: 1px solid #d9d9d9; }
        .summary-label { text-align: right; color: #555; font-weight: 500; }
        .summary-value { text-align: right; font-weight: 600; width: 140px; }
        .summary-total { background: #f0f5ff !important; }
        .summary-total .summary-label { font-size: 14px; font-weight: 800; color: ${primaryColor}; }
        .summary-total .summary-value { font-size: 15px; font-weight: 800; color: #cf1322; }
        
        /* BOTTOM SECTION */
        .bottom-section { display: block; margin-top: 15px; }
        .terms-box { margin-bottom: 15px; font-size: 11px; line-height: 1.5; }
        .terms-title { font-weight: 700; text-transform: uppercase; font-size: 11px; color: ${primaryColor}; margin-bottom: 6px; border-bottom: 1px solid ${primaryColor}; padding-bottom: 3px; }
        .payment-horizontal { border: 1px solid #d9d9d9; border-radius: 8px; padding: 10px; display: flex; align-items: center; gap: 15px; page-break-inside: avoid; }
        .payment-amounts { display: flex; gap: 10px; }
        .payment-amount-box { flex: 1; padding: 6px; border-radius: 6px; text-align: center; }
        .bank-info { background: #f9f9f9; padding: 6px 10px; border-radius: 6px; border: 1px solid #e8e8e8; font-size: 11px; display: flex; justify-content: space-between; margin-top: 8px; }
        .qr-box { width: 130px; text-align: center; flex-shrink: 0; }
        .qr-box img { width: 130px; height: 130px; }
        .qr-label { font-size: 9px; font-weight: 700; color: ${primaryColor}; margin-top: 2px; }
        
        /* SIGNATURES */
        .signatures { display: flex; justify-content: space-between; margin-top: 25px; text-align: center; page-break-inside: avoid; }
        .sig-col { width: 45%; }
        .sig-role { font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 4px; }
        .sig-note { font-size: 11px; font-style: italic; color: #888; }
        .sig-space { height: 75px; }
        
        /* FOOTER */
        .page-footer { margin-top: 15px; padding-top: 8px; border-top: 1px solid #e8e8e8; text-align: center; font-size: 9px; color: #bbb; }
        
        /* NOTE BOX */
        .note-box { background: #fffbe6; border: 1px solid #ffe58f; padding: 8px 10px; border-radius: 6px; margin-bottom: 12px; font-size: 11px; }
        .note-box .note-label { font-weight: 700; color: #d48806; margin-bottom: 3px; }
    </style>
</head>
<body>
    <div class="page">
        <!-- HEADER -->
        <div class="header">
            <div class="header-left">
                <img src="${bannerUrl}" alt="${sellerName}" style="width: 100%; max-height: 90px; object-fit: contain; object-position: left center;" onerror="this.src='${window.location.origin}/company_header.png';" />
            </div>
            <div class="header-right">
                <div class="doc-title">${docTitle}</div>
                <div class="doc-meta">
                    Số: <b>${data.order_code}</b><br/>
                    Ngày ${dayjs(data.order_date).format('DD')} tháng ${dayjs(data.order_date).format('MM')} năm ${dayjs(data.order_date).format('YYYY')}
                </div>
            </div>
        </div>
        
        <!-- PARTY INFO -->
        ${mode === 'retail' ? '' : `
        <div class="parties">
            <div class="party-box party-a">
                <div class="party-label">Bên bán</div>
                <div class="party-row"><b>${sellerName}</b></div>
                <div class="party-row">📍 ${sellerAddress}</div>
                <div class="party-row">📞 ${sellerPhone}</div>
                <div class="party-row">MST: <b>${sellerTaxCode}</b></div>
                <div class="party-row">Email: <b>${sellerEmail}</b></div>
                <div class="party-row">Sale Agent: <b>${data.assigned_to?.full_name || data.assigned_to?.name || data.sale_agent?.name || data.sale_name || data.created_by?.full_name || data.created_by?.name || '...'}</b> - ${data.assigned_to?.phone || data.sale_agent?.phone || data.sale_phone || data.created_by?.phone || '...'}</div>
            </div>
            <div class="party-box party-b">
                <div class="party-label">Bên mua</div>
                <div class="party-row"><b>${vatCompany || customerName}</b></div>
                <div class="party-row">📍 ${vatAddress || customerAddress || '...'}</div>
                <div class="party-row">📞 ${customerPhone || data.receiver_phone || '...'}</div>
                ${vatTax ? `<div class="party-row" style="margin-bottom: 5px;">MST: <b>${vatTax}</b></div>` : ''}
                ${data.contact_name ? `<div class="party-row" style="margin-bottom: 5px;"><b>Người liên hệ:</b> ${data.contact_name} ${data.contact_phone ? `- ${data.contact_phone}` : ''}</div>` : ''}
                <div class="party-row" style="margin-bottom: 5px; white-space: pre-wrap;"><b>Địa chỉ giao hàng:</b><br />${data.shipping_address || data.customer?.address || '...'}</div>
                ${(data.receiver_name || data.receiver_phone) ? `<div class="party-row"><b>Người nhận:</b> ${data.receiver_name || customerName} ${data.receiver_phone ? `- ${data.receiver_phone}` : ''}</div>` : ''}
            </div>
        </div>
        `}
        
        <!-- PRODUCT TABLE -->
        <div style="font-size:12px;font-weight:600;margin-bottom:6px;color:#333;">Chi tiết sản phẩm:</div>
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width:30px;">STT</th>
                    <th style="width:95px;">Hình</th>
                    <th style="width:120px;">Tên Sản Phẩm</th>
                    <th>Mô tả Sản Phẩm</th>
                    <th style="width:40px;">ĐVT</th>
                    <th style="width:35px;">SL</th>
                    <th style="width:70px;">Đơn Giá</th>
                    <th style="width:55px;">Thành Tiền</th>
                </tr>
            </thead>
            <tbody>
                ${(data.items || []).map((item: any, idx: number) => {
            const imgUrl = item.image_url || item.sample_image || item.product?.image_url;
            let imgSrc = '';
            if (imgUrl) {
                if (imgUrl.includes('drive.google.com')) {
                    const match = imgUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) imgSrc = 'https://drive.google.com/thumbnail?id=' + match[1] + '&sz=w200';
                    else imgSrc = imgUrl;
                } else if (imgUrl.startsWith('http') || imgUrl.startsWith('data:')) {
                    imgSrc = imgUrl;
                } else {
                    imgSrc = window.location.origin + imgUrl;
                }
            }
            const productName = item.product_name_real || item.product?.name || item.sku;
            const vatContent = item.vat_content || '';
            const customerDesc = item.product?.customer_description || '';
            let descLines = '';
            if (customerDesc) {
                descLines = customerDesc.split('\n').map((line: string, idx: number) => {
                    const cleanLine = line.trim();
                    if (!cleanLine) return '';

                    const comboMatch = cleanLine.match(/^•\s*(.*?)\s*\(x([\d\.]+)\)(?:\s*-\s*(.*))?$/);
                    if (comboMatch) {
                        const [_, name, qty, trailingDesc] = comboMatch;
                        let res = idx > 0 ? '<div style="margin-top:6px; padding-top:6px; border-top:1px dashed #ddd;"></div>' : '';
                        if (trailingDesc) {
                            res += '<div style="padding-left:12px;margin-top:2px;font-size:10px;color:#666;font-style:italic;">. ' + trailingDesc + '</div>';
                        }
                        return res;
                    }

                    return '<div style="padding-left:12px;margin-top:2px;font-size:10px;color:#666;font-style:italic;">. ' + cleanLine.replace(/^[•-]\s*/, '') + '</div>';
                }).join('');
            }
            const customerNoteHTML = item.customer_note ? '<div style="margin-top:6px;font-size:10px;font-style:italic;color:#d46b08;">📌 ' + item.customer_note + '</div>' : '';
            const imgCell = '<div style="display:flex;flex-direction:column;align-items:center;">' + (imgSrc ? '<img src="' + imgSrc + '" style="width:80px;height:80px;object-fit:cover;border-radius:4px;border:1px solid #ddd;" onerror="this.style.display=\'none\'" />' : '<span style="color:#ccc;font-size:10px;">-</span>') + customerNoteHTML + '</div>';
            const colorLine = item.variant_color ? '<div style="font-size:10px;color:#888;">Màu: ' + item.variant_color + '</div>' : '';

            let priceRangesHtml = '';
            if (data.status === 'QUOTATION' && item.price_ranges && Array.isArray(item.price_ranges) && item.price_ranges.length > 0) {
                const rangeText = item.price_ranges.map((r: any) => r.quantity + ' cái: ' + Number(r.unit_price).toLocaleString() + 'đ/cái').join(' | ');
                priceRangesHtml = '<div style="margin-top:6px;padding:4px 6px;background:#fffbe6;border:1px dashed #ffe58f;border-radius:4px;font-size:10px;color:#d46b08;"><span style="font-weight:600;">🏷️ Tùy chọn mua nhiều:</span><br/>' + rangeText + '</div>';
            }

            return '<tr>'
                + '<td style="text-align:center;font-weight:600;">' + (idx + 1) + '</td>'
                + '<td style="text-align:center;padding:4px;">' + imgCell + '</td>'
                + '<td style="text-align:left;padding:6px 8px;">'
                + '<div style="font-weight:700;font-size:12px;color:#1a1a1a;margin-bottom:2px;">' + (vatContent || productName) + '</div>'
                + (vatContent ? '<div style="font-style:italic;font-size:10px;color:#555;">' + productName + '</div>' : '')
                + colorLine
                + '</td>'
                + '<td style="text-align:left;padding:6px 8px;font-size:11px;color:#555;line-height:1.5;">' + descLines + priceRangesHtml + '</td>'
                + '<td style="text-align:center;font-weight:bold;">' + (item.product?.unit || 'Cái') + '</td>'
                + '<td style="text-align:center;font-weight:700;font-size:13px;">' + Number(item.quantity) + '</td>'
                + '<td style="text-align:right;padding-right:8px;font-weight:bold;">' + Number(item.unit_price).toLocaleString() + '</td>'
                + '<td style="text-align:right;padding-right:8px;font-weight:700;">' + Number(item.subtotal).toLocaleString() + '</td>'
                + '</tr>';
        }).join('')}
                <!-- SUMMARY -->
                ${mode === 'b2b_no_total' ? '' : `
                <tr>
                    <td colspan="4" style="border:none;"></td>
                    <td colspan="3" class="summary-label">Tổng tiền hàng:</td>
                    <td class="summary-value">${subTotal.toLocaleString()}</td>
                </tr>
                ${discountAmount > 0 ? '<tr><td colspan="4" style="border:none;"></td><td colspan="3" class="summary-label">Giảm giá (' + (data.discount_rate || 0) + '%):</td><td class="summary-value" style="color:#52c41a;">-' + discountAmount.toLocaleString() + '</td></tr>' : ''}
                <tr>
                    <td colspan="4" style="border:none;"></td>
                    <td colspan="3" class="summary-label">Thuế GTGT (${vatRate}%):</td>
                    <td class="summary-value">${vatAmount.toLocaleString()}</td>
                </tr>
                ${shippingFee > 0 ? '<tr><td colspan="4" style="border:none;"></td><td colspan="3" class="summary-label">Phí vận chuyển:</td><td class="summary-value">' + shippingFee.toLocaleString() + '</td></tr>' : ''}
                <tr class="summary-total">
                    <td colspan="4" style="border:none; background:#fff;"></td>
                    <td colspan="3" class="summary-label">TỔNG CỘNG:</td>
                    <td class="summary-value">${total.toLocaleString()} ₫</td>
                </tr>
                ${paidAmount > 0 ? '<tr><td colspan="4" style="border:none;"></td><td colspan="3" class="summary-label" style="color:#52c41a;">Đã thanh toán:</td><td class="summary-value" style="color:#52c41a;">' + paidAmount.toLocaleString() + ' ₫</td></tr><tr><td colspan="4" style="border:none;"></td><td colspan="3" class="summary-label" style="color:#cf1322;font-weight:700;">Còn lại cần thanh toán:</td><td class="summary-value" style="color:#cf1322;font-weight:800;font-size:14px;">' + remaining.toLocaleString() + ' ₫</td></tr>' : ''}
                `}
            </tbody>
        </table>

        ${data.note ? '<div style="margin-top:12px;display:flex;gap:10px;background:#fff7e6;padding:12px 14px;border-radius:8px;border:1px solid #ffec3d;font-size:12px;"><span style="color:#faad14;font-size:16px;margin-top:2px;">ℹ️</span><div><div style="font-weight:700;color:#d48806;margin-bottom:4px;">Ghi chú từ người bán:</div><div style="color:#595959;white-space:pre-line;line-height:1.6;">' + data.note + '</div></div></div>' : ''}
        
        <!-- BOTTOM: TERMS + PAYMENT -->
        <div class="bottom-section">
            <div class="terms-box">
                ${termsHtml ? '<div class="terms-title">Điều khoản & Quy định</div><div style="white-space:pre-line;color:#555;">' + data.terms_content + '</div>' : ''}
            </div>
            ${(isOrder && mode !== 'b2b_no_total') ? `
            <div class="payment-horizontal">
                <div style="display: flex; flex-direction: column; flex: 1;">
                    <div class="payment-amounts">
                        ${depositAmount > 0 ? `
                        <div class="payment-amount-box" style="background:#f9f0ff; border:1px solid #d3adf7;">
                            <div style="color:#722ed1;font-size:9px;text-transform:uppercase;font-weight:600;">💰 Cần đặt cọc (${data.deposit_percent || 0}%)</div>
                            <div style="font-size:13px;font-weight:700;color:#531dab;">${depositAmount.toLocaleString('vi-VN')} ₫</div>
                        </div>` : ''}

                        ${paidAmount > 0 ? `
                        <div class="payment-amount-box" style="background:#f0f5ff; border:1px solid #adc6ff;">
                            <div style="color:#2f54eb;font-size:9px;text-transform:uppercase;font-weight:600;">Đã thanh toán</div>
                            <div style="font-size:13px;font-weight:700;color:#1d39c4;">${paidAmount.toLocaleString('vi-VN')} ₫</div>
                        </div>` : ''}

                        <div class="payment-amount-box" style="background:#f6ffed; border:1px solid #b7eb8f;">
                            <div style="color:#52c41a;font-size:9px;text-transform:uppercase;font-weight:600;">Cần thanh toán</div>
                            <div style="font-size:14px;font-weight:800;color:#389e0d;">${remaining.toLocaleString('vi-VN')} ₫</div>
                        </div>
                    </div>
                    
                    <div class="bank-info">
                        <div><b>NH:</b> ${sellerBankName}</div>
                        <div><b>STK:</b> ${sellerBankAccount}</div>
                        <div><b>Chủ TK:</b> ${sellerBankHolder}</div>
                        <div><b>ND CK:</b> <b style="color:${primaryColor};">${data.order_code}</b></div>
                    </div>
                </div>
                
                <div class="qr-box">
                    <img src="${qrLink}" alt="QR" />
                    <div class="qr-label">ERP4U PAYMENT</div>
                </div>
            </div>
            ` : ''}
        </div>
        
        <!-- SIGNATURES -->
        ${mode === 'retail' ? '' : `
        <div class="signatures">
            <div class="sig-col">
                <div class="sig-role">Đại diện khách hàng</div>
                <div class="sig-note">(Ký, ghi rõ họ tên)</div>
                <div class="sig-space"></div>
            </div>
            <div class="sig-col">
                <div class="sig-role">Đại diện ${sellerName}</div>
                <div class="sig-note">(Ký, đóng dấu)</div>
                <div class="sig-space" style="position: relative; display: flex; justify-content: center; align-items: center;">
                    ${stampImage ? `<img src="${stampImage}" alt="Stamp" style="max-height: 75px; max-width: 140px; object-fit: contain;" />` : ''}
                </div>
            </div>
        </div>
        `}
        
        <div class="page-footer">
            ${footerNote ? `${footerNote} &bull; ` : ''}Xác nhận đơn đặt hàng được tạo tự động bởi ERP4U &bull; ${window.location.origin}/portal/${data.uuid}
        </div>
    </div>
    <script>window.onload = function() { window.print(); }</script>
</body>
</html>`;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const handleDeleteComment = async (commentId: number) => {
        Modal.confirm({
            title: 'Thu hồi tin nhắn?',
            content: 'Bạn có chắc chắn muốn thu hồi tin nhắn này?',
            okText: 'Thu hồi',
            cancelText: 'Hủy',
            okButtonProps: { danger: true },
            onOk: async () => {
                try {
                    await axios.delete(`${API_URL}/public/portal/quote/comment/${commentId}`, { data: { deletedBy: data.customer_name || 'Khách hàng' } });
                    message.success('Đã thu hồi tin nhắn');
                    fetchQuote();
                } catch (e) { message.error('Không thể thu hồi tin nhắn'); }
            }
        });
    };



    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}><Spin size="large" tip="Đang tải dữ liệu..." /></div>;
    if (!data) return <Result status="404" title="404" subTitle="Không tìm thấy dữ liệu hoặc đường dẫn không hợp lệ." />;

    if (!isPasswordCorrect) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f4f7f6' }}>
                <Modal
                    title={<span style={{ fontWeight: 700 }}><LockOutlined /> Mật Khẩu Truy Cập</span>}
                    open={true}
                    closable={false}
                    maskClosable={false}
                    footer={[
                        <Button key="submit" type="primary" onClick={() => {
                            if (passwordInput.trim().toLowerCase() === 'erp4u') {
                                setIsPasswordCorrect(true);
                            } else {
                                message.error('Mật khẩu không chính xác!');
                            }
                        }}>
                            Xác nhận truy cập
                        </Button>
                    ]}
                >
                    <div style={{ marginBottom: 16 }}>
                        Để bảo mật thông tin, vui lòng nhập mật khẩu để xem {isOrder ? 'đơn hàng' : 'báo giá'}.
                    </div>
                    <Input.Password
                        placeholder="Nhập mật khẩu (erp4u)..."
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        onPressEnter={() => {
                            if (passwordInput.trim().toLowerCase() === 'erp4u') {
                                setIsPasswordCorrect(true);
                            } else {
                                message.error('Mật khẩu không chính xác!');
                            }
                        }}
                        autoFocus
                    />
                </Modal>
            </div>
        );
    }

    let currentStep = 0;
    let stepsItems: any[] = [];
    
    if (data.is_design_order) {
        const designStatuses = ['DRAFT', 'INFO_COLLECTED', 'DESIGNING', 'DEMO_SENT', 'DEMO_APPROVED', 'DEMO_REJECTED', 'PRINTING', 'DONE'];
        currentStep = designStatuses.indexOf(data.status);
        if (currentStep < 0) currentStep = 0;
        
        stepsItems = [
            { title: 'Tiếp nhận', icon: <SolutionOutlined /> },
            { title: 'Đang thiết kế', icon: <FileTextOutlined /> },
            { title: 'Gửi Demo', icon: <SendOutlined /> },
            { title: 'Duyệt Demo', icon: <CheckCircleOutlined /> },
            { title: 'In ấn', icon: <PrinterOutlined /> },
            { title: 'Hoàn tất', icon: <CheckCircleOutlined /> }
        ];
        
        if (data.status === 'DRAFT' || data.status === 'INFO_COLLECTED') currentStep = 0;
        else if (data.status === 'DESIGNING') currentStep = 1;
        else if (data.status === 'DEMO_SENT') currentStep = 2;
        else if (data.status === 'DEMO_APPROVED' || data.status === 'DEMO_REJECTED') currentStep = 3;
        else if (data.status === 'PRINTING') currentStep = 4;
        else if (data.status === 'DONE') currentStep = 5;
    } else {
        const statusList = ['QUOTATION', 'DEPOSITED', 'SAMPLE_APPROVED', 'IN_PRODUCTION', 'MANUFACTURING_COMPLETED', 'DELIVERED', 'COMPLETED'];
        currentStep = statusList.indexOf(data.status);

        // Map status to steps
        if (data.status === 'SO_PENDING') currentStep = 0; // Still Quotation/Pending
        if (data.status === 'PLANNED') currentStep = 3; // Planned -> Production
        if (data.status === 'PARTIAL_DELIVERY') currentStep = 5; // Partial -> Delivery
        if (data.status === 'COMPLETED') currentStep = 6;
        
        stepsItems = [
            { title: 'Báo Giá', icon: <SolutionOutlined /> },
            { title: 'Xác Nhận & Cọc', icon: <DollarOutlined /> },
            { title: 'Duyệt Mẫu', icon: <FileDoneOutlined /> },
            { title: 'Sản Xuất', icon: <AppstoreAddOutlined /> },
            { title: 'Xong SX', icon: <CheckCircleOutlined /> },
            { title: 'Giao Hàng', icon: <CarOutlined /> },
            { title: 'Hoàn Tất', icon: <DollarOutlined /> }
        ];
    }

    const visibleComments = (data.comments || []).filter((c: any) => c.sender_type === 'CUSTOMER' || c.is_visible);

    // --- CẤU HÌNH CỘT BẢNG MỚI: CỘT SẢN PHẨM RỘNG HƠN ---
    const columns = [
        {
            title: '#',
            key: 'index',
            width: 40,
            align: 'center' as const,
            render: (_: any, __: any, index: number) => <span style={{ color: '#999' }}>{index + 1}</span>
        },
        {
            title: 'Hình',
            key: 'image',
            width: 120,
            align: 'center' as const,
            render: (_: any, r: any) => {
                const rawUrl = r.image_url || r.sample_image || r.product?.image_url;
                if (!rawUrl) return <div style={{ color: '#ccc', fontSize: 10, textAlign: 'center' }}>No Img</div>;

                let finalSrc = rawUrl;
                let isImage = false;

                // 1. Handle Google Drive
                if (rawUrl.includes('drive.google.com')) {
                    let id = '';
                    try {
                        const urlObj = new URL(rawUrl);
                        if (urlObj.pathname.includes('/d/')) {
                            const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) id = match[1];
                        } else if (urlObj.searchParams.has('id')) {
                            id = urlObj.searchParams.get('id') || '';
                        }
                    } catch (e) {
                        // Fallback regex if URL parsing fails
                        const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                        if (match && match[1]) id = match[1];
                    }

                    if (id) {
                        // Use thumbnail endpoint for reliable image rendering
                        finalSrc = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
                        isImage = true;
                    }
                }
                // 2. Handle Google User Content (already direct)
                else if (rawUrl.includes('googleusercontent.com')) {
                    isImage = true;
                }
                // 3. Handle Normal Images
                else {
                    if (!rawUrl.startsWith('http') && !rawUrl.startsWith('data:')) finalSrc = `${API_URL}${rawUrl}`;
                    isImage = !!(rawUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/i) || rawUrl.startsWith('data:image'));
                }

                // Force isImage true if we detected Drive link
                if (rawUrl.includes('drive.google.com')) isImage = true;
                return (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        {isImage ? (
                            <Watermark {...getWatermarkProps('rgba(0,0,0,0.15)', 14)}>
                                <img
                                    src={finalSrc}
                                    alt="product"
                                    style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 4, cursor: 'pointer', border: '1px solid #eee', display: 'block' }}
                                    onClick={() => handlePreview(finalSrc)}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).onerror = null;
                                    }}
                                />
                            </Watermark>
                        ) : (
                            <a href={finalSrc} target="_blank" rel="noopener noreferrer">
                                <LinkOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                            </a>
                        )}
                        
                        {r.customer_note && (
                            <div style={{ width: '100%', padding: '6px', background: '#fffbe6', border: '1px dashed #ffe58f', borderRadius: 4, textAlign: 'left', display: 'flex', gap: 4, alignItems: 'flex-start' }}>
                                <PushpinOutlined style={{ color: '#d46b08', marginTop: 2 }} />
                                <div style={{ fontSize: 11, color: '#d46b08', whiteSpace: 'pre-wrap', fontStyle: 'italic', flex: 1 }}>
                                    {r.customer_note}
                                </div>
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            title: 'Tên Sản Phẩm',
            dataIndex: 'vat_content',
            key: 'vat_content',
            width: 170,
            render: (text: string) => {
                return (
                    <div style={{
                        fontSize: 13,
                        color: '#555',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.5,
                        minWidth: 200
                    }}>
                        {text || '-'}
                    </div>
                );
            }
        },
        {
            title: 'Mô tả Sản Phẩm',
            key: 'product_details',
            width: 280,
            render: (_: any, r: any) => {
                const imgUrl = r.image_url || r.sample_image || r.product?.image_url;
                const isImage = imgUrl && (imgUrl.match(/\.(jpeg|jpg|gif|png)$/i) || imgUrl.includes('drive.google.com') || imgUrl.includes('googleusercontent.com'));

                // Helper to convert Google Drive link to Direct Link
                const getDirectLink = (url: string) => {
                    if (!url) return '';
                    if (url.includes('drive.google.com')) {
                        let id = '';
                        try {
                            const urlObj = new URL(url);
                            if (urlObj.pathname.includes('/d/')) {
                                const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                                if (match && match[1]) id = match[1];
                            } else if (urlObj.searchParams.has('id')) {
                                id = urlObj.searchParams.get('id') || '';
                            }
                        } catch (e) {
                            const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
                            if (match && match[1]) id = match[1];
                        }
                        if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
                    }
                    return url;
                };

                const finalSrc = getDirectLink(imgUrl!);

                const customerDesc = r.product?.customer_description;
                return (
                    <div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {/* --- HEADER: Name + Tag --- */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <div style={{ fontWeight: 700, fontSize: 15, color: '#262626', lineHeight: 1.3 }}>
                                    {r.product_name_real || r.product?.name || r.sku}
                                </div>
                                {/* Auto-detect tags based on SKU or Type */}
                                {r.product?.product_type === 'COMBO' && <Tag color="geekblue" style={{ margin: 0, borderRadius: 4, fontSize: 10, fontWeight: 600 }}>COMBO</Tag>}
                                {(r.sku.includes('TUI') || r.sku.includes('PHU_KIEN')) && <Tag color="default" style={{ margin: 0, borderRadius: 4, fontSize: 10 }}>PHỤ KIỆN</Tag>}
                            </div>

                            {/* --- BODY: Description --- */}
                            {!customerDesc ? (
                                <div style={{ fontSize: 12, color: '#8c8c8c', fontStyle: 'italic' }}>Chưa có mô tả chi tiết</div>
                            ) : (
                                <div style={{ background: '#fff', padding: '4px 0' }}>
                                    {customerDesc.split('\n').map((line: string, idx: number) => {
                                        const cleanLine = line.trim();
                                        if (!cleanLine) return null;

                                        // Regex to capture Combo Item: "• Name (xQty) - [Desc]"
                                        const comboMatch = cleanLine.match(/^•\s*(.*?)\s*\(x([\d\.]+)\)(?:\s*-\s*(.*))?$/);

                                        if (comboMatch) {
                                            const [_, name, qty, trailingDesc] = comboMatch;
                                            return (
                                                <div key={idx} style={{ marginTop: idx > 0 ? 8 : 0, paddingTop: idx > 0 ? 8 : 0, borderTop: idx > 0 ? '1px dashed #e8e8e8' : 'none' }}>
                                                    {trailingDesc && (
                                                        <div style={{ paddingLeft: 16, marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                                            <span style={{ fontSize: 14, color: '#999', lineHeight: 1 }}>.</span>
                                                            <span style={{ fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 1.4 }}>{trailingDesc}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }

                                        // Regular line (or subsequent lines of a combo item description)
                                        return (
                                            <div key={idx} style={{ paddingLeft: 16, marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                                <span style={{ fontSize: 14, color: '#999', lineHeight: 1 }}>.</span>
                                                <span style={{ fontSize: 13, color: '#666', fontStyle: 'italic', lineHeight: 1.4 }}>{cleanLine.replace(/^[•-]\s*/, '')}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {data.status === 'QUOTATION' && r.price_ranges && Array.isArray(r.price_ranges) && r.price_ranges.length > 0 && (
                                <div style={{ marginTop: 6, padding: '6px 8px', background: '#fffbe6', border: '1px dashed #ffe58f', borderRadius: 4, display: 'inline-block' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#d46b08', marginBottom: 4 }}>🏷️ Tùy chọn mua nhiều:</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                        {r.price_ranges.map((pr: any, i: number) => (
                                            <Tag key={i} color="orange" style={{ margin: 0, fontSize: 12 }}>{pr.quantity} cái: {Number(pr.unit_price).toLocaleString()}đ/cái</Tag>
                                        ))}
                                    </div>
                                </div>
                            )}



                        </div>
                    </div>

                );
            }
        },
        {
            title: 'ĐVT',
            dataIndex: 'unit',
            width: 50,
            align: 'center' as const,
            render: (t: any, r: any) => <span style={{ color: '#666' }}>{r.product?.unit || 'Cái'}</span>
        },
        {
            title: 'SL',
            dataIndex: 'quantity',
            width: 50,
            align: 'center' as const,
            render: (v: any) => <b style={{ fontSize: 14 }}>{Number(v)}</b>
        },
        {
            title: 'Đơn Giá',
            dataIndex: 'unit_price',
            width: 90,
            align: 'right' as const,
            render: (v: any) => <span style={{ color: '#555' }}>{Number(v).toLocaleString()}</span>
        },
        {
            title: 'Thành Tiền',
            dataIndex: 'subtotal',
            width: 110,
            align: 'right' as const,
            render: (v: any) => <b style={{ fontSize: 14, color: '#1f1f1f' }}>{Number(v).toLocaleString()}</b>
        }
    ];

    return (
        <div style={{ background: '#f4f7f6', minHeight: '100vh', paddingBottom: 60, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial' }}>
            {/* --- HEADER --- */}
            <div style={{ background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 1000 }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '15px 20px' }}>
                    <Row justify="space-between" align="middle" gutter={[16, 16]}>
                        <Col>
                            <Space size={15} align="center">
                                {/* Place Logo Here if needed */}
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#1890ff', textTransform: 'uppercase', letterSpacing: 1 }}>ERP4U</div>
                                    <div style={{ fontSize: 12, color: '#999' }}>Cổng thông tin khách hàng</div>
                                </div>
                                <Divider type="vertical" style={{ height: 30 }} />
                                <div>
                                    <div style={{ fontSize: 12, color: '#888' }}>{isOrder ? 'Mã đơn hàng' : 'Mã báo giá'}</div>
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>#{data.order_code}</div>
                                </div>
                            </Space>
                        </Col>
                        <Col>
                            <Space>
                                <Button icon={<LinkOutlined />} onClick={() => { navigator.clipboard.writeText(window.location.href); message.success('Đã copy link!'); }}>Copy Link</Button>
                                <Dropdown menu={{
                                    items: [
                                        { key: 'standard', label: 'Mẫu công ty (B2B)', onClick: () => handlePrintOrder('standard') },
                                        { key: 'b2b_no_total', label: 'Mẫu B2B (Không tổng tiền)', onClick: () => handlePrintOrder('b2b_no_total') },
                                        { key: 'retail', label: 'Mẫu khách lẻ (Rút gọn)', onClick: () => handlePrintOrder('retail') },
                                        { key: 'pos', label: 'Mẫu POS (Hóa đơn dọc)', onClick: () => handlePrintOrder('pos') }
                                    ]
                                }}>
                                    <Button icon={<PrinterOutlined />}>{isOrder ? 'In Đơn Hàng (A4)' : 'In Báo Giá (A4)'}</Button>
                                </Dropdown>
                            </Space>
                        </Col>
                    </Row>
                </div>

                {!isMobile && (data.status === 'QUOTATION' || (data.is_design_order && data.status === 'DEMO_SENT')) && (
                    <div style={{ borderTop: '1px solid #f0f0f0', background: '#fff' }}>
                        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <InfoCircleOutlined style={{ color: '#faad14', fontSize: 18 }} />
                                <span style={{ fontSize: 14 }}>
                                    {data.is_design_order ? 'Vui lòng kiểm tra kỹ bản Demo thiết kế và phản hồi.' : `Vui lòng kiểm tra kỹ thông tin và phản hồi ${isOrder ? 'đơn hàng' : 'báo giá'} này.`}
                                </span>
                            </div>
                            <Space>
                                <Button danger size="large" onClick={() => handleAction('REJECT')}>Từ Chối</Button>
                                <Button type="primary" size="large" style={{ background: '#52c41a', borderColor: '#52c41a', boxShadow: '0 4px 10px rgba(82, 196, 26, 0.3)' }} onClick={() => handleAction('ACCEPT')}>
                                    {data.is_design_order ? 'Duyệt Demo Thiết Kế' : 'Xác Nhận Đồng Ý'}
                                </Button>
                            </Space>
                        </div>
                    </div>
                )}
            </div>

            {/* --- MOBILE FIXED BOTTOM ACTIONS --- */}
            {isMobile && (data.status === 'QUOTATION' || (data.is_design_order && data.status === 'DEMO_SENT')) && (
                <div style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0,
                    background: '#fff', padding: '12px 16px',
                    boxShadow: '0 -2px 10px rgba(0,0,0,0.1)', zIndex: 9999,
                    display: 'flex', gap: 10
                }}>
                    <Button danger size="large" block onClick={() => handleAction('REJECT')}>Từ Chối</Button>
                    <Button type="primary" size="large" block style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={() => handleAction('ACCEPT')}>Đồng Ý</Button>
                </div>
            )}

            {/* --- MAIN CONTENT --- */}
            <div style={{ maxWidth: 1200, margin: isMobile ? '16px auto' : '30px auto', padding: isMobile ? '0 12px' : '0 20px' }}>

                {/* STATUS BAR */}
                <Card bordered={false} style={{ marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
                    <Steps
                        current={currentStep}
                        size={isMobile ? "small" : "small"}
                        direction={isMobile ? "vertical" : "horizontal"} // <--- Vertical on Mobile
                        items={stepsItems}
                    />
                </Card>

                {/* --- INFO ROW: CUSTOMER / VAT / PAYMENT --- */}
                <Row gutter={24} style={{ marginBottom: 24 }}>
                    <Col xs={24} md={data.is_design_order ? 12 : 8}>
                        <Card title={<span><UserOutlined /> Thông Tin Khách Hàng</span>} bordered={false} style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
                            <Descriptions column={1} size="small" labelStyle={{ color: '#888' }} contentStyle={{ fontWeight: 500 }}>
                                <Descriptions.Item label="Đơn vị">{data.customer_name || data.customer?.name || 'Khách lẻ'}</Descriptions.Item>
                                {!data.is_design_order && <Descriptions.Item label="Người nhận">{data.receiver_name || data.customer?.contacts?.[0]?.full_name || data.customer?.name || '-'}</Descriptions.Item>}
                                <Descriptions.Item label="SĐT">{maskPhone(data.receiver_phone || data.customer?.contacts?.[0]?.phone || data.customer?.phone)}</Descriptions.Item>
                                {!data.is_design_order && <Descriptions.Item label="Địa chỉ">{data.shipping_address || data.customer?.address || '-'}</Descriptions.Item>}
                            </Descriptions>
                        </Card>
                    </Col>
                    
                    {/* Hide VAT and Payment info if it is a Design Order */}
                    {!data.is_design_order && (
                        <>
                        <Col xs={24} md={8}>
                            <Card title={<span><ShopOutlined /> Thông Tin Xuất Hóa Đơn</span>} bordered={false} style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
                                <Descriptions column={1} size="small" labelStyle={{ color: '#888' }} contentStyle={{ fontWeight: 500 }}>
                                    <Descriptions.Item label="Công ty">{data.customer?.legal_name || data.vat_company_name || data.customer?.name || '-'}</Descriptions.Item>
                                    <Descriptions.Item label="MST">{data.customer?.tax_code || data.vat_tax_code || '-'}</Descriptions.Item>
                                    <Descriptions.Item label="Địa chỉ">{data.customer?.legal_address || data.vat_address || data.customer?.address || '-'}</Descriptions.Item>
                                    {(data.vat_email || data.customer?.einvoice_email) && <Descriptions.Item label="Email nhận HĐ">{data.vat_email || data.customer.einvoice_email}</Descriptions.Item>}
                                    {data.vat_invoice_data && data.vat_invoice_data.invoiceNo ? (
                                        <>
                                            <Descriptions.Item label="Số HĐ">{data.vat_invoice_data.invoiceNo}</Descriptions.Item>
                                            <Descriptions.Item label="Mã tra cứu">{data.vat_invoice_data.lookupCode}</Descriptions.Item>
                                            <Descriptions.Item label="Ngày phát hành">{data.vat_invoice_data.issueDate}</Descriptions.Item>
                                            <Descriptions.Item label="Trạng thái">
                                                {data.vat_invoice_data.invoiceStatus === 0 && <Tag color="orange">Bản nháp</Tag>}
                                                {data.vat_invoice_data.invoiceStatus === 1 && <Tag color="blue">Đã ký</Tag>}
                                                {data.vat_invoice_data.invoiceStatus === 2 && <Tag color="green">Đã khai thuế</Tag>}
                                                {data.vat_invoice_data.invoiceStatus > 2 && <Tag color="red">Đã hủy/Thay thế</Tag>}
                                            </Descriptions.Item>
                                            {data.vat_invoice_data.linkView && (
                                                <Descriptions.Item label="Hóa đơn">
                                                    <Button
                                                        type="primary"
                                                        size="small"
                                                        icon={<FilePdfOutlined />}
                                                        onClick={() => window.open(data.vat_invoice_data.linkView, '_blank')}
                                                        style={{ padding: '0 12px' }}
                                                    >
                                                        Xem Hóa Đơn Điện Tử
                                                    </Button>
                                                </Descriptions.Item>
                                            )}
                                        </>
                                    ) : data.vat_invoice_link ? (
                                        <Descriptions.Item label="Hóa đơn">
                                            <Button
                                                type="link"
                                                size="small"
                                                icon={<FilePdfOutlined />}
                                                onClick={() => window.open(data.vat_invoice_link, '_blank')}
                                                style={{ padding: 0 }}
                                            >
                                                Xem/Tải Hóa Đơn
                                            </Button>
                                        </Descriptions.Item>
                                    ) : (
                                        <Descriptions.Item label="Hóa đơn">
                                            <span style={{ color: '#aaa', fontStyle: 'italic' }}>Chưa xuất hóa đơn</span>
                                        </Descriptions.Item>
                                    )}
                                </Descriptions>
                            </Card>
                        </Col>
                        <Col xs={24} md={8}>
                            <Card title={<span><CreditCardOutlined /> Thông Tin Thanh Toán</span>} bordered={false} style={{ height: '100%', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
                            {/* DEPOSIT REQUIREMENT */}
                            {Number(data.deposit_amount) > 0 && (
                                <div style={{ background: '#f9f0ff', padding: 10, borderRadius: 8, border: '1px solid #d3adf7', textAlign: 'center', marginBottom: 10 }}>
                                    <div style={{ color: '#722ed1', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>💰 Cần đặt cọc ({data.deposit_percent || 0}%)</div>
                                    <div style={{ fontSize: 18, fontWeight: '700', color: '#531dab' }}>{Number(data.deposit_amount).toLocaleString()} ₫</div>
                                </div>
                            )}

                            {Number(data.paid_amount) > 0 && (
                                <div style={{ background: '#f0f5ff', padding: 8, borderRadius: 8, border: '1px solid #adc6ff', textAlign: 'center', marginBottom: 8 }}>
                                    <div style={{ color: '#2f54eb', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Đã thanh toán</div>
                                    <div style={{ fontSize: 18, fontWeight: '700', color: '#1d39c4' }}>{Number(data.paid_amount).toLocaleString()} ₫</div>
                                </div>
                            )}

                            <div style={{ background: '#f6ffed', padding: 10, borderRadius: 8, border: '1px solid #b7eb8f', textAlign: 'center', marginBottom: 10 }}>
                                <div style={{ color: '#52c41a', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Cần thanh toán</div>
                                <div style={{ fontSize: 20, fontWeight: '800', color: '#389e0d' }}>{(Number(data.total_amount) - Number(data.paid_amount)).toLocaleString()} ₫</div>
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                                <div><b>ACB - TP.HCM</b></div>
                                <div>STK: <span style={{ fontFamily: 'monospace', background: '#f0f0f0', padding: '0 4px' }}>141847859</span></div>
                                <div>Chủ TK: CTY TNHH TM DV TƯỜNG LINH</div>
                                <div>Nội dung: <b>{data.order_code}</b></div>
                            </div>
                        </Card>
                    </Col>
                    </>
                    )}
                </Row>

                {/* --- DETAILS ROW: TABLE --- */}
                <Row gutter={24}>
                    <Col span={24}>
                        <Card title={<span style={{ fontWeight: 700, fontSize: 16 }}>{data.is_design_order ? '📋 Chi Tiết Đơn Thiết Kế & Bản Demo' : (isOrder ? '📋 Chi Tiết Đơn Hàng' : '📋 Chi Tiết Báo Giá')}</span>} bordered={false} style={{ marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>

                            {isMobile || data.is_design_order ? (
                                // MOBILE LIST VIEW or DESIGN ORDER VIEW
                                <List
                                    dataSource={data.items}
                                    rowKey="id"
                                    renderItem={(item: any, index: number) => {
                                        // Re-use logic for image
                                        // Fix: Check item.image_url first (Snapshot/Custom Link), then sample_image, then product.image_url
                                        const rawUrl = item.image_url || item.sample_image || item.product?.image_url;
                                        let finalSrc = rawUrl;
                                        let isImage = false;

                                        if (rawUrl && rawUrl.includes('drive.google.com')) {
                                            let id = '';
                                            try {
                                                const urlObj = new URL(rawUrl);
                                                if (urlObj.pathname.includes('/d/')) {
                                                    const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                                                    if (match && match[1]) id = match[1];
                                                } else if (urlObj.searchParams.has('id')) {
                                                    id = urlObj.searchParams.get('id') || '';
                                                }
                                            } catch (e) {
                                                const match = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
                                                if (match && match[1]) id = match[1];
                                            }

                                            if (id) {
                                                finalSrc = `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
                                                isImage = true;
                                            }
                                        } else if (rawUrl && rawUrl.includes('googleusercontent.com')) { isImage = true; }
                                        else if (rawUrl && (rawUrl.match(/\.(jpeg|jpg|gif|png|webp|bmp)(?:\?.*)?$/i) || rawUrl.startsWith('data:image'))) {
                                            if (!rawUrl.startsWith('http') && !rawUrl.startsWith('data:')) finalSrc = `${API_URL}${rawUrl}`;
                                            isImage = true;
                                        }

                                        return (
                                            <Card
                                                size="small"
                                                style={{ marginBottom: 16, borderRadius: 12, border: '1px solid #f0f0f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
                                                bodyStyle={{ padding: 16 }}
                                            >
                                                <div style={{ display: 'flex', gap: 16 }}>
                                                    {/* Image */}
                                                    <div style={{ width: 100, height: 100, flexShrink: 0, borderRadius: 8, overflow: 'hidden', border: '1px solid #e8e8e8', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                                                        {isImage ? (
                                                            <Watermark {...getWatermarkProps('rgba(0,0,0,0.15)', 10)}>
                                                                <img
                                                                    src={finalSrc} alt="prod"
                                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', cursor: 'pointer' }}
                                                                    onClick={() => handlePreview(finalSrc)}
                                                                />
                                                            </Watermark>
                                                        ) : <div style={{ width: '100%', height: '100%', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}><ShopOutlined /></div>}
                                                    </div>

                                                    {/* Content */}
                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                                        <div style={{ fontWeight: 700, fontSize: 15, color: '#1f1f1f', marginBottom: 6, lineHeight: 1.4 }}>
                                                            {item.vat_content || item.product_name_real || item.product?.name || item.sku}
                                                        </div>
                                                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                            {item.sku && <Tag bordered={false} color="default" style={{ margin: 0, fontSize: 11, background: '#f5f5f5' }}>{item.sku}</Tag>}
                                                            {item.variant_color && <Tag bordered={false} color="processing" style={{ margin: 0, fontSize: 11 }}>Màu: {item.variant_color}</Tag>}
                                                        </div>
                                                        
                                                        {item.product?.customer_description && (
                                                            <div style={{ background: '#f9f9f9', padding: '8px 10px', borderRadius: 8, fontSize: 12, color: '#595959', marginBottom: 12, border: '1px solid #f0f0f0' }}>
                                                                {item.product.customer_description.split('\n').map((line: string, idx: number) => {
                                                                    const cleanLine = line.trim();
                                                                    if (!cleanLine) return null;
                                                                    return (
                                                                        <div key={idx} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
                                                                            <span style={{ color: '#bfbfbf', fontSize: 14, lineHeight: 1.2 }}>•</span>
                                                                            <span style={{ lineHeight: 1.4 }}>{cleanLine.replace(/^[•-]\s*/, '')}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}

                                                        {data.status === 'QUOTATION' && item.price_ranges && Array.isArray(item.price_ranges) && item.price_ranges.length > 0 && (
                                                            <div style={{ marginBottom: 12, padding: '8px 10px', background: '#fffbe6', border: '1px dashed #ffe58f', borderRadius: 8 }}>
                                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#d48806', marginBottom: 6 }}>🏷️ Tùy chọn mua nhiều:</div>
                                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                                    {item.price_ranges.map((pr: any, i: number) => (
                                                                        <Tag key={i} color="warning" bordered={false} style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>{pr.quantity} cái: {Number(pr.unit_price).toLocaleString()}đ/c</Tag>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        <div style={{ marginTop: 'auto' }}>
                                                            {!data.is_design_order && (
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0f5ff', padding: '10px 12px', borderRadius: 8, border: '1px solid #d6e4ff' }}>
                                                                    <div style={{ fontSize: 13, color: '#555' }}>
                                                                        <span style={{ fontSize: 16, fontWeight: 800, color: '#1d39c4' }}>{Number(item.quantity)}</span> <span style={{ color: '#8c8c8c', margin: '0 4px' }}>x</span> <span style={{ fontWeight: 600 }}>{Number(item.unit_price).toLocaleString()}</span>
                                                                    </div>
                                                                    <div style={{ fontWeight: 800, fontSize: 16, color: '#cf1322' }}>
                                                                        {Number(item.subtotal).toLocaleString()}₫
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {item.customer_note && (
                                                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #f0f0f0', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                        <PushpinOutlined style={{ color: '#faad14', marginTop: 2 }} />
                                                        <div style={{ fontSize: 12, color: '#d48806', fontStyle: 'italic', flex: 1, whiteSpace: 'pre-wrap' }}>
                                                            {item.customer_note}
                                                        </div>
                                                    </div>
                                                )}
                                            </Card>
                                        );
                                    }}
                                />
                            ) : (
                                // DESKTOP TABLE VIEW
                                <Table
                                    dataSource={data.items}
                                    columns={columns}
                                    rowKey="id"
                                    pagination={false}
                                    bordered={false}
                                    scroll={{ x: '100%' }}
                                    className="quote-table"
                                    summary={() => {
                                        // Summary handled below for B2B portal desktop view.
                                        const vatRate = data.vat_rate || 0;
                                        const subTotal = data.items.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
                                        const discountAmount = Number(data.discount_amount || 0);
                                        const taxable = Math.max(0, subTotal - discountAmount);
                                        const vatAmount = Math.round(taxable * (vatRate / 100));
                                        const total = taxable + vatAmount + Number(data.shipping_fee || 0);

                                        return (
                                            <Table.Summary fixed>
                                                <Table.Summary.Row>
                                                    <Table.Summary.Cell index={0} colSpan={7} align="right"><span style={{ color: '#888' }}>Tổng tiền hàng</span></Table.Summary.Cell>
                                                    <Table.Summary.Cell index={1} align="right"><b>{subTotal.toLocaleString()}</b></Table.Summary.Cell>
                                                </Table.Summary.Row>
                                                {discountAmount > 0 && (
                                                    <Table.Summary.Row>
                                                        <Table.Summary.Cell index={0} colSpan={7} align="right"><span style={{ color: '#888' }}>Giảm giá ({data.discount_rate}%)</span></Table.Summary.Cell>
                                                        <Table.Summary.Cell index={1} align="right"><span style={{ color: '#52c41a' }}>-{discountAmount.toLocaleString()}</span></Table.Summary.Cell>
                                                    </Table.Summary.Row>
                                                )}
                                                <Table.Summary.Row>
                                                    <Table.Summary.Cell index={0} colSpan={7} align="right"><span style={{ color: '#888' }}>Thuế GTGT ({vatRate}%)</span></Table.Summary.Cell>
                                                    <Table.Summary.Cell index={1} align="right">{vatAmount.toLocaleString()}</Table.Summary.Cell>
                                                </Table.Summary.Row>
                                                <Table.Summary.Row>
                                                    <Table.Summary.Cell index={0} colSpan={7} align="right"><span style={{ color: '#888' }}>Phí vận chuyển</span></Table.Summary.Cell>
                                                    <Table.Summary.Cell index={1} align="right">{Number(data.shipping_fee || 0).toLocaleString()}</Table.Summary.Cell>
                                                </Table.Summary.Row>
                                                <Table.Summary.Row style={{ background: '#fafafa' }}>
                                                    <Table.Summary.Cell index={0} colSpan={7} align="right"><b style={{ fontSize: 18, color: '#1890ff' }}>TỔNG CỘNG</b></Table.Summary.Cell>
                                                    <Table.Summary.Cell index={1} align="right"><b style={{ fontSize: 20, color: '#cf1322' }}>{total.toLocaleString()} ₫</b></Table.Summary.Cell>
                                                </Table.Summary.Row>
                                            </Table.Summary>
                                        );
                                    }}
                                />
                            )}

                            {/* MOBILE SUMMARY BLOCK (Since Table Summary won't show in List) */}
                            {isMobile && !data.is_design_order && (() => {
                                const subTotal = data.items.reduce((sum: number, item: any) => sum + Number(item.subtotal), 0);
                                const discountAmount = Number(data.discount_amount || 0);
                                const vatRate = data.vat_rate || 0;
                                const taxable = Math.max(0, subTotal - discountAmount);
                                const vatAmount = Math.round(taxable * (vatRate / 100));
                                const total = taxable + vatAmount + Number(data.shipping_fee || 0);

                                return (
                                    <div style={{ background: '#fff', padding: 16, borderRadius: 12, marginTop: 16, border: '1px solid #f0f0f0', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                                            <span style={{ color: '#8c8c8c' }}>Tổng tiền hàng</span>
                                            <span style={{ fontWeight: 600, color: '#262626' }}>{subTotal.toLocaleString()}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                                                <span style={{ color: '#8c8c8c' }}>Giảm giá ({data.discount_rate}%)</span>
                                                <span style={{ fontWeight: 600, color: '#52c41a' }}>-{discountAmount.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                                            <span style={{ color: '#8c8c8c' }}>Thuế GTGT ({vatRate}%)</span>
                                            <span style={{ fontWeight: 600, color: '#262626' }}>{vatAmount.toLocaleString()}</span>
                                        </div>
                                        {Number(data.shipping_fee || 0) > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
                                                <span style={{ color: '#8c8c8c' }}>Phí vận chuyển</span>
                                                <span style={{ fontWeight: 600, color: '#262626' }}>{Number(data.shipping_fee).toLocaleString()}</span>
                                            </div>
                                        )}
                                        <Divider style={{ margin: '12px 0' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 800, fontSize: 16, color: '#1890ff' }}>TỔNG CỘNG</span>
                                            <span style={{ fontWeight: 800, fontSize: 20, color: '#cf1322' }}>
                                                {total.toLocaleString()} ₫
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Note - below items table */}
                            {data.note && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 20, background: '#fff7e6', padding: 15, borderRadius: 8, border: '1px solid #ffec3d' }}>
                                    <InfoCircleOutlined style={{ color: '#faad14', marginTop: 4 }} />
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#d48806', marginBottom: 5 }}>Ghi chú từ người bán:</div>
                                        <div style={{ color: '#595959', whiteSpace: 'pre-line' }}>{data.note}</div>
                                    </div>
                                </div>
                            )}

                            {/* Terms */}
                            {data.terms_content && (
                                <div style={{ marginTop: 30, background: '#f9f9f9', padding: '20px', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                    <div style={{ fontWeight: 700, marginBottom: 10, textTransform: 'uppercase', fontSize: 12, color: '#999' }}>Điều khoản & Quy định</div>
                                    <div style={{ whiteSpace: 'pre-line', fontSize: 13, color: '#555', lineHeight: 1.6 }}>{data.terms_content}</div>
                                </div>
                            )}

                            {/* SAMPLE IMAGES SLIDESHOW */}
                            {data.approved_sample_images && data.approved_sample_images.length > 0 && (
                                <div style={{ marginTop: 30, background: '#f0f5ff', padding: '20px', borderRadius: 8, border: '1px solid #adc6ff' }}>
                                    <div style={{ fontWeight: 700, marginBottom: 15, fontSize: 14, color: '#1d39c4', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <EyeOutlined /> Mẫu Sản Xuất Đã Duyệt
                                    </div>
                                    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10 }}>
                                        {data.approved_sample_images.map((url: string, index: number) => {
                                            // Convert Google Drive URLs
                                            let imgSrc = url;
                                            const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
                                            if (driveMatch) {
                                                imgSrc = `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1000`;
                                            }
                                            const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
                                            if (openMatch) {
                                                imgSrc = `https://drive.google.com/thumbnail?id=${openMatch[1]}&sz=w1000`;
                                            }
                                            return (
                                                <div
                                                    key={index}
                                                    style={{
                                                        width: isMobile ? 200 : 250,
                                                        height: isMobile ? 150 : 200,
                                                        flexShrink: 0,
                                                        borderRadius: 8,
                                                        overflow: 'hidden',
                                                        background: '#fff',
                                                        border: '2px solid #91caff',
                                                        cursor: 'pointer'
                                                    }}
                                                    onClick={() => handlePreview(imgSrc)}
                                                >
                                                    <Watermark {...getWatermarkProps('rgba(0,0,0,0.2)', 16)}>
                                                        <img
                                                            src={imgSrc}
                                                            alt={`Mẫu ${index + 1}`}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                target.style.display = 'none';
                                                                if (target.parentElement && target.parentElement.parentElement) {
                                                                    target.parentElement.parentElement.innerHTML = '<div style="color:#999;text-align:center;padding:20px;font-size:12px;">⚠️ Lỗi tải hình</div>';
                                                                }
                                                            }}
                                                        />
                                                    </Watermark>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ fontSize: 12, color: '#597ef7', marginTop: 5, textAlign: 'center' }}>
                                        {data.approved_sample_images.length} hình mẫu • Click để xem lớn
                                    </div>
                                </div>
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* --- CONTRACT SECTION --- */}
                {data.contract_html && data.contract_status !== 'DRAFT' && data.contract_variables?.is_contract_visible !== false && (
                    <Row gutter={24} style={{ marginBottom: 24 }}>
                        <Col span={24}>
                            <Card
                                title={<span style={{ fontWeight: 700, fontSize: 16 }}><SolutionOutlined /> Nội Dung Hợp Đồng / Biên Bản</span>}
                                bordered={false}
                                style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}
                                extra={
                                    <Button type="primary" icon={<SendOutlined />} onClick={() => {
                                        const el = document.getElementById('thao-luan-section');
                                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                                    }}>
                                        Ghi chú / Phản hồi
                                    </Button>
                                }
                            >
                                <div style={{
                                    background: '#fff',
                                    padding: isMobile ? '15px' : '40px 60px',
                                    maxHeight: '600px',
                                    overflowY: 'auto',
                                    border: '1px solid #d9d9d9',
                                    borderRadius: 8,
                                    fontFamily: '"Times New Roman", Times, serif',
                                    fontSize: '12pt',
                                    lineHeight: 1.5,
                                    color: '#000'
                                }} dangerouslySetInnerHTML={{ __html: fixContractImageUrls(data.contract_html) }} />
                            </Card>
                        </Col>
                    </Row>
                )}

                {/* --- BOTTOM ROW: COMMENTS & HISTORY --- */}
                <Row gutter={24}>
                    <Col xs={24} md={12} id="thao-luan-section">
                        <Card title="💬 Thảo Luận" bordered={false} bodyStyle={{ padding: 0 }} style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12, overflow: 'hidden', height: '100%' }}>
                            <div style={{ height: 300, overflowY: 'auto', padding: 20, background: '#f9f9f9' }}>
                                <List dataSource={visibleComments} renderItem={(item: any) => (
                                    <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexDirection: item.sender_type === 'CUSTOMER' ? 'row-reverse' : 'row' }}>
                                        <Avatar style={{ backgroundColor: item.sender_type === 'CUSTOMER' ? '#87d068' : '#1890ff' }} icon={item.sender_type === 'CUSTOMER' ? <UserOutlined /> : <SolutionOutlined />} />
                                        <div style={{ maxWidth: '80%' }}>
                                            <div style={{ fontSize: 11, color: '#999', marginBottom: 2, textAlign: item.sender_type === 'CUSTOMER' ? 'right' : 'left' }}>
                                                {item.sender_name} • {dayjs(item.created_at).format('HH:mm DD/MM')}
                                            </div>
                                            <div style={{
                                                padding: '8px 12px',
                                                background: item.sender_type === 'CUSTOMER' ? '#d9f7be' : '#fff',
                                                borderRadius: 8,
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                color: '#333',
                                                position: 'relative'
                                            }}>
                                                <div dangerouslySetInnerHTML={{ __html: item.content }} />
                                                {item.sender_type === 'CUSTOMER' && (
                                                    <Button
                                                        type="text"
                                                        size="small"
                                                        danger
                                                        onClick={() => handleDeleteComment(item.id)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: -8,
                                                            right: -8,
                                                            background: '#fff',
                                                            borderRadius: '50%',
                                                            padding: '2px 6px',
                                                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                                                            fontSize: 10
                                                        }}
                                                    >
                                                        Thu hồi
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )} />
                                {visibleComments.length === 0 && <Empty description="Chưa có tin nhắn nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
                            </div>
                            <div style={{ padding: 15, background: '#fff', borderTop: '1px solid #f0f0f0' }}>
                                <div style={{ display: 'flex', gap: 10 }}>
                                    <ReactQuill
                                        theme="snow"
                                        value={commentText}
                                        onChange={setCommentText}
                                        placeholder="Nhập tin nhắn..."
                                        style={{ background: 'white', flex: 1 }}
                                        modules={{
                                            toolbar: [
                                                ['bold', 'italic', 'underline'],
                                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                ['clean']
                                            ]
                                        }}
                                    />
                                    <Button type="primary" icon={<SendOutlined />} onClick={handleSendComment} />
                                </div>
                            </div>
                        </Card>
                    </Col>

                    <Col xs={24} md={12}>
                        {/* --- DELIVERY HISTORY --- */}
                        {data.deliveries && data.deliveries.length > 0 && (
                            <Card title={<span><CarOutlined /> Lịch Sử Giao Hàng</span>} size="small" style={{ marginBottom: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
                                {isMobile ? (
                                    <List dataSource={data.deliveries} renderItem={(r: any) => (
                                        <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <span style={{ fontWeight: 700, color: '#1890ff' }}>{r.code}</span>
                                                <span style={{ fontSize: 12, color: '#999' }}>{dayjs(r.delivery_date).format('DD/MM/YY')}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                <Tag color={r.status === 'SHIPPED' ? 'green' : 'orange'}>{r.status === 'SHIPPED' ? 'Đã Giao' : 'Đang Giao'}</Tag>
                                            </div>
                                            <div style={{ background: '#fafafa', padding: 8, borderRadius: 4, fontSize: 12 }}>
                                                {r.items?.map((item: any, idx: number) => {
                                                    const p = data.items.find((x: any) => x.sku === item.sku);
                                                    const name = p ? (p.product_name_real || p.product?.name) : item.sku;
                                                    return (
                                                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>{name}</span>
                                                            <b>x{item.quantity}</b>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <div style={{ marginTop: 8, fontSize: 12, color: '#555' }}>
                                                <div><UserOutlined /> {r.contact_name || '-'} {r.contact_phone ? `- ${r.contact_phone}` : ''}</div>
                                                <div style={{ color: '#888', marginTop: 2 }}>📍 {r.delivery_address || '-'}</div>
                                            </div>
                                        </div>
                                    )} />
                                ) : (
                                    <Table
                                        dataSource={data.deliveries}
                                        rowKey="id"
                                        pagination={false}
                                        size="small"
                                        columns={[
                                            { title: 'Ngày', width: 90, align: 'center', render: (r: any) => dayjs(r.delivery_date).format('DD/MM/YY') },
                                            { title: 'Mã Phiếu', width: 100, dataIndex: 'code', render: (t: string) => <div style={{ fontWeight: 700, color: '#1890ff' }}>{t}</div> },
                                            {
                                                title: 'Trạng thái', width: 90, align: 'center',
                                                render: (r: any) => (
                                                    <Tag color={r.status === 'SHIPPED' ? 'green' : 'orange'}>
                                                        {r.status === 'SHIPPED' ? 'Đã Giao' : 'Đang Giao'}
                                                    </Tag>
                                                )
                                            },
                                            {
                                                title: 'Giao hàng', width: 220,
                                                render: (r: any) => (
                                                    <div style={{ fontSize: 12, color: '#555' }}>
                                                        <div><UserOutlined /> {r.contact_name || '-'} {r.contact_phone ? `- ${r.contact_phone}` : ''}</div>
                                                        <div style={{ color: '#888', marginTop: 2 }}>📍 {r.delivery_address || '-'}</div>
                                                    </div>
                                                )
                                            },
                                            {
                                                title: 'Chi tiết sản phẩm',
                                                render: (r: any) => (
                                                    <div style={{ fontSize: 12 }}>
                                                        {r.items?.map((item: any, idx: number) => {
                                                            const p = data.items.find((x: any) => x.sku === item.sku);
                                                            const name = p ? (p.product_name_real || p.product?.name) : item.sku;
                                                            return (
                                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed #f0f0f0', padding: '3px 0' }}>
                                                                    <span style={{ color: '#444', marginRight: 5 }}>{name}</span>
                                                                    <b>x{item.quantity}</b>
                                                                </div>
                                                            );
                                                        })}
                                                        {r.note && <div style={{ color: '#999', fontStyle: 'italic', marginTop: 4 }}>Example: {r.note}</div>}
                                                    </div>
                                                )
                                            },
                                        ]}
                                    />
                                )}
                            </Card>
                        )}

                        {/* --- PAYMENT HISTORY & QR --- */}
                        <Card title={<span><DollarOutlined /> Thanh Toán & Lịch Sử</span>} size="small" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
                            <div style={{ textAlign: 'center', marginBottom: 20, padding: 10, background: '#fcfcfc', borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Quét mã để thanh toán</div>
                                {(() => {
                                    const totalAmount = Number(data.total_amount) || 0;
                                    const depositAmount = Number(data.deposit_amount) || 0;
                                    const paidAmount = Number(data.paid_amount) || 0;
                                    const remaining = totalAmount - paidAmount;

                                    let qrAmount = totalAmount;
                                    if (depositAmount > 0 && paidAmount === 0) {
                                        qrAmount = depositAmount;
                                    } else if (paidAmount > 0) {
                                        qrAmount = remaining > 0 ? remaining : 0;
                                    }
                                    
                                    const sellerBankName = data.company_info?.COMPANY_BANK_NAME || 'ACB - TP.HCM';
                                    const sellerBankAccount = data.company_info?.COMPANY_BANK_ACCOUNT || '141847859';
                                    const sellerBankHolder = data.company_info?.COMPANY_BANK_HOLDER || 'CTY TNHH TM DV TUONG LINH';
                                    const rawBankCode = getVietQRBankCode(sellerBankName);
                                    
                                    return (
                                        <img src={`https://img.vietqr.io/image/${rawBankCode}-${sellerBankAccount}-compact2.jpg?amount=${Math.floor(qrAmount)}&addInfo=${data.order_code}&accountName=${encodeURIComponent(sellerBankHolder)}`} alt="VietQR" style={{ width: 160 }} />
                                    );
                                })()}
                            </div>

                            <Divider orientation="left" style={{ fontSize: 12, color: '#bbb' }}>Chi tiết giao dịch</Divider>

                            {data.payments && data.payments.length > 0 ? (
                                isMobile ? (
                                    <List dataSource={data.payments} renderItem={(r: any) => {
                                        let text = r.type === 'INCOME' ? 'Thanh toán' : 'Hoàn tiền';
                                        let color = r.type === 'INCOME' ? 'success' : 'red';
                                        let desc = r.description || '';
                                        const match = desc.match(/^\[(.*?)\]/);
                                        if (match) {
                                            text = match[1]; desc = desc.replace(match[0], '').trim();
                                            if (text.includes('ĐẶT CỌC')) color = 'orange';
                                            if (text.includes('TẤT TOÁN')) color = 'blue';
                                        }
                                        return (
                                            <div style={{ padding: '8px 0', borderBottom: '1px dashed #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: 12, color: '#999' }}>{dayjs(r.date).format('DD/MM/YYYY')}</div>
                                                    <div><Tag color={color}>{text}</Tag></div>
                                                    {desc && <div style={{ fontSize: 11, color: '#666' }}>{desc}</div>}
                                                </div>
                                                <div style={{ fontWeight: 700, fontSize: 14 }}>{Number(r.amount).toLocaleString()}</div>
                                            </div>
                                        )
                                    }} />
                                ) : (
                                    <Table
                                        dataSource={data.payments}
                                        rowKey="id"
                                        pagination={false}
                                        size="small"
                                        columns={[
                                            { title: 'Ngày', render: (r: any) => dayjs(r.date).format('DD/MM/YYYY') },
                                            {
                                                title: 'Loại',
                                                render: (r: any) => {
                                                    let text = r.type === 'INCOME' ? 'Thanh toán' : 'Hoàn tiền';
                                                    let color = r.type === 'INCOME' ? 'success' : 'red';
                                                    let desc = r.description || '';

                                                    // Try to parse [TYPE] from description (saved in SalesPayments.tsx)
                                                    // Format: [ĐẶT CỌC] Note...
                                                    const match = desc.match(/^\[(.*?)\]/);
                                                    if (match) {
                                                        text = match[1]; // e.g. "ĐẶT CỌC", "TẤT TOÁN"
                                                        desc = desc.replace(match[0], '').trim();
                                                        if (text.includes('ĐẶT CỌC')) color = 'orange';
                                                        if (text.includes('TẤT TOÁN')) color = 'blue';
                                                        if (text.includes('THANH TOÁN')) color = 'green';
                                                    }

                                                    return (
                                                        <div>
                                                            <Tag color={color}>{text}</Tag>
                                                            {desc && <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{desc}</div>}
                                                        </div>
                                                    );
                                                }
                                            },
                                            { title: 'Số tiền', align: 'right', render: (r: any) => <b>{Number(r.amount).toLocaleString()}</b> },
                                        ]}
                                    />
                                )
                            ) : (
                                <Empty description="Chưa có giao dịch nào" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                            )}
                        </Card>
                    </Col>
                </Row>

                {/* --- VIEW LOGS --- */}
                {isAdmin && data.portal_view_logs && data.portal_view_logs.length > 0 && (
                    <Row gutter={24} style={{ marginTop: 20 }}>
                        <Col span={24}>
                            <Card title={<span><EyeOutlined /> Thống Kê Lượt Xem Portal</span>} size="small" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 12 }}>
                                <Table
                                    dataSource={data.portal_view_logs.slice().reverse()}
                                    rowKey={(r: any) => r.viewed_at + r.ip}
                                    pagination={{ pageSize: 5, hideOnSinglePage: true }}
                                    size="small"
                                    columns={[
                                        { title: 'Thời gian', dataIndex: 'viewed_at', width: 130, render: (t) => <span style={{ color: '#888' }}>{dayjs(t).format('HH:mm DD/MM/YYYY')}</span> },
                                        { title: 'IP', dataIndex: 'ip', width: 140, render: (ip) => <Tag color="default">{ip}</Tag> },
                                        { title: 'Thiết bị', dataIndex: 'device', width: 100, render: (d) => <Tag color={d === 'Mobile' ? 'blue' : 'green'}>{d}</Tag> },
                                        { title: 'Trình duyệt', dataIndex: 'browser', width: 120 },
                                        { title: 'User Agent', dataIndex: 'user_agent', render: (ua) => <div style={{ fontSize: 11, color: '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }} title={ua}>{ua}</div> }
                                    ]}
                                />
                            </Card>
                        </Col>
                    </Row>
                )}

            </div>

            <div style={{ textAlign: 'center', padding: '20px 0', color: '#ccc', fontSize: 12 }}>
                Powered by ERP4U Technology
            </div>

            <Modal
                open={previewVisible}
                footer={null}
                onCancel={() => setPreviewVisible(false)}
                width={800}
                centered
                styles={{ body: { padding: 0, background: 'transparent' } }}
                closeIcon={<span style={{ color: '#fff', fontSize: 20 }}>×</span>}
            >
                {previewImage && (
                    <Watermark {...getWatermarkProps('rgba(255,255,255,0.3)', 32)}>
                        <img
                            alt="preview"
                            style={{ width: '100%', borderRadius: 8, display: 'block' }}
                            src={previewImage}
                        />
                    </Watermark>
                )}
            </Modal>
            <Modal
                title="Xác thực thông tin"
                visible={isVerifyModalOpen}
                onOk={handleVerifyAndAccept}
                onCancel={() => setIsVerifyModalOpen(false)}
                okText="Xác nhận & Đặt cọc"
                cancelText="Hủy"
            >
                <div>
                    <p>Vui lòng nhập <b>Số điện thoại</b> hoặc <b>Email</b> của bạn để xác nhận {isOrder ? 'đơn hàng' : 'báo giá'} này.</p>
                    <Input
                        placeholder="Nhập SĐT hoặc Email..."
                        value={verifyInput}
                        onChange={e => setVerifyInput(e.target.value)}
                        onPressEnter={handleVerifyAndAccept}
                    />
                </div>
            </Modal>
        </div >
    );
};

export default PortalQuotePage;