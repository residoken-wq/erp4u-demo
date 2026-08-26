import dayjs from 'dayjs';

export const handlePrintPO = (currentPO: any, packingList: any[], template: string, showPrice = true, companyConfig: any) => {
    const w = window.open('', '_blank');
    if (!w) return;

    let content = '';
    const dateStr = dayjs().format('DD/MM/YYYY');
    const poCode = currentPO?.po_code || 'PO-XXXX';
    const supplierDisplayName = currentPO?.supplier?.legal_name || currentPO?.supplier?.name || '';

    const style = `
        <style>
            @page { size: A4 landscape; margin: 10mm; }
            body { font-family: 'Times New Roman', serif; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 5px; text-align: center; }
            .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
            .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; }
            .left-align { text-align: left; white-space: pre-wrap; }
            .bold { font-weight: bold; }
            @media print { .no-print { display: none; } }
        </style>
    `;

    if (template === 'STANDARD') {
        const rows = currentPO?.items?.map((i: any, idx: number) => {
            const size = i.product?.attributes?.size || i.product?.variant_attributes?.size || '-';
            return `
            <tr>
                <td>${idx + 1}</td>
                <td class="left-align">${i.description}</td>
                <td>${size}</td>
                <td>${Number(i.quantity).toLocaleString()}</td>
                <td>${Number(i.unit_price).toLocaleString()}</td>
                <td>${Number(i.subtotal).toLocaleString()}</td>
            </tr>
        `}).join('');

        content = `
            ${style}
            <div class="header">
                <div>
                        <div class="title" style="margin-bottom:5px; text-align:left;">${companyConfig?.COMPANY_NAME || 'ERP4U'}</div>
                        <div>${companyConfig?.COMPANY_ADDRESS ? `Đ/C: ${companyConfig.COMPANY_ADDRESS}` : 'Đ/C: 123 ABC...'}</div>
                </div>
                <div style="text-align:right;">
                    <div><b>Ngày:</b> ${dateStr}</div>
                    <div><b>Mã PO:</b> ${poCode}</div>
                    <div><b>Ngày giao hàng:</b> ${currentPO?.expected_delivery_date ? dayjs(currentPO.expected_delivery_date).format('DD/MM/YYYY') : '-'}</div>
                </div>
            </div>
            <div class="title">ĐƠN ĐẶT HÀNG (NPL)</div>
            <div style="margin-bottom:10px;"><b>Kính gửi:</b> ${supplierDisplayName}</div>
            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Description</th>
                        <th>Kích thước</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" style="text-align:right; font-weight:bold;">Total</td>
                        <td style="font-weight:bold;">${Number(currentPO?.total_amount).toLocaleString()}</td>
                    </tr>
                </tfoot>
            </table>
        `;
    } else if (template === 'OUTSOURCING') {
        const priceHeaders = showPrice ? `<th>Đơn giá</th><th>Thành tiền</th>` : '';
        const priceColspan = showPrice ? 2 : 0;

        const rows = currentPO?.items?.map((i: any, idx: number) => {
            const priceCells = showPrice ? `<td>${Number(i.unit_price || 0).toLocaleString()}</td><td>${Number(i.subtotal || 0).toLocaleString()}</td>` : '';
            
            let productName = i.product?.name || i.material?.name || '';
            let productSku = i.product?.sku || i.material?.sku || '';
            let frontColor = i.product?.attributes?.front_color || '-';
            let backColor = i.product?.attributes?.back_color || '-';
            let processingDesc = i.product?.processing_description || i.material?.name || ''; 

            if (i.product && !processingDesc) {
                processingDesc = i.product.name;
            }

            if (!i.product && !i.material && i.description) {
                const descMatch = i.description.match(/^(.+?)\s*\([^)]+\)\s*$/);
                if (descMatch) {
                    productName = descMatch[1].trim();
                    processingDesc = descMatch[1].trim();
                } else {
                    productName = i.description;
                    if (!processingDesc) processingDesc = i.description;
                }
            } else if (!processingDesc && i.description) {
                const descMatch = i.description.match(/^(.+?)\s*\([^)]+\)\s*$/);
                processingDesc = descMatch ? descMatch[1].trim() : i.description;
            }

            const logoAttr = i.product?.attributes?.Logo || i.product?.attributes?.logo;
            let theuText = logoAttr || '-';
            const size = i.product?.attributes?.size || i.product?.variant_attributes?.size || '-';

            return `
            <tr>
                <td>${idx + 1}</td>
                <td class="left-align">${productSku || productName}</td>
                <td>${size}</td>
                <td>${frontColor}</td>
                <td>${backColor}</td>
                <td class="left-align">${processingDesc}</td>
                <td>${Number(i.quantity).toLocaleString()}</td>
                <td>${theuText}</td> 
                ${priceCells}
                <td>${i.note || ''}</td>
            </tr>
        `}).join('');

        content = `
            ${style}
                <div class="header">
                <div>
                        <div class="title" style="margin-bottom:5px; text-align:left;">${companyConfig?.COMPANY_NAME || 'ERP4U'}</div>
                        <div>${companyConfig?.COMPANY_ADDRESS ? `Đ/C: ${companyConfig.COMPANY_ADDRESS}` : 'Đ/C: 123 ABC...'}</div>
                </div>
                <div style="text-align:right;">
                    <div><b>Ngày:</b> ${dateStr}</div>
                    <div><b>Mã:</b> ${poCode}</div>
                    <div><b>Ngày giao hàng:</b> ${currentPO?.expected_delivery_date ? dayjs(currentPO.expected_delivery_date).format('DD/MM/YYYY') : '-'}</div>
                </div>
            </div>
            <div class="title">ĐƠN ĐẶT HÀNG GIA CÔNG</div>
            <div style="margin-bottom:10px;"><b>Kính gửi:</b> ${supplierDisplayName}</div>
                <table>
                <thead>
                    <tr>
                        <th style="width: 5%;">STT</th>
                        <th style="width: 12%;">Mã SKU</th>
                        <th>Kích thước</th>
                        <th>Màu MT</th>
                        <th>Màu MS</th>
                        <th>Mô tả sản xuất</th>
                        <th>Số lượng</th>
                        <th>Thêu/in</th>
                        ${priceHeaders}
                        <th style="width: 25%;">Ghi chú</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                    <tfoot>
                    <tr>
                        <td colspan="6" style="text-align:right; font-weight:bold;">Tổng cộng</td>
                        <td style="font-weight:bold;">${Number(currentPO?.items?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0)).toLocaleString()}</td>
                        <td colspan="${2 + priceColspan}"></td>
                    </tr>
                </tfoot>
            </table>
            <div style="margin-top:20px;">
                <div><b>Ghi chú chung:</b> ${currentPO?.note || ''}</div>
            </div>
                <div style="display:flex; justify-content:space-between; margin-top:40px; text-align:center;">
                <div><b>Người lập phiếu</b><br/><br/><br/>(Ký, họ tên)</div>
                <div><b>Người duyệt</b><br/><br/><br/>(Ký, họ tên)</div>
                    <div><b>Nhà cung cấp</b><br/><br/><br/>(Ký, họ tên)</div>
            </div>
        `;
    } else if (template === 'CARA' || template === 'HQ') {
        const list = packingList.length > 0 ? packingList : [{ po_form_code: '', material_name: '' }];
        const rows = list.map((r: any, idx: number) => `
            <tr>
                <td>${idx + 1}</td>
                <td class="left-align bold">${r.po_form_code || ''}</td>
                <td class="left-align">${r.material_name || ''}</td>
                <td>${r.n1 || '-'}</td>
                <td>${r.n2 || '-'}</td>
                <td>${r.c1 || '-'}</td>
                <td>${r.c2 || '-'}</td>
                <td>${r.g1 || '-'}</td>
                <td>${r.g2 || '-'}</td>
                <td>${r.odd || '-'}</td>
                <td>${r.border || '-'}</td>
                <td class="left-align">${r.note || ''}</td>
            </tr>
        `).join('');

        // Calculate summary statistics by PO Form
        const grouped = list.reduce((acc: any, curr: any) => {
            const code = curr.po_form_code || 'Khác';
            if (!acc[code]) acc[code] = { n1: 0, n2: 0, c1: 0, c2: 0, g1: 0, g2: 0, odd: 0, border: 0 };
            acc[code].n1 += parseFloat(curr.n1) || 0;
            acc[code].n2 += parseFloat(curr.n2) || 0;
            acc[code].c1 += parseFloat(curr.c1) || 0;
            acc[code].c2 += parseFloat(curr.c2) || 0;
            acc[code].g1 += parseFloat(curr.g1) || 0;
            acc[code].g2 += parseFloat(curr.g2) || 0;
            acc[code].odd += parseFloat(curr.odd) || 0;
            acc[code].border += parseFloat(curr.border) || 0;
            return acc;
        }, {});

        let totalAllN1 = 0, totalAllN2 = 0, totalAllC1 = 0, totalAllC2 = 0, totalAllG1 = 0, totalAllG2 = 0, totalAllOdd = 0, totalAllBorder = 0, grandTotal = 0;
        
        const summaryRows = Object.keys(grouped).map(code => {
            const g = grouped[code];
            const total = g.n1 + g.n2 + g.c1 + g.c2 + g.g1 + g.g2 + g.odd + g.border;
            
            totalAllN1 += g.n1; totalAllN2 += g.n2; totalAllC1 += g.c1; totalAllC2 += g.c2;
            totalAllG1 += g.g1; totalAllG2 += g.g2; totalAllOdd += g.odd; totalAllBorder += g.border;
            grandTotal += total;

            return `
                <tr>
                    <td class="left-align bold">${code}</td>
                    <td>${g.n1 || '-'}</td>
                    <td>${g.n2 || '-'}</td>
                    <td>${g.c1 || '-'}</td>
                    <td>${g.c2 || '-'}</td>
                    <td>${g.g1 || '-'}</td>
                    <td>${g.g2 || '-'}</td>
                    <td>${g.odd || '-'}</td>
                    <td>${g.border || '-'}</td>
                    <td class="bold text-highlight">${total || '-'}</td>
                </tr>
            `;
        }).join('');

        content = `
            ${style}
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                body { font-family: 'Inter', system-ui, -apple-system, sans-serif !important; color: #1f2937; background-color: #fff; }
                table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 15px; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; }
                th, td { border: none; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; padding: 10px 8px; text-align: center; font-size: 13px; }
                th:last-child, td:last-child { border-right: none; }
                tr:last-child td { border-bottom: none; }
                th { background-color: #f9fafb; color: #374151; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; font-size: 12px; }
                tr:nth-child(even) td { background-color: #fdfdfd; }
                .header { margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f3f4f6; padding-bottom: 15px; }
                .header-left div { margin-bottom: 5px; color: #6b7280; font-size: 14px; }
                .header-right { text-align: right; }
                .header-right div { margin-bottom: 5px; font-size: 14px; }
                .title { text-align: center; font-size: 24px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 25px; margin-top: 10px; }
                .bold { font-weight: 600 !important; }
                .right-align { text-align: right !important; }
                .summary-container { margin-top: 40px; page-break-inside: avoid; }
                .summary-title { font-size: 15px; font-weight: 700; margin-bottom: 15px; color: #1f2937; text-transform: uppercase; display: inline-block; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; }
                .summary-table { width: 100%; margin: 0 auto; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
                .summary-table th { background-color: #eff6ff; color: #1e3a8a; }
                .summary-table tfoot td { background-color: #f3f4f6; font-size: 14px; border-top: 2px solid #e5e7eb; }
                .text-highlight { color: #ef4444; font-weight: 700; }
                .signature-section { display: flex; justify-content: space-between; margin-top: 50px; text-align: center; page-break-inside: avoid; }
                .signature-box { width: 30%; }
                .signature-title { font-weight: 600; font-size: 14px; margin-bottom: 70px; }
            </style>

            <div class="header">
                <div class="header-left">
                    <div style="font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 8px;">${companyConfig?.COMPANY_NAME || 'ERP4U'}</div>
                    <div>${companyConfig?.COMPANY_ADDRESS ? `Đ/C: ${companyConfig.COMPANY_ADDRESS}` : 'Đ/C: 123 ABC...'}</div>
                </div>
                <div class="header-right">
                    <div><span class="bold">Ngày lập:</span> ${dateStr}</div>
                    <div><span class="bold">Mã PO:</span> ${poCode}</div>
                </div>
            </div>

            <div class="title">ĐƠN ĐẶT HÀNG / ĐÓNG GÓI</div>

            <table>
                <thead>
                    <tr>
                        <th rowspan="2" style="width: 50px;">STT</th>
                        <th rowspan="2">Mã PO Form</th>
                        <th rowspan="2">Mã Vải / Tên NPL</th>
                        <th colspan="2">N</th>
                        <th colspan="2">C</th>
                        <th colspan="2">G</th>
                        <th rowspan="2">Kiện lẻ</th>
                        <th rowspan="2">Kiện viền</th>
                        <th rowspan="2" style="width: 15%;">Ghi chú</th>
                    </tr>
                    <tr>
                        <th>N1</th><th>N2</th><th>C1</th><th>C2</th><th>G1</th><th>G2</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>

            <div class="summary-container">
                <div class="summary-title">BẢNG THỐNG KÊ TỔNG SẢN PHẨM</div>
                <table class="summary-table">
                    <thead>
                        <tr>
                            <th>Mã PO Form</th>
                            <th>N1</th><th>N2</th><th>C1</th><th>C2</th><th>G1</th><th>G2</th>
                            <th>Kiện lẻ</th><th>Kiện viền</th>
                            <th>Tổng cộng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${summaryRows}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td class="right-align bold" style="color: #111827;">TỔNG TOÀN BỘ</td>
                            <td class="bold">${totalAllN1 || '-'}</td>
                            <td class="bold">${totalAllN2 || '-'}</td>
                            <td class="bold">${totalAllC1 || '-'}</td>
                            <td class="bold">${totalAllC2 || '-'}</td>
                            <td class="bold">${totalAllG1 || '-'}</td>
                            <td class="bold">${totalAllG2 || '-'}</td>
                            <td class="bold">${totalAllOdd || '-'}</td>
                            <td class="bold">${totalAllBorder || '-'}</td>
                            <td class="bold text-highlight">${grandTotal || '-'}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="signature-section">
                <div class="signature-box">
                    <div class="signature-title">Người lập phiếu</div>
                    <div style="color: #9ca3af; font-size: 13px;">(Ký, ghi rõ họ tên)</div>
                </div>
                <div class="signature-box">
                    <div class="signature-title">Người duyệt</div>
                    <div style="color: #9ca3af; font-size: 13px;">(Ký, ghi rõ họ tên)</div>
                </div>
                <div class="signature-box">
                    <div class="signature-title">Đơn vị tiếp nhận</div>
                    <div style="color: #9ca3af; font-size: 13px;">(Ký, ghi rõ họ tên)</div>
                </div>
            </div>
        `;
    } else if (template === 'TV') {
        const rows = currentPO?.items?.map((i: any, idx: number) => {
            let desc = i.description;
            if (!desc) {
                const mt = i.front_color || '';
                const ms = i.back_color || '';
                const name = i.material?.name || i.product?.name || '';
                if (mt || ms) desc = `${mt}${ms ? '/' + ms : ''}---${name}`;
                else desc = name;
            }

            return `
            <tr>
                <td>${idx + 1}</td>
                <td class="left-align">${desc}</td>
                <td>${Number(i.quantity).toLocaleString()}</td>
                <td class="left-align bold">${i.note || '-'}</td>
            </tr>
        `}).join('');

        const totalQty = currentPO?.items?.reduce((s: number, i: any) => s + Number(i.quantity || 0), 0);

        content = `
            ${style}
            <style>
                .tv-header-table { width: 100%; border: none; margin-bottom: 20px; font-size: 15px; font-weight: bold; border-collapse: collapse; margin-top: 0; }
                .tv-header-table td { border: none; padding: 5px 0; text-align: left; }
                .tv-header-table .right { text-align: right; }
                .tv-table th { background-color: #f9f9f9; font-weight: bold; }
                .tv-table td, .tv-table th { padding: 10px; font-size: 14px; }
            </style>
            
            <div style="font-weight: bold; font-size: 18px; margin-bottom: 5px;">ĐƠN ĐẶT HÀNG</div>
            <table class="tv-header-table">
                <tr>
                    <td>Bên Gia công: ${supplierDisplayName}</td>
                    <td class="right">Bên đặt hàng: ${companyConfig?.COMPANY_NAME || 'ERP4U'}</td>
                </tr>
                <tr>
                    <td>Ngày: ${dateStr}</td>
                    <td class="right">${poCode}</td>
                </tr>
            </table>

            <table class="tv-table">
                <thead>
                    <tr>
                        <th style="width: 5%;">STT</th>
                        <th style="width: 55%;">Chần vải mặt trước/Mặt sau - Gòn</th>
                        <th style="width: 20%;">SL m chần gòn</th>
                        <th style="width: 20%;">GHI CHÚ</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="font-weight: bold; text-align: center;">Tổng cộng</td>
                        <td style="font-weight: bold;">${Number(totalQty).toLocaleString()}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>

            <div style="margin-top: 5px; font-size: 13px;">
                ***Ghi chú: Nội dung nguyên phụ liệu được bàn giao đính kèm Phiếu xuất kho.
            </div>

            <table style="width: 100%; border: none; margin-top: 10px; font-weight: bold;">
                <tr>
                    <td style="border: none; text-align: left; width: 50%; padding-left: 30px;">Bên gia công</td>
                    <td style="border: none; text-align: right; width: 50%; padding-right: 30px;">Bên đặt hàng</td>
                </tr>
                <tr>
                    <td style="border: none; text-align: left; padding-top: 80px; padding-left: 30px;">${supplierDisplayName}</td>
                    <td style="border: none; text-align: right; padding-top: 80px; padding-right: 30px;">${companyConfig?.COMPANY_NAME || 'ERP4U'}</td>
                </tr>
            </table>
        `;
    } else if (template === 'SUPPLIER_TEMPLATE') {
        let rawTemplate = currentPO?.supplier?.po_template || '';
        
        // Generate items table HTML
        const rowsHtml = currentPO?.items?.map((i: any, idx: number) => `
            <tr>
                <td>${idx + 1}</td>
                <td class="left-align">${i.description || i.product?.name || i.material?.name || '-'}</td>
                <td>${Number(i.quantity).toLocaleString()}</td>
                <td>${Number(i.unit_price || 0).toLocaleString()}</td>
                <td>${Number(i.subtotal || 0).toLocaleString()}</td>
            </tr>
        `).join('');
        
        const itemsTable = `
            <table>
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Sản phẩm / Công đoạn</th>
                        <th>Số lượng</th>
                        <th>Đơn giá</th>
                        <th>Thành tiền</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;

        rawTemplate = rawTemplate.replace(/\{\{poCode\}\}/g, poCode);
        rawTemplate = rawTemplate.replace(/\{\{supplierName\}\}/g, supplierDisplayName);
        rawTemplate = rawTemplate.replace(/\{\{date\}\}/g, dateStr);
        rawTemplate = rawTemplate.replace(/\{\{totalAmount\}\}/g, Number(currentPO?.total_amount || 0).toLocaleString());
        rawTemplate = rawTemplate.replace(/\{\{itemsTable\}\}/g, itemsTable);

        content = `
            ${style}
            ${rawTemplate}
        `;
    }
    w.document.write(`<html><head><title>Print PO ${poCode}</title></head><body>${content}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
};
