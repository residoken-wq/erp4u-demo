import dayjs from 'dayjs';

export interface DeliveryNoticeTemplate {
    id: string;
    name: string;
    type: string;
    isDefault: boolean;
    content: string;
}

export interface ShippingLeg {
    id: string;
    leg_name: string;
    carrier_name: string;
    contact_phone?: string;
    carrier_phone?: string;
    tracking_code?: string;
    shipping_cost?: number;
    shipping_fee?: number;
    payer: 'SHOP' | 'CUSTOMER' | 'shop' | 'customer';
    status?: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'pending' | 'delivering' | 'delivered';
    note?: string;
    notes?: string;
}

export const PLACEHOLDER_GUIDE = [
    { key: '{CUSTOMER_NAME}', label: 'Tên trường / Khách hàng', example: 'Trường MN Song Ngữ Paris' },
    { key: '{CONTACT_NAME}', label: 'Người liên hệ nhận hàng', example: 'Mr Thái' },
    { key: '{CONTACT_PHONE}', label: 'Số điện thoại người nhận', example: '0868 200365' },
    { key: '{DELIVERY_ADDRESS}', label: 'Địa chỉ giao hàng', example: '159 Nguyễn Trãi, KP6, P.4, Tây Ninh' },
    { key: '{DELIVERY_DATE}', label: 'Ngày giao / Ngày xuất kho', example: '11/09/2026' },
    { key: '{DELIVERY_CODE}', label: 'Mã phiếu xuất kho', example: 'PXK-110926-001' },
    { key: '{ORDER_CODE}', label: 'Mã đơn hàng', example: 'DH-2609-0002' },
    { key: '{ITEMS_LIST}', label: 'Danh sách sản phẩm xuất (SL giao/SL đặt)', example: '• Bộ nệm gối túi: 50/55 Bộ' },
    { key: '{BACKLOG_NOTE}', label: 'Ghi chú giao bù nếu giao thiếu', example: '➡️ Chênh lệch 5 cái sẽ giao bổ sung...' },
    { key: '{ORDER_TOTAL}', label: 'Tổng giá trị đơn hàng', example: '17,825,000' },
    { key: '{PAID_AMOUNT}', label: 'Số tiền đã tạm ứng', example: '8,125,000' },
    { key: '{REMAINING_AMOUNT}', label: 'Số tiền hàng còn lại', example: '9,700,000' },
    { key: '{SHIPPING_FEE}', label: 'Phí vận chuyển', example: '500,000' },
    { key: '{SHIPPING_CARRIER_INFO}', label: 'Đơn vị vận chuyển / Chành xe', example: 'Chành xe Tô Châu' },
    { key: '{PAYMENT_METHOD}', label: 'Hình thức thanh toán', example: 'Thanh toán khi nhận hàng / Chuyển khoản' },
    { key: '{BANK_INFO}', label: 'Thông tin tài khoản ngân hàng', example: 'ACB - 141847859 - CTY TUONG LINH' },
    { key: '{SALE_NAME}', label: 'Tên Sale Agent / Admin', example: 'Đặng Hoàng Diệu Ái' },
    { key: '{HOTLINE}', label: 'Hotline ERP4U', example: '0983.796654 - 0983.882210' },
];

export const DEFAULT_DELIVERY_NOTICE_TEMPLATES: DeliveryNoticeTemplate[] = [
    {
        id: 'standard_b2b',
        name: 'Mẫu 1: Chuẩn B2B / Trường Học (Thanh toán khi nhận hàng)',
        type: 'B2B_STANDARD',
        isDefault: true,
        content: `THÔNG BÁO GIAO HÀNG

Hàng hóa của {CUSTOMER_NAME} đang được vận chuyển đến Trường, ERP4U gửi Anh/Chị thông tin để Trường mình theo dõi nhận hàng và thanh toán ạ.

1. Thông tin hàng hóa:
{ITEMS_LIST}

2. Địa chỉ giao hàng:
{CUSTOMER_NAME}
Địa chỉ: {DELIVERY_ADDRESS}
Người liên hệ: {CONTACT_NAME} - {CONTACT_PHONE}
{SHIPPING_CARRIER_INFO}

3. Thanh toán:
- Giá trị đơn hàng: {ORDER_TOTAL} đ
- Đã tạm ứng: {PAID_AMOUNT} đ
- Số tiền hàng còn lại: {REMAINING_AMOUNT} đ – Thanh toán khi nhận hàng.

4. Phản hồi hàng hóa:
Khi nhận hàng, anh/chị vui lòng kiểm đếm và ký nhận vào phiếu xuất kho, scan/chụp gửi xác nhận với ERP4U về việc nhận đủ hàng và làm cơ sở để ERP4U tiếp nhận hỗ trợ hàng hóa về sự cố (nếu có).
Trong vòng 3 - 5 ngày kể từ ngày nhận hàng, Khách hàng kiểm tra toàn bộ sản phẩm (chất liệu, kích thước...) và phản hồi nếu có lỗi sản xuất để ERP4U tiếp nhận xử lý kịp thời.

Cảm ơn Chị và Quý Trường đã tin tưởng và đồng hành cùng ERP4U.
Trân trọng,
{SALE_NAME} - ERP4U
Hotline: {HOTLINE}`
    },
    {
        id: 'province_chanh_xe',
        name: 'Mẫu 2: Giao Tỉnh / Chành Xe (Chuyển khoản trước khi giao)',
        type: 'PROVINCE_CHANH_XE',
        isDefault: false,
        content: `THÔNG BÁO GIAO HÀNG

Hàng hóa của {CUSTOMER_NAME} đã sản xuất xong, ERP4U gửi Anh/Chị thông tin để Trường mình theo dõi sắp xếp thanh toán và nhận hàng ạ.

1. Thông tin hàng hóa:
{ITEMS_LIST}

2. Thời gian & Địa chỉ giao hàng:
- Thời gian dự kiến: {DELIVERY_DATE} (hoặc khi nhận được xác nhận của trường)
- Địa chỉ nhận hàng: {DELIVERY_ADDRESS}
- Đơn vị vận chuyển / Chành xe: {SHIPPING_CARRIER_INFO}
- Người liên hệ: {CONTACT_NAME} - {CONTACT_PHONE}

3. Thanh toán:
- Giá trị đơn hàng: {ORDER_TOTAL} đ
- Đã tạm ứng: {PAID_AMOUNT} đ
- Số tiền còn lại: {REMAINING_AMOUNT} đ
👉 Hình thức: Thanh toán chuyển khoản trước khi giao hàng / gửi chành xe.
- Thông tin chuyển khoản: {BANK_INFO}
- Nội dung CK: {ORDER_CODE}

4. Phản hồi hàng hóa:
Khi nhận hàng, anh/chị vui lòng kiểm đếm ký nhận số lượng vào phiếu xuất kho, đây là xác nhận về việc nhận đủ hàng và làm cơ sở để ERP4U tiếp nhận hỗ trợ hàng hóa về sự cố (lỗi sản xuất nếu có).
Trong vòng 3 - 5 ngày kể từ ngày nhận hàng, Quý khách kiểm tra hàng hóa, nếu có lỗi sản xuất vui lòng phản hồi trong khoảng thời gian này để ERP4U tiếp nhận xử lý.

Cảm ơn Chị và Quý Trường đã tin tưởng và đồng hành cùng ERP4U.
Trân trọng,
{SALE_NAME} - ERP4U
Hotline: {HOTLINE}`
    },
    {
        id: 'partial_delivery',
        name: 'Mẫu 3: Giao Hàng Từng Phần / Đợt (Có hẹn giao bù)',
        type: 'PARTIAL_DELIVERY',
        isDefault: false,
        content: `📦 THÔNG BÁO GIAO HÀNG – ERP4U

Theo trao đổi, thống nhất về việc giao nhận hàng và thanh toán, Em gửi thông tin giao hàng đợt này để mình sắp xếp nhân sự phụ trách nhận hàng ạ.
Ngày giao hàng: {DELIVERY_DATE}

1. Thông tin hàng hóa (Đặt hàng / Giao hàng đợt này):
{ITEMS_LIST}
{BACKLOG_NOTE}

2. Địa chỉ giao hàng:
{CUSTOMER_NAME}
Địa chỉ: {DELIVERY_ADDRESS}
Người nhận: {CONTACT_NAME} - {CONTACT_PHONE}

3. Thanh toán:
- Giá trị đơn hàng: {ORDER_TOTAL} đ
- Đã tạm ứng: {PAID_AMOUNT} đ
- Số tiền hàng còn lại: {REMAINING_AMOUNT} đ
👉 Thanh toán khi nhận hàng đợt này: {REMAINING_AMOUNT} đ

4. Lưu ý khi nhận hàng:
- Anh/Chị vui lòng kiểm đếm & ký nhận trên Phiếu xuất kho.
- Sau khi ký nhận, ERP4U không chịu trách nhiệm về thiếu hụt số lượng hàng hóa.

5. Kiểm tra sản phẩm:
Trong vòng 3–5 ngày sau khi nhận hàng, Anh/Chị vui lòng kiểm tra toàn bộ sản phẩm (chất liệu, kích thước...) và phản hồi nếu có lỗi sản xuất để ERP4U hỗ trợ kịp thời.

Cảm ơn Chị và Quý Trường đã tin tưởng và đồng hành cùng ERP4U.
Trân trọng,
{SALE_NAME} - ERP4U
Hotline: {HOTLINE}`
    },
    {
        id: 'quick_zalo',
        name: 'Mẫu 4: Rút Gọn (Gửi nhanh qua Zalo / Tin nhắn)',
        type: 'QUICK_ZALO',
        isDefault: false,
        content: `Dạ em chào Anh/Chị {CONTACT_NAME} - {CUSTOMER_NAME},
Hàng hóa của Trường mình đã sản xuất xong. ERP4U gửi thông tin giao hàng để Trường theo dõi và nhận hàng nhé:

📦 Đơn hàng: {ORDER_CODE} | Phiếu XK: {DELIVERY_CODE}
- Ngày giao: {DELIVERY_DATE}
- Hàng hóa giao đợt này:
{ITEMS_LIST}
{BACKLOG_NOTE}
- Địa chỉ nhận: {DELIVERY_ADDRESS}
- Người nhận: {CONTACT_NAME} ({CONTACT_PHONE})
- Đơn vị vận chuyển: {SHIPPING_CARRIER_INFO}
- Tiền hàng còn lại: {REMAINING_AMOUNT} đ ({PAYMENT_METHOD})

Anh/Chị vui lòng kiểm đếm, ký nhận vào Phiếu xuất kho và phản hồi lại giúp ERP4U nếu có bất kỳ vấn đề gì trong vòng 3-5 ngày nhé ạ.
Cảm ơn Quý Trường đã luôn đồng hành cùng ERP4U!
Hotline hỗ trợ: {HOTLINE}`
    }
];

export interface FormatNoticeParams {
    order: any;
    delivery?: any;
    shipItems?: any[];
    shipDate?: any;
    shipAddress?: string;
    shipContactName?: string;
    shipContactPhone?: string;
    shippingCarrier?: string;
    shippingLegs?: ShippingLeg[];
    isCod?: boolean;
    pickMoney?: number;
    companyConfig?: any;
    products?: any[];
}

export function formatDeliveryNotice(templateContent: string, params: FormatNoticeParams): string {
    const {
        order = {},
        delivery = {},
        shipItems = [],
        shipDate,
        shipAddress = '',
        shipContactName = '',
        shipContactPhone = '',
        shippingCarrier = '',
        shippingLegs,
        isCod = false,
        pickMoney = 0,
        companyConfig = {},
        products = []
    } = params;

    const customerName = order.customer?.name || order.customer_name || 'Quý Trường';
    const contactName = shipContactName || delivery.contact_name || order.receiver_name || order.contact_name || 'Anh/Chị';
    const contactPhone = shipContactPhone || delivery.contact_phone || order.receiver_phone || order.contact_phone || '';
    const address = shipAddress || delivery.delivery_address || order.shipping_address || order.customer?.address || 'Tại trường';
    const deliveryDateStr = shipDate 
        ? dayjs(shipDate).format('DD/MM/YYYY') 
        : (delivery.delivery_date ? dayjs(delivery.delivery_date).format('DD/MM/YYYY') : dayjs().format('DD/MM/YYYY'));
    const deliveryCode = delivery.code || 'PXK-ERP4U';
    const orderCode = order.order_code || '';

    // Build items list & backlog notes
    const activeShipItems = shipItems.filter(i => (Number(i.quantity) || 0) > 0);
    const itemLines: string[] = [];
    const backlogNotes: string[] = [];

    if (activeShipItems.length > 0) {
        activeShipItems.forEach((si: any) => {
            const orderItem = (order.items || []).find((oi: any) => oi.sku === si.sku);
            const product = products.find((p: any) => p.value === si.sku || p.sku === si.sku);
            const itemName = orderItem?.vat_content || orderItem?.product_name_real || product?.name || si.sku;
            const unit = product?.unit || orderItem?.unit || 'Bộ';
            const shipQty = Number(si.quantity) || 0;
            const orderedQty = Number(orderItem?.quantity) || Number(si.max) || shipQty;

            itemLines.push(`• ${itemName}: ${shipQty}/${orderedQty} ${unit}`);

            if (orderedQty > shipQty) {
                const diff = orderedQty - shipQty;
                backlogNotes.push(`➡️ Chênh lệch ${diff} ${unit} "${itemName}" sẽ được giao bổ sung vào đợt sau.`);
            }
        });
    } else if (order.items && order.items.length > 0) {
        order.items.forEach((oi: any) => {
            const product = products.find((p: any) => p.value === oi.sku || p.sku === oi.sku);
            const itemName = oi.vat_content || oi.product_name_real || product?.name || oi.sku;
            const unit = product?.unit || oi.unit || 'Bộ';
            const qty = Number(oi.quantity) || 0;
            itemLines.push(`• ${itemName}: ${qty}/${qty} ${unit}`);
        });
    } else {
        itemLines.push(`• Hàng theo phiếu xuất kho`);
    }

    const itemsListStr = itemLines.join('\n');
    const backlogNoteStr = backlogNotes.length > 0 ? '\n' + backlogNotes.join('\n') : '';

    // Money calculation
    const orderTotal = Number(order.total_amount || 0);
    const paidAmount = Number(order.paid_amount || 0);
    const remainingAmount = Math.max(0, orderTotal - paidAmount);
    const shippingFee = Number(order.shipping_fee || 0);

    const legs = shippingLegs || delivery.shipping_legs || [];
    let carrierInfo = '';
    if (legs && legs.length > 0) {
        const legLines = legs.map((leg: ShippingLeg, idx: number) => {
            const parts = [`+ Chặng ${idx + 1} (${leg.leg_name || 'Vận chuyển'}): ${leg.carrier_name || 'Nhà xe'}`];
            const phone = leg.contact_phone || leg.carrier_phone;
            if (phone) parts.push(`SĐT: ${phone}`);
            if (leg.tracking_code) parts.push(`Mã VĐ: ${leg.tracking_code}`);
            const fee = Number(leg.shipping_cost !== undefined ? leg.shipping_cost : leg.shipping_fee) || 0;
            if (fee > 0) {
                const isCustomer = String(leg.payer || '').toUpperCase() === 'CUSTOMER';
                parts.push(`Cước: ${fee.toLocaleString('vi-VN')}đ (${isCustomer ? 'Khách trả khi nhận' : 'Shop trả'})`);
            }
            const noteText = leg.note || leg.notes;
            if (noteText) parts.push(`(${noteText})`);
            return parts.join(' - ');
        });
        carrierInfo = `Đơn vị vận chuyển (${legs.length} chặng):\n` + legLines.join('\n');
    } else {
        const carrier = shippingCarrier || delivery.shipping_carrier || order.shipping_carrier;
        carrierInfo = carrier ? `Đơn vị vận chuyển: ${carrier}` : 'Vận chuyển: Giao trực tiếp';
    }

    const paymentMethod = isCod || Number(pickMoney) > 0 
        ? `Thanh toán COD khi nhận hàng` 
        : `Chuyển khoản`;

    const bankName = companyConfig.COMPANY_BANK_NAME || 'ACB - TP.HCM';
    const bankAccount = companyConfig.COMPANY_BANK_ACCOUNT || '141847859';
    const bankHolder = companyConfig.COMPANY_BANK_HOLDER || 'CTY TNHH TM DV TUONG LINH';
    const bankInfoStr = `NH ${bankName} - STK: ${bankAccount} - Chủ TK: ${bankHolder}`;

    const saleName = order.assigned_to?.full_name || order.assigned_to?.name || order.created_by?.full_name || 'Admin ERP4U';
    const salePhone = order.assigned_to?.phone || order.created_by?.phone || '';
    const hotline = companyConfig.COMPANY_PHONE || '0983.796654 - 0983.882210';

    let result = templateContent;
    result = result.replace(/\{CUSTOMER_NAME\}/g, customerName);
    result = result.replace(/\{CONTACT_NAME\}/g, contactName);
    result = result.replace(/\{CONTACT_PHONE\}/g, contactPhone);
    result = result.replace(/\{DELIVERY_ADDRESS\}/g, address);
    result = result.replace(/\{DELIVERY_DATE\}/g, deliveryDateStr);
    result = result.replace(/\{DELIVERY_CODE\}/g, deliveryCode);
    result = result.replace(/\{ORDER_CODE\}/g, orderCode);
    result = result.replace(/\{ITEMS_LIST\}/g, itemsListStr);
    result = result.replace(/\{BACKLOG_NOTE\}/g, backlogNoteStr);
    result = result.replace(/\{ORDER_TOTAL\}/g, orderTotal.toLocaleString('vi-VN'));
    result = result.replace(/\{PAID_AMOUNT\}/g, paidAmount.toLocaleString('vi-VN'));
    result = result.replace(/\{REMAINING_AMOUNT\}/g, remainingAmount.toLocaleString('vi-VN'));
    result = result.replace(/\{SHIPPING_FEE\}/g, shippingFee.toLocaleString('vi-VN'));
    result = result.replace(/\{SHIPPING_CARRIER_INFO\}/g, carrierInfo);
    result = result.replace(/\{PAYMENT_METHOD\}/g, paymentMethod);
    result = result.replace(/\{BANK_INFO\}/g, bankInfoStr);
    result = result.replace(/\{SALE_NAME\}/g, saleName + (salePhone ? ` (${salePhone})` : ''));
    result = result.replace(/\{HOTLINE\}/g, hotline);

    return result.trim();
}
