import dayjs from 'dayjs';
import { API_URL } from '../config';

export function formatVNDAmountWords(num: number): string {
    if (!num || num === 0) return 'Không đồng./';
    const ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
    const blocks = ['', 'ngàn', 'triệu', 'tỷ', 'ngàn tỷ', 'triệu tỷ'];
    const nAbs = Math.floor(Math.abs(num));
    let n = nAbs;

    function readGroup(group: number, showZeroHundred: boolean): string {
        const h = Math.floor(group / 100);
        const t = Math.floor((group % 100) / 10);
        const o = group % 10;
        let res = '';
        if (h > 0 || showZeroHundred) {
            res += ones[h] + ' trăm ';
        }
        if (t === 0 && o > 0) {
            if (h > 0 || showZeroHundred) res += 'lẻ ';
            res += ones[o];
        } else if (t === 1) {
            res += 'mười ';
            if (o === 5) res += 'lăm';
            else if (o > 0) res += ones[o];
        } else if (t > 1) {
            res += tens[t] + ' ';
            if (o === 1) res += 'mốt';
            else if (o === 5) res += 'lăm';
            else if (o > 0) res += ones[o];
        }
        return res.trim();
    }

    const groups: number[] = [];
    while (n > 0) {
        groups.push(n % 1000);
        n = Math.floor(n / 1000);
    }

    const words: string[] = [];
    for (let i = groups.length - 1; i >= 0; i--) {
        const g = groups[i];
        if (g > 0) {
            const showZeroHundred = i < groups.length - 1;
            const gText = readGroup(g, showZeroHundred);
            if (gText) {
                words.push(gText + (blocks[i] ? ' ' + blocks[i] : ''));
            }
        }
    }

    let result = words.join(' ').trim() + ' đồng./';
    result = result.replace(/\s+/g, ' ');
    return result.charAt(0).toUpperCase() + result.slice(1);
}

export interface PrintPaymentRequestOptions {
    order?: any;
    orderCode: string;
    customerName?: string;
    requesterName?: string;
    paymentAmount: number;
    paymentDate?: string | Date;
    paymentNote?: string;
    companyConfig?: any;
    mode: 'pdf' | 'print'; // 'pdf' = Mẫu 1 (có mộc + chữ ký GĐ, ko chữ ký NV), 'print' = Mẫu 2 (chỉ có tên, ko mộc, ko chữ ký)
}

export const handlePrintPaymentRequest = (options: PrintPaymentRequestOptions) => {
    const {
        order,
        orderCode,
        customerName: initialCustomerName,
        requesterName: initialRequesterName,
        paymentAmount,
        paymentDate,
        paymentNote,
        companyConfig,
        mode
    } = options;

    const w = window.open('', '_blank');
    if (!w) {
        alert('Vui lòng cho phép trình duyệt mở cửa sổ popup để in hoặc xuất PDF.');
        return;
    }

    // 1. Company Info
    const companyName = companyConfig?.COMPANY_NAME || 'CÔNG TY TNHH TM DV TƯỜNG LINH';
    const companyAddress = companyConfig?.COMPANY_ADDRESS || '74/21/24 Nguyễn Khuyến, Phường 12, Quận Bình Thạnh, Tp. Hồ Chí Minh.';
    const directorName = companyConfig?.COMPANY_REPRESENTATIVE || 'PHẠM THU HẰNG';

    // 2. Bank Info
    const bankHolder = companyConfig?.COMPANY_BANK_HOLDER || 'CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ TƯỜNG LINH';
    const bankAccount = companyConfig?.COMPANY_BANK_ACCOUNT || '141847859';
    const bankName = companyConfig?.COMPANY_BANK_NAME || 'Ngân Hàng TM CP Á Châu (ACB)';

    // 3. Customer Name
    const customerDisplayName = order?.vat_company_name 
        || order?.customer?.company_name 
        || order?.customer?.name 
        || order?.customer_name 
        || initialCustomerName 
        || 'CÔNG TY TNHH MEG VIETNAM';

    // 4. Sales / Requester Name
    const requesterDisplayName = order?.assigned_to?.full_name 
        || order?.assigned_to?.name 
        || order?.created_by?.full_name 
        || order?.created_by?.name 
        || initialRequesterName 
        || 'ĐẶNG HOÀNG DIỆU ÁI';

    // 5. Payment Date
    const d = paymentDate ? dayjs(paymentDate) : dayjs();
    const dayStr = d.format('DD');
    const monthStr = d.format('MM');
    const yearStr = d.format('YYYY');

    // 6. Content description
    let cleanNote = (paymentNote || '').trim();
    // Remove brackets like [THANH TOÁN], [ĐẶT CỌC], [TẤT TOÁN] if redundant
    if (cleanNote) {
        cleanNote = cleanNote.replace(/^\[.*?\]\s*/, '');
    }
    if (!cleanNote) {
        cleanNote = `Thanh toán cho đơn hàng số: ${orderCode}`;
    }

    // 7. Amount in numbers & words
    const amountNum = Math.round(paymentAmount || 0);
    const amountFormatted = amountNum.toLocaleString('vi-VN').replace(/,/g, '.') + ' đ';
    const amountWords = formatVNDAmountWords(amountNum);

    // 8. Seal & Signature Image
    let stampImageSrc = '';
    if (mode === 'pdf') {
        if (companyConfig?.COMPANY_STAMP_IMAGE) {
            const stampVal = companyConfig.COMPANY_STAMP_IMAGE;
            stampImageSrc = stampVal.startsWith('/uploads/') 
                ? `${API_URL}/upload/files/${stampVal.replace('/uploads/', '')}` 
                : stampVal;
        } else {
            stampImageSrc = `${window.location.origin}/director_seal_signature.png`;
        }
    }

    const docTitle = mode === 'pdf' 
        ? `Giấy đề nghị thanh toán (PDF) - ${orderCode}` 
        : `In Giấy đề nghị thanh toán - ${orderCode}`;

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="utf-8">
    <title>${docTitle}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 10mm 12mm 10mm 12mm;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 15px;
            line-height: 1.45;
            color: #111;
            margin: 0;
            padding: 20px;
            background: #f5f5f7;
        }
        .page-container {
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: #fff;
            padding: 14mm 12mm 14mm 12mm;
            box-shadow: 0 4px 18px rgba(0,0,0,0.1);
            position: relative;
        }
        @media print {
            body {
                background: #fff;
                padding: 0;
            }
            .page-container {
                box-shadow: none;
                padding: 0;
                margin: 0;
                max-width: 100%;
                min-height: auto;
            }
            .no-print {
                display: none !important;
            }
        }
        /* Top Navigation Bar */
        .preview-toolbar {
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            background: #1f1f1f;
            color: #fff;
            padding: 10px 22px;
            border-radius: 30px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 16px;
            z-index: 99999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
        }
        .preview-btn {
            background: #0958d9;
            color: #fff;
            border: none;
            padding: 7px 18px;
            border-radius: 20px;
            font-weight: 600;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .preview-btn:hover {
            background: #1677ff;
            transform: scale(1.02);
        }
        .preview-btn.secondary {
            background: #434343;
        }
        .preview-btn.secondary:hover {
            background: #595959;
        }
        .badge {
            background: ${mode === 'pdf' ? '#ff4d4f' : '#52c41a'};
            color: #fff;
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
        }

        /* HEADER */
        .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 22px;
            gap: 12px;
        }
        .header-left {
            flex: 1;
            min-width: 0;
            line-height: 1.4;
        }
        .company-name-row {
            font-size: 13.5px;
            white-space: nowrap;
        }
        .company-name {
            font-size: 13.5px;
            font-weight: bold;
            text-transform: uppercase;
        }
        .company-address {
            font-size: 13px;
            margin-top: 4px;
            color: #222;
            line-height: 1.35;
        }
        .header-right {
            flex-shrink: 0;
            text-align: center;
            line-height: 1.35;
            white-space: nowrap;
        }
        .nation-title {
            font-size: 13.5px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.2px;
        }
        .nation-motto {
            font-size: 13px;
            font-weight: bold;
            margin-top: 3px;
        }
        .divider-line {
            width: 130px;
            height: 1px;
            background: #333;
            margin: 4px auto 0 auto;
        }

        /* TITLE */
        .doc-title-block {
            text-align: center;
            margin: 28px 0 26px 0;
        }
        .doc-title {
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        }
        .doc-date {
            font-size: 14.5px;
            color: #333;
        }

        /* RECIPIENT & SENDER */
        .recipient-section {
            margin-bottom: 22px;
            font-size: 15px;
            line-height: 1.7;
        }
        .info-row {
            display: flex;
            margin-bottom: 4px;
        }
        .info-label {
            width: 195px;
            flex-shrink: 0;
            color: #111;
        }
        .info-val {
            flex: 1;
        }

        /* SECTIONS */
        .section-title {
            font-weight: bold;
            margin: 18px 0 8px 0;
            font-size: 15px;
        }
        .payment-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 8px;
            font-size: 15px;
        }
        .payment-table td {
            padding: 4px 0;
            vertical-align: top;
        }
        .payment-table .td-label {
            width: 195px;
            padding-left: 24px;
            color: #111;
        }
        .payment-table .td-val {
            flex: 1;
        }

        /* SIGNATURES */
        .signature-block {
            display: flex;
            justify-content: space-between;
            margin-top: 36px;
            page-break-inside: avoid;
        }
        .sig-col {
            width: 46%;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .sig-role {
            font-size: 15px;
            font-weight: bold;
            font-style: italic;
            margin-bottom: 4px;
        }
        .sig-space {
            height: 110px;
            width: 100%;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .stamp-img {
            max-height: 115px;
            max-width: 220px;
            object-fit: contain;
            user-select: none;
            pointer-events: none;
        }
        .sig-name {
            font-size: 15px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
    </style>
</head>
<body>
    <div class="preview-toolbar no-print">
        <span class="badge">${mode === 'pdf' ? 'Mẫu 1: DNTT PDF (Có mộc & Chữ ký GĐ)' : 'Mẫu 2: In DNTT (Ký sống & đóng dấu thực tế)'}</span>
        <button class="preview-btn" onclick="window.print()">
            🖨️ ${mode === 'pdf' ? 'Tải PDF / In' : 'In Ngay'}
        </button>
        <button class="preview-btn secondary" onclick="window.close()">
            Đóng
        </button>
    </div>

    <div class="page-container">
        <!-- HEADER -->
        <div class="doc-header">
            <div class="header-left">
                <div class="company-name-row">Đơn vị: <span class="company-name">${companyName}</span></div>
                <div class="company-address">Địa chỉ: ${companyAddress}</div>
            </div>
            <div class="header-right">
                <div class="nation-title">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div class="nation-motto">Độc lập – Tự do – Hạnh phúc</div>
                <div class="divider-line"></div>
            </div>
        </div>

        <!-- TITLE -->
        <div class="doc-title-block">
            <div class="doc-title">GIẤY ĐỀ NGHỊ THANH TOÁN</div>
            <div class="doc-date">Ngày ${dayStr} Tháng ${monthStr} Năm ${yearStr}</div>
        </div>

        <!-- RECIPIENT & SENDER -->
        <div class="recipient-section">
            <div class="info-row">
                <div class="info-label">Kính gửi:</div>
                <div class="info-val"><b>${customerDisplayName}</b></div>
            </div>
            <div class="info-row">
                <div class="info-label">Họ và tên người đề nghị:</div>
                <div class="info-val"><b>${requesterDisplayName}</b></div>
            </div>
            <div class="info-row">
                <div class="info-label">Bộ phận:</div>
                <div class="info-val">Kinh doanh</div>
            </div>
        </div>

        <!-- PAYMENT CONTENT -->
        <div class="section-title">Nội dung thanh toán:</div>
        
        <!-- 1/ Nội dung -->
        <table class="payment-table">
            <tr>
                <td style="width: 24px; font-weight: bold; vertical-align: top;">1/</td>
                <td style="width: 171px; color: #111;">Nội dung:</td>
                <td class="td-val">${cleanNote}</td>
            </tr>
            <tr>
                <td></td>
                <td style="color: #111;">Số tiền:</td>
                <td class="td-val"><i><b>${amountFormatted}</b></i></td>
            </tr>
            <tr>
                <td></td>
                <td style="color: #111;">Bằng chữ:</td>
                <td class="td-val"><i><b>${amountWords}</b></i></td>
            </tr>
        </table>

        <!-- 2/ Thông tin chuyển khoản -->
        <div style="font-weight: bold; margin: 14px 0 6px 0;">2/ Thông tin chuyển khoản</div>
        <table class="payment-table">
            <tr>
                <td style="width: 24px;"></td>
                <td style="width: 171px; color: #111;">Tên tài khoản:</td>
                <td class="td-val"><b>${bankHolder}</b></td>
            </tr>
            <tr>
                <td></td>
                <td style="color: #111;">Tài khoản số:</td>
                <td class="td-val"><b>${bankAccount}</b></td>
            </tr>
            <tr>
                <td></td>
                <td style="color: #111;">Mở tại ngân hàng:</td>
                <td class="td-val"><b>${bankName}</b></td>
            </tr>
            <tr>
                <td></td>
                <td style="color: #111;">Nội dung chuyển khoản:</td>
                <td class="td-val"><b>${orderCode}</b></td>
            </tr>
        </table>

        <!-- SIGNATURES -->
        <div class="signature-block">
            <div class="sig-col">
                <div class="sig-role">Người đề nghị thanh toán</div>
                <div class="sig-space">
                    <!-- Blank for manual signing or unsigned as per requirement -->
                </div>
                <div class="sig-name">${requesterDisplayName}</div>
            </div>
            <div class="sig-col">
                <div class="sig-role">Giám Đốc</div>
                <div class="sig-space">
                    ${mode === 'pdf' && stampImageSrc ? `
                        <img src="${stampImageSrc}" class="stamp-img" alt="Con dấu & Chữ ký Giám đốc" onerror="this.style.display='none'" />
                    ` : ''}
                </div>
                <div class="sig-name">${directorName}</div>
            </div>
        </div>
    </div>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        };
    </script>
</body>
</html>`;

    w.document.write(html);
    w.document.close();
};
