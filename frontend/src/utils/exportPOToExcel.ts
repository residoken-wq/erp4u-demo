import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

export const exportPOToExcel = async (
    currentPO: any,
    editingItems: any[],
    packingList: any[]
) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ERP4U';
    workbook.created = new Date();

    const poCode = currentPO?.po_code || 'PO-XXXX';
    const supplierName = currentPO?.supplier?.legal_name || currentPO?.supplier?.name || 'Chưa chọn NCC';
    
    // --- Bảng Màu ---
    const headerBgColor = 'FF1677FF'; // Ant Design Primary Blue
    const headerFontColor = 'FFFFFFFF'; // Trắng
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
    };

    // --- SHEET 1: CHI TIẾT ĐƠN HÀNG ---
    const ws1 = workbook.addWorksheet('Chi tiết Đơn hàng');
    
    // Thông tin chung
    ws1.mergeCells('A1:G1');
    ws1.getCell('A1').value = `THÔNG TIN ĐƠN ĐẶT HÀNG: ${poCode}`;
    ws1.getCell('A1').font = { size: 16, bold: true, color: { argb: headerBgColor } };
    
    ws1.getCell('A3').value = 'Nhà cung cấp:';
    ws1.getCell('A3').font = { bold: true };
    ws1.getCell('B3').value = supplierName;
    
    ws1.getCell('A4').value = 'Ngày tạo:';
    ws1.getCell('A4').font = { bold: true };
    ws1.getCell('B4').value = currentPO?.created_at ? dayjs(currentPO.created_at).format('DD/MM/YYYY') : '';
    
    ws1.getCell('A5').value = 'Trạng thái:';
    ws1.getCell('A5').font = { bold: true };
    ws1.getCell('B5').value = currentPO?.status || '';

    ws1.getCell('A6').value = 'Tổng tiền:';
    ws1.getCell('A6').font = { bold: true };
    ws1.getCell('B6').value = Number(currentPO?.total_amount || 0);
    ws1.getCell('B6').numFmt = '#,##0';
    
    ws1.getCell('A7').value = 'Ghi chú:';
    ws1.getCell('A7').font = { bold: true };
    ws1.getCell('B7').value = currentPO?.note || '';

    // Header bảng
    const headerRow = ws1.addRow(['STT', 'Tên hàng hoá / Mô tả', 'SL Quy Đổi', 'SL Gốc', 'ĐVT Gốc', 'Đơn giá', 'Thành tiền', 'Ghi chú']);
    headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: headerFontColor } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
        cell.border = borderStyle;
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Dữ liệu bảng
    editingItems.forEach((item, index) => {
        const factor = item.material ? Number(item.material.conversion_factor || 1) : 1;
        const convertedQty = factor > 1 ? Number((Number(item.quantity || 0) / factor).toFixed(2)) : Number(item.quantity || 0);
        const row = ws1.addRow([
            index + 1,
            item.description || item.material?.name || item.product?.name || '',
            convertedQty,
            Number(item.quantity || 0),
            item.material?.unit || '',
            Number(item.unit_price || 0),
            Number(item.subtotal || 0),
            item.note || ''
        ]);
        row.eachCell((cell) => {
            cell.border = borderStyle;
            cell.alignment = { vertical: 'middle' };
        });
        row.getCell(3).numFmt = '#,##0.00';
        row.getCell(4).numFmt = '#,##0.00';
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).numFmt = '#,##0';
    });

    // Căn chỉnh độ rộng cột
    ws1.getColumn(1).width = 5;
    ws1.getColumn(2).width = 40;
    ws1.getColumn(3).width = 12;
    ws1.getColumn(4).width = 12;
    ws1.getColumn(5).width = 10;
    ws1.getColumn(6).width = 15;
    ws1.getColumn(7).width = 15;
    ws1.getColumn(8).width = 25;

    // --- SHEET 2: THÔNG TIN ĐÓNG GÓI ---
    if (packingList && packingList.length > 0) {
        const ws2 = workbook.addWorksheet('Đóng gói (Packing List)');
        
        ws2.mergeCells('A1:G1');
        ws2.getCell('A1').value = `THÔNG TIN ĐÓNG GÓI: ${poCode}`;
        ws2.getCell('A1').font = { size: 16, bold: true, color: { argb: headerBgColor } };

        const packingHeader = ws2.addRow(['STT', 'Tên NPL', 'N1', 'N2', 'N3', 'C1', 'C2', 'G1', 'G2', 'Lẻ', 'Biên', 'Tổng SL', 'Ghi chú']);
        packingHeader.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: headerFontColor } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
            cell.border = borderStyle;
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        packingList.forEach((item, index) => {
            const row = ws2.addRow([
                index + 1,
                item.material_name || '',
                item.n1 || '', item.n2 || '', item.n3 || '',
                item.c1 || '', item.c2 || '',
                item.g1 || '', item.g2 || '',
                item.odd || '', item.margin || '',
                item.quantity || 0,
                item.note || ''
            ]);
            row.eachCell((cell) => {
                cell.border = borderStyle;
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' };
            row.getCell(12).numFmt = '#,##0.00';
            row.getCell(13).alignment = { vertical: 'middle', horizontal: 'left' };
        });

        ws2.getColumn(1).width = 5;
        ws2.getColumn(2).width = 30;
        ws2.getColumn(12).width = 15;
        ws2.getColumn(13).width = 25;
    }

    // --- SHEET 3: THÔNG TIN GIAO HÀNG ---
    const delivery = currentPO?.delivery_info;
    const outDelivery = currentPO?.outsourcing_delivery_info;
    
    if (delivery || outDelivery) {
        const ws3 = workbook.addWorksheet('Tiến độ Giao hàng');
        
        ws3.mergeCells('A1:D1');
        ws3.getCell('A1').value = `THÔNG TIN GIAO HÀNG: ${poCode}`;
        ws3.getCell('A1').font = { size: 16, bold: true, color: { argb: headerBgColor } };

        const addDeliveryData = (title: string, data: any, startRow: number) => {
            if (!data) return startRow;
            ws3.getCell(`A${startRow}`).value = title;
            ws3.getCell(`A${startRow}`).font = { bold: true, size: 14, color: { argb: headerBgColor } };
            
            let r = startRow + 1;
            ws3.getCell(`A${r}`).value = 'Ngày xuất phát dự kiến:';
            ws3.getCell(`B${r}`).value = data.expected_departure_date ? dayjs(data.expected_departure_date).format('DD/MM/YYYY') : '';
            r++;
            
            ws3.getCell(`A${r}`).value = 'Xe vận chuyển:';
            ws3.getCell(`B${r}`).value = data.vehicle || '';
            r++;
            
            ws3.getCell(`A${r}`).value = 'Ngày đến dự kiến:';
            ws3.getCell(`B${r}`).value = data.expected_arrival_date ? dayjs(data.expected_arrival_date).format('DD/MM/YYYY') : '';
            r++;
            
            ws3.getCell(`A${r}`).value = 'Trạng thái / Ghi chú:';
            ws3.getCell(`B${r}`).value = `${data.status || ''} - ${data.note || ''}`;
            r++;
            
            return r + 1;
        };

        let currentRow = 3;
        if (delivery) {
            currentRow = addDeliveryData('Giao Hàng (Thành phẩm/NPL)', delivery, currentRow);
        }
        if (outDelivery) {
            currentRow = addDeliveryData('Giao NPL cho Đơn vị Gia Công', outDelivery, currentRow);
        }
        
        ws3.getColumn(1).width = 30;
        ws3.getColumn(2).width = 40;
    }

    // --- TẢI FILE VỀ ---
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${poCode}.xlsx`);
};
