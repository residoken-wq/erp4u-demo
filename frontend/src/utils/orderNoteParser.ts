/**
 * Tiện ích bóc tách thông tin giao hàng từ ghi chú đơn hàng Website (erp4u-website)
 */

export interface ParsedShippingInfo {
    isWebsiteOrder: boolean;
    receiverName: string;
    receiverPhone: string;
    receiverEmail?: string;
    shippingAddress: string;
    paymentMethod: 'COD' | 'BANK_TRANSFER' | 'OTHER';
    isCod: boolean;
    suggestedCodAmount: number;
    deliveryNote: string;
    // Heuristic địa chỉ cấp 4 sơ bộ
    addressParts?: {
        street?: string;
        ward?: string;
        district?: string;
        province?: string;
    };
}

/**
 * Trích xuất các trường thông tin giao hàng từ chuỗi text ghi chú đơn hàng
 * Chuẩn định dạng từ erp4u-website:
 * 📦 ĐƠN HÀNG TỪ WEBSITE
 * ─────────────────────────
 * 👤 Tên người mua: Nguyễn Văn A
 * 📞 Số điện thoại: 0987654321
 * 📧 Email: a@gmail.com
 * 📍 Địa chỉ giao hàng: 123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh
 * 💳 Phương thức thanh toán: COD (Thanh toán khi nhận hàng) | Chuyển khoản
 * 📝 Ghi chú: Giao giờ hành chính
 */
export function parseWebsiteOrderNote(note?: string, order?: any): ParsedShippingInfo {
    const text = note || '';
    const isWeb = /ĐƠN HÀNG TỪ WEBSITE|erp4u-website/i.test(text) || 
                  order?.order_source === 'WEBSITE' ||
                  /(?:Tên người mua|Địa chỉ giao hàng)\s*:/i.test(text);

    // 1. Tên người nhận
    const nameMatch = text.match(/(?:👤\s*)?(?:Tên người mua|Người nhận|Khách hàng)\s*:\s*([^\n\r]+)/i);
    const receiverName = nameMatch 
        ? nameMatch[1].trim() 
        : (order?.receiver_name || (order?.customer_name && order.customer_name !== 'Khách lẻ' ? order.customer_name : ''));

    // 2. Số điện thoại
    const phoneMatch = text.match(/(?:📞\s*)?(?:Số điện thoại|SĐT|Điện thoại)\s*:\s*([0-9\.\-\s\+]{8,15})/i);
    const receiverPhone = phoneMatch 
        ? phoneMatch[1].replace(/[\s\.\-]/g, '').trim() 
        : (order?.receiver_phone || order?.customer?.phone || '');

    // 3. Email
    const emailMatch = text.match(/(?:📧\s*)?Email\s*:\s*([^\s\n\r@]+@[^\s\n\r@]+\.[^\s\n\r]+)/i);
    const receiverEmail = emailMatch 
        ? emailMatch[1].trim() 
        : (order?.customer?.email || undefined);

    // 4. Địa chỉ giao hàng
    const addrMatch = text.match(/(?:📍\s*)?(?:Địa chỉ giao hàng|Địa chỉ nhận hàng|Địa chỉ)\s*:\s*([^\n\r]+)/i);
    const shippingAddress = addrMatch 
        ? addrMatch[1].trim() 
        : (order?.shipping_address || order?.customer?.address || '');

    // 5. Phương thức thanh toán & COD
    const payMatch = text.match(/(?:💳\s*)?(?:Phương thức thanh toán|Thanh toán)\s*:\s*([^\n\r]+)/i);
    const payText = payMatch ? payMatch[1].toLowerCase() : '';
    const isCod = payText.includes('cod') || payText.includes('khi nhận hàng') || payText.includes('tiền mặt');
    const paymentMethod: 'COD' | 'BANK_TRANSFER' | 'OTHER' = isCod 
        ? 'COD' 
        : (payText.includes('chuyển khoản') || payText.includes('bank') ? 'BANK_TRANSFER' : 'OTHER');

    // Tính số tiền COD đề xuất:
    // Nếu là COD -> lấy Tổng tiền đơn - Tiền đã thanh toán
    let totalAmount = Number(order?.total_amount) || 0;
    if (!totalAmount && order?.items && Array.isArray(order.items)) {
        totalAmount = order.items.reduce((sum: number, item: any) => sum + (Number(item.unit_price || 0) * Number(item.quantity || 0)), 0);
    }
    const paidAmount = Number(order?.paid_amount) || 0;
    const remainingUnpaid = Math.max(0, totalAmount - paidAmount);
    const suggestedCodAmount = isCod ? (remainingUnpaid > 0 ? remainingUnpaid : totalAmount) : 0;

    // 6. Ghi chú giao hàng của khách
    const noteMatch = text.match(/(?:📝\s*)?(?:Ghi chú|Lời nhắn|Ghi chú giao hàng)\s*:\s*([\s\S]+?)(?=\n[^\n:]+:|$)/i);
    let deliveryNote = noteMatch ? noteMatch[1].trim() : '';
    // Nếu không khớp regex ghi chú riêng nhưng text không có định dạng chuẩn, giữ nguyên ghi chú
    if (!deliveryNote && text && !text.includes('📦 ĐƠN HÀNG TỪ WEBSITE')) {
        deliveryNote = text.trim();
    }

    // 7. Heuristic bóc tách địa chỉ cấp 4 (dựa trên dấu phẩy)
    const addressParts = parseAddressHeuristic(shippingAddress);

    return {
        isWebsiteOrder: isWeb,
        receiverName,
        receiverPhone,
        receiverEmail,
        shippingAddress,
        paymentMethod,
        isCod,
        suggestedCodAmount,
        deliveryNote,
        addressParts
    };
}

/**
 * Tách sơ bộ địa chỉ thành các cấp dựa trên phân tách dấu phẩy (fallback trước khi gọi API GHTK)
 */
export function parseAddressHeuristic(fullAddress: string) {
    if (!fullAddress) return {};
    const segments = fullAddress.split(',').map(s => s.trim()).filter(Boolean);
    if (segments.length >= 4) {
        return {
            province: segments[segments.length - 1],
            district: segments[segments.length - 2],
            ward: segments[segments.length - 3],
            street: segments.slice(0, segments.length - 3).join(', ')
        };
    } else if (segments.length === 3) {
        return {
            province: segments[2],
            district: segments[1],
            ward: '',
            street: segments[0]
        };
    } else if (segments.length === 2) {
        return {
            province: segments[1],
            district: '',
            ward: '',
            street: segments[0]
        };
    }
    return {
        street: fullAddress
    };
}
