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
    // Heuristic địa chỉ cấp 4 sơ bộ (kèm thôn/ấp)
    addressParts?: {
        street?: string;
        hamlet?: string;
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

    // 7. Bóc tách địa chỉ cấp 4 thông minh (hỗ trợ cả địa chỉ không có dấu phẩy)
    const addressParts = smartParseVietnameseAddress(shippingAddress);

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
 * Danh sách và từ điển chuẩn hóa Tỉnh/Thành Việt Nam
 */
export const VIETNAM_PROVINCES = [
    { names: ['vũng tàu', 'vung tau', 'bà rịa', 'ba ria', 'bà rịa vũng tàu', 'ba ria vung tau'], standard: 'Bà Rịa - Vũng Tàu', defaultCity: 'TP. Vũng Tàu' },
    { names: ['hồ chí minh', 'ho chi minh', 'hcm', 'tphcm', 'tp hcm', 'sài gòn', 'sai gon'], standard: 'Hồ Chí Minh' },
    { names: ['hà nội', 'ha noi', 'hn'], standard: 'Hà Nội' },
    { names: ['đà nẵng', 'da nang'], standard: 'Đà Nẵng' },
    { names: ['hải phòng', 'hai phong'], standard: 'Hải Phòng' },
    { names: ['cần thơ', 'can tho'], standard: 'Cần Thơ' },
    { names: ['bình dương', 'binh duong', 'thủ dầu một', 'thu dau mot', 'dĩ an', 'di an', 'thuận an', 'thuan an'], standard: 'Bình Dương', defaultCity: 'Thành phố Thủ Dầu Một' },
    { names: ['đồng nai', 'dong nai', 'biên hòa', 'bien hoa', 'long khánh'], standard: 'Đồng Nai', defaultCity: 'Thành phố Biên Hòa' },
    { names: ['long an', 'tân an', 'tan an'], standard: 'Long An', defaultCity: 'Thành phố Tân An' },
    { names: ['tiền giang', 'mỹ tho', 'my tho'], standard: 'Tiền Giang', defaultCity: 'Thành phố Mỹ Tho' },
    { names: ['bến tre', 'ben tre'], standard: 'Bến Tre', defaultCity: 'Thành phố Bến Tre' },
    { names: ['vĩnh long', 'vinh long'], standard: 'Vĩnh Long', defaultCity: 'Thành phố Vĩnh Long' },
    { names: ['trà vinh', 'tra vinh'], standard: 'Trà Vinh', defaultCity: 'Thành phố Trà Vinh' },
    { names: ['hậu giang', 'hau giang', 'vị thanh'], standard: 'Hậu Giang', defaultCity: 'Thành phố Vị Thanh' },
    { names: ['sóc trăng', 'soc trang'], standard: 'Sóc Trăng', defaultCity: 'Thành phố Sóc Trăng' },
    { names: ['bạc liêu', 'bac lieu'], standard: 'Bạc Liêu', defaultCity: 'Thành phố Bạc Liêu' },
    { names: ['cà mau', 'ca mau'], standard: 'Cà Mau', defaultCity: 'Thành phố Cà Mau' },
    { names: ['kiên giang', 'kien giang', 'rạch giá', 'phú quốc'], standard: 'Kiên Giang', defaultCity: 'Thành phố Rạch Giá' },
    { names: ['an giang', 'long xuyên', 'châu đốc'], standard: 'An Giang', defaultCity: 'Thành phố Long Xuyên' },
    { names: ['đồng tháp', 'dong thap', 'cao lãnh', 'sa đéc'], standard: 'Đồng Tháp', defaultCity: 'Thành phố Cao Lãnh' },
    { names: ['tây ninh', 'tay ninh'], standard: 'Tây Ninh', defaultCity: 'Thành phố Tây Ninh' },
    { names: ['bình phước', 'binh phuoc', 'đồng xoài'], standard: 'Bình Phước', defaultCity: 'Thành phố Đồng Xoài' },
    { names: ['lâm đồng', 'lam dong', 'đà lạt', 'da lat', 'bảo lộc'], standard: 'Lâm Đồng', defaultCity: 'Thành phố Đà Lạt' },
    { names: ['khánh hòa', 'khanh hoa', 'nha trang', 'cam ranh'], standard: 'Khánh Hòa', defaultCity: 'Thành phố Nha Trang' },
    { names: ['ninh thuận', 'ninh thuan', 'phan rang'], standard: 'Ninh Thuận', defaultCity: 'Thành phố Phan Rang - Tháp Chàm' },
    { names: ['bình thuận', 'binh thuan', 'phan thiết'], standard: 'Bình Thuận', defaultCity: 'Thành phố Phan Thiết' },
    { names: ['đắk lắk', 'dak lak', 'daklak', 'buôn ma thuột'], standard: 'Đắk Lắk', defaultCity: 'Thành phố Buôn Ma Thuột' },
    { names: ['đắk nông', 'dak nong'], standard: 'Đắk Nông', defaultCity: 'Thành phố Gia Nghĩa' },
    { names: ['gia lai', 'pleiku'], standard: 'Gia Lai', defaultCity: 'Thành phố Pleiku' },
    { names: ['kon tum'], standard: 'Kon Tum', defaultCity: 'Thành phố Kon Tum' },
    { names: ['phú yên', 'tuy hòa'], standard: 'Phú Yên', defaultCity: 'Thành phố Tuy Hòa' },
    { names: ['bình định', 'binh dinh', 'quy nhơn'], standard: 'Bình Định', defaultCity: 'Thành phố Quy Nhơn' },
    { names: ['quảng ngãi', 'quang ngai'], standard: 'Quảng Ngãi', defaultCity: 'Thành phố Quảng Ngãi' },
    { names: ['quảng nam', 'tam kỳ', 'hội an'], standard: 'Quảng Nam', defaultCity: 'Thành phố Tam Kỳ' },
    { names: ['thừa thiên huế', 'huế', 'hue'], standard: 'Thừa Thiên Huế', defaultCity: 'Thành phố Huế' },
    { names: ['quảng trị', 'đông hà'], standard: 'Quảng Trị', defaultCity: 'Thành phố Đông Hà' },
    { names: ['quảng bình', 'đồng hới'], standard: 'Quảng Bình', defaultCity: 'Thành phố Đồng Hới' },
    { names: ['hà tĩnh', 'ha tinh'], standard: 'Hà Tĩnh', defaultCity: 'Thành phố Hà Tĩnh' },
    { names: ['nghệ an', 'vinh'], standard: 'Nghệ An', defaultCity: 'Thành phố Vinh' },
    { names: ['thanh hóa', 'thanh hoa'], standard: 'Thanh Hóa', defaultCity: 'Thành phố Thanh Hóa' },
    { names: ['ninh bình', 'ninh binh'], standard: 'Ninh Bình', defaultCity: 'Thành phố Ninh Bình' },
    { names: ['nam định', 'nam dinh'], standard: 'Nam Định', defaultCity: 'Thành phố Nam Định' },
    { names: ['thái bình', 'thai binh'], standard: 'Thái Bình', defaultCity: 'Thành phố Thái Bình' },
    { names: ['hà nam', 'phủ lý'], standard: 'Hà Nam', defaultCity: 'Thành phố Phủ Lý' },
    { names: ['hưng yên', 'hung yen'], standard: 'Hưng Yên', defaultCity: 'Thành phố Hưng Yên' },
    { names: ['hải dương', 'hai duong'], standard: 'Hải Dương', defaultCity: 'Thành phố Hải Dương' },
    { names: ['bắc ninh', 'bac ninh'], standard: 'Bắc Ninh', defaultCity: 'Thành phố Bắc Ninh' },
    { names: ['bắc giang', 'bac giang'], standard: 'Bắc Giang', defaultCity: 'Thành phố Bắc Giang' },
    { names: ['vĩnh phúc', 'vinh phuc', 'vĩnh yên'], standard: 'Vĩnh Phúc', defaultCity: 'Thành phố Vĩnh Yên' },
    { names: ['phú thọ', 'việt trì'], standard: 'Phú Thọ', defaultCity: 'Thành phố Việt Trì' },
    { names: ['thái nguyên', 'thai nguyen'], standard: 'Thái Nguyên', defaultCity: 'Thành phố Thái Nguyên' },
    { names: ['tuyên quang'], standard: 'Tuyên Quang', defaultCity: 'Thành phố Tuyên Quang' },
    { names: ['hà giang'], standard: 'Hà Giang', defaultCity: 'Thành phố Hà Giang' },
    { names: ['cao bằng'], standard: 'Cao Bằng', defaultCity: 'Thành phố Cao Bằng' },
    { names: ['bắc kạn', 'bac kan'], standard: 'Bắc Kạn', defaultCity: 'Thành phố Bắc Kạn' },
    { names: ['lạng sơn', 'lang son'], standard: 'Lạng Sơn', defaultCity: 'Thành phố Lạng Sơn' },
    { names: ['quảng ninh', 'hạ long', 'cẩm phả', 'uông bí'], standard: 'Quảng Ninh', defaultCity: 'Thành phố Hạ Long' },
    { names: ['lào cai'], standard: 'Lào Cai', defaultCity: 'Thành phố Lào Cai' },
    { names: ['yên bái'], standard: 'Yên Bái', defaultCity: 'Thành phố Yên Bái' },
    { names: ['điện biên'], standard: 'Điện Biên', defaultCity: 'Thành phố Điện Biên Phủ' },
    { names: ['lai châu'], standard: 'Lai Châu', defaultCity: 'Thành phố Lai Châu' },
    { names: ['sơn la'], standard: 'Sơn La', defaultCity: 'Thành phố Sơn La' },
    { names: ['hòa bình', 'hoa binh'], standard: 'Hòa Bình', defaultCity: 'Thành phố Hòa Bình' },
];

/**
 * Bóc tách địa chỉ Việt Nam thông minh (hỗ trợ cả trường hợp không có dấu phẩy và thôn/ấp)
 */
export function smartParseVietnameseAddress(rawAddress: string) {
    if (!rawAddress || !rawAddress.trim()) {
        return { province: '', district: '', ward: '', hamlet: 'Khác', street: '' };
    }

    const clean = rawAddress.trim();
    let province = '';
    let district = '';
    let ward = '';
    let hamlet = '';
    let street = clean;
    let workText = clean;
    let matchedProvItem: any = null;

    // 1. Phân tích Tỉnh/Thành
    const lower = clean.toLowerCase();
    for (const item of VIETNAM_PROVINCES) {
        for (const alias of item.names) {
            const pattern = new RegExp(`(?:tp\\.?|thành phố|tỉnh)?\\s*${alias}(?:\\s*$|[\\,\\.])`, 'i');
            if (pattern.test(lower)) {
                province = item.standard;
                matchedProvItem = item;
                workText = workText.replace(new RegExp(`(?:tp\\.?|thành phố|tỉnh)?\\s*${alias}(?:\\s*$|[\\,\\.])`, 'gi'), '').trim();
                break;
            }
        }
        if (province) break;
    }

    // 2. Phân tích Phường/Xã/Thị trấn
    const wardMatch = workText.match(/(?:phường|p\\.|xã|x\\.|thị trấn|tt\\.)\\s+([0-9a-zA-Zà-ỹÀ-Ỹ\\s]+?)(?=\\s+(?:quận|huyện|thị xã|tx\\.|tp\\.|thành phố)|[\\,\\.]|$)/i);
    if (wardMatch) {
        ward = wardMatch[0].trim();
        workText = workText.replace(wardMatch[0], '').trim();
    }

    // 3. Phân tích Quận/Huyện/Thị xã/Thành phố nếu chưa có district
    if (!district) {
        const distMatch = workText.match(/(?:quận|huyện|thị xã|tx\\.|tp\\.|thành phố)\\s+([0-9a-zA-Zà-ỹÀ-Ỹ\\s]+?)(?=[\,\.]|$)/i);
        if (distMatch) {
            district = distMatch[0].trim();
            workText = workText.replace(distMatch[0], '').trim();
        }
    }

    // 4. Phân tích Thôn / Ấp / Xóm / Tổ / Bản / Buôn / Khu phố / Sóc / Đội
    const hamletMatch = workText.match(/(?:thôn|ấp|xóm|tổ|tổ dân phố|khu phố|khóm|bản|buôn|sóc|đội)\\s+([0-9a-zA-Zà-ỹÀ-Ỹ\\s]+?)(?=\\s+(?:phường|p\\.|xã|x\\.|thị trấn|tt\\.|quận|huyện|thị xã|tx\\.|tp\\.|thành phố)|[\\,\\.]|$)/i);
    if (hamletMatch) {
        hamlet = hamletMatch[0].trim();
        workText = workText.replace(hamletMatch[0], '').trim();
    }

    // 5. Nếu có dấu phẩy mà chưa tìm thấy đủ, fallback sang cắt dấu phẩy
    if ((!province || !district || !ward) && clean.includes(',')) {
        const segments = clean.split(',').map(s => s.trim()).filter(Boolean);
        if (segments.length >= 4) {
            if (!province) province = segments[segments.length - 1];
            if (!district) district = segments[segments.length - 2];
            if (!ward) ward = segments[segments.length - 3];
        } else if (segments.length === 3) {
            if (!province) province = segments[2];
            const middle = segments[1].trim();
            // Nếu đoạn giữa bắt đầu bằng 'phường'/'xã'/'thị trấn', đây là WARD, TUYỆT ĐỐI KHÔNG GÁN VÀO DISTRICT!
            if (/^(?:phường|p\\.|xã|x\\.|thị trấn|tt\\.)/i.test(middle)) {
                if (!ward) ward = middle;
            } else if (/^(?:quận|huyện|thị xã|tx\\.|tp\\.|thành phố)/i.test(middle)) {
                if (!district) district = middle;
            } else {
                if (!district && !ward) district = middle;
            }
        } else if (segments.length === 2) {
            if (!province) province = segments[1];
        }
    }

    // 6. SUY ĐOÁN QUẬN/HUYỆN THÔNG MINH CHO TỈNH:
    // Tại Việt Nam, tất cả các Phường của các Tỉnh đều trực thuộc Thành phố (hoặc Thị xã) của Tỉnh đó!
    if (!district && matchedProvItem?.defaultCity && ward) {
        if (/^(?:phường|p\\.)/i.test(ward.trim())) {
            district = matchedProvItem.defaultCity;
        }
    }

    // 7. Bóc tách Tên đường / Số nhà (phần trước thôn/ấp/phường/xã hoặc quận/huyện)
    const splitIndex = clean.search(/(?:thôn|ấp|xóm|tổ|tổ dân phố|khu phố|khóm|bản|buôn|sóc|đội|phường|p\\.|xã|x\\.|thị trấn|tt\\.|quận|huyện|thị xã|tx\\.|tp\\.|thành phố)/i);
    if (splitIndex > 0) {
        street = clean.substring(0, splitIndex).trim().replace(/[\\,\\-\\s]+$/, '').replace(/^[\\,\\-\\s]+/, '').trim();
    } else {
        street = workText.replace(/[\\,\\-\\s]+$/, '').replace(/^[\\,\\-\\s]+/, '').trim();
    }

    // Làm sạch street nếu street còn chứa Phường hoặc Tỉnh:
    if (street && (province || ward)) {
        let cleanStreet = street;
        if (ward) {
            cleanStreet = cleanStreet.replace(new RegExp(`[,\\s]*${ward.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gi'), '');
        }
        if (province) {
            cleanStreet = cleanStreet.replace(new RegExp(`[,\\s]*(?:tỉnh|tp\\.?|thành phố)?\\s*${province.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`, 'gi'), '');
        }
        cleanStreet = cleanStreet.trim().replace(/^[,\\-\\s]+/, '').replace(/[,\\-\\s]+$/, '');
        if (cleanStreet) {
            street = cleanStreet;
        }
    }

    const capitalize = (str: string) => str ? str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '';
    const capHamlet = capitalize(hamlet);
    if (!street || street === ',' || street === '-') {
        street = capHamlet || clean;
    }

    return {
        province: province || '',
        district: capitalize(district) || '',
        ward: capitalize(ward) || '',
        hamlet: capHamlet || 'Khác',
        street: street,
    };
}

