import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SalesOrder, SalesOrderStatus } from './sales-order.entity';
import { SalesOrderItem, BookingStatus } from './sales-order-item.entity';
import { ProductSample } from './product-sample.entity';
import { SalesDelivery } from './sales-delivery.entity';
import { SalesComment } from './sales-comment.entity';
import { SalesChecklist } from './sales-checklist.entity';
import { SalesChecklistItem } from './sales-checklist-item.entity';
import { Transaction } from '../finance/transaction.entity';
import { ProductsService } from '../products/products.service';
import { InventoryService } from '../inventory/inventory.service';
import { CustomersService } from '../customers/customers.service';
import { PriceList } from './pricelist/price-list.entity';
import { PriceListRule } from './pricelist/price-list-rule.entity';
import { User } from '../users/entities/user.entity';
import { v4 as uuidv4 } from 'uuid';
import { SalesOrderVersion } from './sales-order-version.entity';
import { SystemService } from '../system/system.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SalesTarget } from './sales-target.entity';
import { Customer } from '../customers/customer.entity';
import { ProjectsService } from '../projects/projects.service';
import { Promotion } from './promotion.entity';
// --- CHECKLIST TEMPLATES ---
const CHECKLIST_TEMPLATES: Record<string, Array<{ code: string; name: string; sort: number }>> = {
    QUOTATION: [
        { code: 'QUOTE_CONTACT', name: 'Liên hệ khách hàng xác nhận yêu cầu', sort: 1 },
        { code: 'QUOTE_SEND', name: 'Gửi báo giá (Link portal / PDF)', sort: 2 },
        { code: 'QUOTE_FOLLOWUP', name: 'Follow-up báo giá (2-3 ngày)', sort: 3 },
        { code: 'QUOTE_CONFIRM', name: 'Xác nhận chốt đơn', sort: 4 },
    ],
    SO_PENDING: [
        { code: 'SO_SAMPLE', name: 'Xác nhận mẫu (Upload hình, khách duyệt)', sort: 5 },
        { code: 'SO_DEPOSIT', name: 'Thu đặt cọc (30-50%)', sort: 6 },
        { code: 'SO_PLAN', name: 'Lập kế hoạch sản xuất', sort: 7 },
    ],
    IN_PRODUCTION: [
        { code: 'PROD_UPDATE', name: 'Cập nhật tiến độ cho khách', sort: 8 },
        { code: 'PROD_QC', name: 'Kiểm tra chất lượng (QC) trước hoàn thành', sort: 9 },
    ],
    MANUFACTURING_COMPLETED: [
        { code: 'PROD_FINISH', name: 'Đóng gói & Nhập kho thành phẩm', sort: 9.1 },
        { code: 'DEL_PLAN', name: 'Liên hệ khách lên lịch giao hàng', sort: 9.2 },
    ],
    DELIVERED: [
        { code: 'DEL_CONFIRM', name: 'Xác nhận khách nhận hàng OK', sort: 10 },
        { code: 'DEL_PAYMENT', name: 'Thu công nợ còn lại (50-70%)', sort: 11 },
        { code: 'DEL_INVOICE', name: 'Gửi hóa đơn VAT (nếu có)', sort: 12 },
    ],
    COMPLETED: [
        { code: 'POST_THANKS', name: 'Gửi thư cảm ơn (sau 3 ngày)', sort: 13 },
        { code: 'POST_SURVEY', name: 'Khảo sát hài lòng (sau 7 ngày)', sort: 14 },
        { code: 'POST_UPSELL', name: 'Đề xuất sản phẩm bổ sung (up-sell)', sort: 15 },
        { code: 'POST_CROSSSELL', name: 'Nhắc đặt hàng lại (cross-sell, 30 ngày)', sort: 16 },
    ],
};

@Injectable()
export class SalesService {
    private readonly logger = new Logger(SalesService.name);

    constructor(
        @InjectRepository(SalesOrder) public orderRepo: Repository<SalesOrder>,
        @InjectRepository(SalesOrderItem) public itemRepo: Repository<SalesOrderItem>,
        @InjectRepository(ProductSample) public sampleRepo: Repository<ProductSample>,
        @InjectRepository(SalesDelivery) private deliveryRepo: Repository<SalesDelivery>,
        @InjectRepository(SalesComment) private commentRepo: Repository<SalesComment>,
        @InjectRepository(SalesChecklist) private checklistRepo: Repository<SalesChecklist>,
        @InjectRepository(SalesChecklistItem) private checklistItemRepo: Repository<SalesChecklistItem>,
        private systemService: SystemService,
        @InjectRepository(Transaction) private transRepo: Repository<Transaction>,
        @InjectRepository(PriceList) private priceListRepo: Repository<PriceList>,
        @InjectRepository(PriceListRule) private priceListRuleRepo: Repository<PriceListRule>,
        @InjectRepository(User) private userRepo: Repository<User>,
        @InjectRepository(SalesOrderVersion) private versionRepo: Repository<SalesOrderVersion>,
        @InjectRepository(SalesTarget) private targetRepo: Repository<SalesTarget>,
        @InjectRepository(Customer) private customerRepo: Repository<Customer>,
        private productsService: ProductsService,
        private inventoryService: InventoryService,
        private customersService: CustomersService,
        private notificationsService: NotificationsService,
        private projectsService: ProjectsService,
        @InjectRepository(Promotion) private promotionRepo: Repository<Promotion>,
    ) { }


    // ... (Price List Functions - Giữ nguyên) ...
    async validatePriceAgainstPriceList(sku: string, unitPrice: number, currentUserId: number): Promise<boolean> { return true; }
    async createPriceList(data: any) { return this.priceListRepo.save(this.priceListRepo.create(data)); }
    async getAllPriceLists() { return this.priceListRepo.find({ order: { id: 'DESC' } }); }
    async createPriceListRule(id: number, data: any) { return this.priceListRuleRepo.save(this.priceListRuleRepo.create({ ...data, price_list_id: id })); }
    async getPriceListRules(id: number) { return this.priceListRuleRepo.find({ where: { price_list_id: id } }); }

    // --- HELPER: GENERATE ORDER CODE ---
    async generateOrderCode(type: 'SO' | 'QUOTE' | 'SO_WEB'): Promise<string> {
        // SO_WEB = Website order: SO_Web_0001
        // SO = Regular order: SO-YYMM-0001
        // QUOTE = Quotation: BG-YYMM-0001

        if (type === 'SO_WEB') {
            // Website orders: SO_Web_xxxx (simple sequential)
            const codePrefix = 'SO_Web_';
            const lastOrder = await this.orderRepo.createQueryBuilder('order')
                .where('order.order_code LIKE :code', { code: `${codePrefix}%` })
                .orderBy('order.id', 'DESC')
                .getOne();

            let sequence = 1;
            if (lastOrder) {
                const parts = lastOrder.order_code.split('_');
                const lastSeq = parseInt(parts[parts.length - 1]);
                if (!isNaN(lastSeq)) sequence = lastSeq + 1;
            }
            return `${codePrefix}${String(sequence).padStart(4, '0')}`;
        }

        // Regular SO and QUOTE: XX-YYMM-0001
        const prefix = type === 'SO' ? 'SO' : 'BG'; // BG = Báo Giá
        const now = new Date();
        const year = String(now.getFullYear()).slice(-2);
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const codePrefix = `${prefix}-${year}${month}-`;

        // Tìm mã lớn nhất trong tháng hiện tại để tăng số thứ tự
        const lastOrder = await this.orderRepo.createQueryBuilder('order')
            .where('order.order_code LIKE :code', { code: `${codePrefix}%` })
            .orderBy('order.id', 'DESC')
            .getOne();

        let sequence = 1;
        if (lastOrder) {
            const parts = lastOrder.order_code.split('-');
            const lastSeq = parseInt(parts[parts.length - 1]);
            if (!isNaN(lastSeq)) sequence = lastSeq + 1;
        }

        return `${codePrefix}${String(sequence).padStart(4, '0')}`;
    }

    async createOrder(data: any) {
        // --- AUTO GENERATE CODE IF NEEDED ---
        let orderCode = data.order_code;
        const isWebOrder = data.order_source === 'WEBSITE';

        if (!orderCode || orderCode.startsWith('AUTO-')) {
            // Use SO_WEB for website orders, QUOTE for quotations, SO for regular
            const codeType = data.is_quotation ? 'QUOTE' : (isWebOrder ? 'SO_WEB' : 'SO');
            orderCode = await this.generateOrderCode(codeType);
        }

        const order = this.orderRepo.create({
            order_code: orderCode,
            customer: (data.customer_id && data.customer_id !== -1) ? { id: data.customer_id } : null,
            customer_name: (data.customer_id === -1) ? 'Sản Xuất Nội Bộ' : data.customer_name,
            order_date: data.order_date,
            delivery_date: data.delivery_date,
            status: data.is_quotation ? SalesOrderStatus.QUOTATION : SalesOrderStatus.SO_PENDING,
            uuid: uuidv4(),
            vat_company_name: data.vat_company_name, vat_tax_code: data.vat_tax_code, vat_address: data.vat_address, vat_rate: Number(data.vat_rate) || 0,
            vat_invoice_link: data.vat_invoice_link, vat_email: data.vat_email,
            require_invoice: data.require_invoice !== undefined ? data.require_invoice : true,
            shipping_address: data.shipping_address, receiver_name: data.receiver_name, receiver_phone: data.receiver_phone, shipping_carrier: data.shipping_carrier, shipping_fee: Number(data.shipping_fee) || 0,
            discount_rate: Number(data.discount_rate) || 0,
            discount_amount: Number(data.discount_amount) || 0,
            deposit_percent: Number(data.deposit_percent) || 0,
            deposit_amount: Number(data.deposit_amount) || 0,
            payment_note: data.payment_note, terms_content: data.terms_content, note: data.note,
            assigned_to: data.assigned_to_id ? { id: data.assigned_to_id } as any : null,
            paid_amount: 0, // Init
            order_source: data.order_source || 'ERP' // Track order source
        });

        const validItems = (data.items || []).filter((i: any) => i.sku);
        let itemsTotal = 0;

        const orderItems = await Promise.all(validItems.map(async (itemData: any) => {
            const qty = Number(itemData.quantity) || 0;
            const price = Number(itemData.unit_price || itemData.price) || 0;
            const sub = qty * price;
            itemsTotal += sub;

            const product = await this.productsService.findOneBySku(itemData.sku);

            return this.orderRepo.manager.create(SalesOrderItem, {
                sku: itemData.sku,
                product: product,
                quantity: qty,
                unit_price: price,
                subtotal: sub,
                variant_color: itemData.variant_color,
                vat_content: itemData.vat_content,
                sample_image: itemData.sample_image,
                image_url: itemData.image_url || (product ? product.image_url : null), // <--- Prioritize User Input
                position: validItems.indexOf(itemData) + 1, // Save Position
                price_ranges: itemData.price_ranges
            });
        }));

        order.items = orderItems;

        const subtotal = itemsTotal;
        const discountAmount = order.discount_amount; // Đã chốt số tiền giảm từ FE hoặc tính toán trước
        // Công thức: (Subtotal - Discount) * (1 + VAT) + Shipping
        const taxable = Math.max(0, subtotal - discountAmount);
        order.total_amount = taxable * (1 + order.vat_rate / 100) + order.shipping_fee;
        const saved = await this.orderRepo.save(order);

        // AUTO-INIT CHECKLIST
        await this.initChecklist(saved.id, saved.status);

        await this.systemService.logAction('SALES', 'CREATE_ORDER', `Created Order/Quote ${saved.order_code}`, data.user_id, data.username, saved.order_code);

        // --- NOTIFICATION: Assignee ---
        if (saved.assigned_to) {
            const assigneeId = saved.assigned_to.id; // Relations are not fully loaded but id should be there
            if (assigneeId && Number(assigneeId) !== Number(data.user_id)) {
                await this.notificationsService.create({
                    user_id: Number(assigneeId),
                    title: '📦 Bạn được giao đơn hàng mới',
                    message: `Bạn được giao phụ trách đơn hàng ${saved.order_code}`,
                    type: 'INFO',
                    link: saved.status === 'QUOTATION' ? `/sales?order=${saved.id}&highlight=order-${saved.id}` : `/orders?order=${saved.id}&highlight=order-${saved.id}`,
                    is_read: false
                });
            }
        }

        return saved;
    }

    // --- CANCEL ORDER ---
    async cancelOrder(id: number, reason: string) {
        const order = await this.orderRepo.findOne({ where: { id } });
        if (!order) throw new NotFoundException('Order not found');
        order.status = SalesOrderStatus.CANCELLED;
        order.cancel_reason = reason;
        return this.orderRepo.save(order);
    }

    // --- LOGIC TÍNH TOÁN THANH TOÁN (Helper) ---
    private async calculatePaymentInfo(orderCode: string): Promise<{ paid_amount: number, deposit_date: any | null }> {
        const payments = await this.transRepo.find({ 
            where: { reference_code: orderCode, type: 'INCOME' },
            order: { date: 'ASC' }
        });
        const paid_amount = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        return { paid_amount, deposit_date: payments.length > 0 ? payments[0].date : null };
    }

    // --- FIND ALL (FIX: Tính tổng tiền đã trả) ---
    async findAll() {
        const orders = await this.orderRepo.find({
            order: { order_date: 'DESC' }, // Sắp xếp theo ngày tạo mới nhất
            relations: ['customer', 'assigned_to']
        });

        // Map qua từng order để tính tiền đã trả từ bảng Transaction
        const ordersWithPayment = await Promise.all(orders.map(async (order) => {
            const info = await this.calculatePaymentInfo(order.order_code);
            return { ...order, paid_amount: info.paid_amount, deposit_date: info.deposit_date };
        }));

        return ordersWithPayment;
    }

    // --- ADVANCED FILTERING FOR AI ---
    async findOrdersByFilters(filters: { month?: number, year?: number, paymentStatus?: string, status?: string, customerName?: string }) {
        const query = this.orderRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.assigned_to', 'assigned_to');

        if (filters.year) {
            query.andWhere('EXTRACT(YEAR FROM order.order_date) = :year', { year: filters.year });
        }
        if (filters.month && filters.month > 0 && filters.month <= 12) {
            query.andWhere('EXTRACT(MONTH FROM order.order_date) = :month', { month: filters.month });
        }
        if (filters.paymentStatus) {
            query.andWhere('order.payment_status = :paymentStatus', { paymentStatus: filters.paymentStatus });
        }
        if (filters.status) {
            query.andWhere('order.status = :status', { status: filters.status });
        }
        if (filters.customerName) {
            query.andWhere('(LOWER(customer.name) LIKE LOWER(:cname) OR LOWER(order.order_code) LIKE LOWER(:cname))', { cname: `%${filters.customerName}%` });
        }

        query.orderBy('order.order_date', 'DESC');
        const orders = await query.getMany();

        // Map over orders to include payment info
        const ordersWithPayment = await Promise.all(orders.map(async (order) => {
            const info = await this.calculatePaymentInfo(order.order_code);
            return { ...order, paid_amount: info.paid_amount, deposit_date: info.deposit_date };
        }));

        return ordersWithPayment;
    }


    // --- FIND ONE (FIX: Tính tổng tiền đã trả) ---
    async findOne(idOrCode: string | number) {
        const query = this.orderRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.assigned_to', 'assigned_to')
            .leftJoinAndSelect('order.items', 'items')
            .leftJoinAndSelect('items.product', 'product');

        if (typeof idOrCode === 'number' || !isNaN(Number(idOrCode))) {
            query.where('order.id = :id', { id: Number(idOrCode) });
        } else {
            query.where('order.order_code = :code', { code: String(idOrCode) });
        }

        query.orderBy('items.position', 'ASC'); // SORT BY POSITION

        const order = await query.getOne();
        if (!order) throw new NotFoundException('Order not found');

        // Tính toán số tiền đã trả
        const info = await this.calculatePaymentInfo(order.order_code);

        return { ...order, paid_amount: info.paid_amount, deposit_date: info.deposit_date }; // Trả về paid_amount realtime
    }

    // --- UPDATE ---
    async update(id: number, data: any) {
        const order = await this.orderRepo.findOne({ where: { id }, relations: ['items'] });
        if (!order) throw new NotFoundException('Order Not Found');

        // Capture Old State for Diffing
        const oldOrder = { ...order, items: order.items?.map(i => ({ sku: i.sku, qty: i.quantity })) };

        if (data.customer_id) {
            if (data.customer_id === -1) {
                order.customer = null;
                order.customer_name = 'Sản Xuất Nội Bộ';
            } else {
                order.customer = { id: data.customer_id } as any;
            }
        }
        if (data.order_date) order.order_date = data.order_date;
        if (data.delivery_date) order.delivery_date = data.delivery_date;
        // if (data.delivery_date) order.delivery_date = data.delivery_date; // Remove duplicate
        if (data.status) order.status = data.status;
        if (data.note !== undefined) order.note = data.note;
        if (data.terms_content !== undefined) order.terms_content = data.terms_content;
        if (data.is_production_sample_approved !== undefined) order.is_production_sample_approved = data.is_production_sample_approved;

        // --- SAMPLE IMAGES ---
        if (data.approved_sample_images !== undefined) {
            order.approved_sample_images = data.approved_sample_images;
            await this.orderRepo.update(id, { approved_sample_images: data.approved_sample_images });
        }

        // --- INVOICE INFO ---
        if (data.vat_company_name !== undefined) order.vat_company_name = data.vat_company_name;
        if (data.vat_tax_code !== undefined) order.vat_tax_code = data.vat_tax_code;
        if (data.vat_address !== undefined) order.vat_address = data.vat_address;
        if (data.vat_invoice_link !== undefined) order.vat_invoice_link = data.vat_invoice_link;
        if (data.vat_email !== undefined) order.vat_email = data.vat_email;
        if (data.require_invoice !== undefined) order.require_invoice = data.require_invoice;

        // --- DELIVERY & CONTACT INFO ---
        if (data.shipping_address !== undefined) order.shipping_address = data.shipping_address;
        if (data.receiver_name !== undefined) order.receiver_name = data.receiver_name;
        if (data.receiver_phone !== undefined) order.receiver_phone = data.receiver_phone;
        if (data.shipping_carrier !== undefined) order.shipping_carrier = data.shipping_carrier;
        if (data.contact_name !== undefined) order.contact_name = data.contact_name;
        if (data.contact_phone !== undefined) order.contact_phone = data.contact_phone;

        order.vat_rate = Number(data.vat_rate) || 0;
        order.shipping_fee = Number(data.shipping_fee) || 0;

        if (data.discount_rate !== undefined) order.discount_rate = Number(data.discount_rate);
        if (data.discount_amount !== undefined) order.discount_amount = Number(data.discount_amount);
        if (data.deposit_percent !== undefined) order.deposit_percent = Number(data.deposit_percent);
        if (data.deposit_amount !== undefined) order.deposit_amount = Number(data.deposit_amount);
        if (data.assigned_to_id !== undefined) order.assigned_to = data.assigned_to_id ? { id: data.assigned_to_id } as any : null;

        // --- CONTRACT BUILDER DATA ---
        if (data.contract_html !== undefined) order.contract_html = data.contract_html;
        if (data.contract_variables !== undefined) order.contract_variables = data.contract_variables;
        if (data.contract_template_id !== undefined) order.contract_template_id = data.contract_template_id;
        if (data.contract_status !== undefined) order.contract_status = data.contract_status;

        if (data.items) {
            console.log('--- UPDATING ITEMS ---');                    // DEBUG
            console.log(JSON.stringify(data.items, null, 2));         // DEBUG

            // --- PRESERVE BOOKING DATA FROM OLD ITEMS ---
            const oldItems = order.items || [];
            const bookingMap = new Map<string, { booking_status: string, booked_quantity: number, booking_expires_at: Date | null }>();
            for (const oldItem of oldItems) {
                if (oldItem.booking_status && oldItem.booking_status !== 'NONE') {
                    bookingMap.set(oldItem.sku, {
                        booking_status: oldItem.booking_status,
                        booked_quantity: Number(oldItem.booked_quantity || 0),
                        booking_expires_at: oldItem.booking_expires_at
                    });
                }
            }

            await this.itemRepo.delete({ order: { id: id } });
            const validItems = data.items.filter((i: any) => i.sku);
            let itemsTotal = 0;

            const newItems = await Promise.all(validItems.map(async (itemData: any) => {
                const qty = Number(itemData.quantity) || 0;
                const price = Number(itemData.unit_price) || 0;
                const sub = qty * price;
                itemsTotal += sub;

                const product = await this.productsService.findOneBySku(itemData.sku);

                // Restore booking data if exists for this SKU
                const bookingData = bookingMap.get(itemData.sku);

                return this.itemRepo.create({
                    order,
                    sku: itemData.sku,
                    product: product,
                    quantity: qty,
                    unit_price: price,
                    subtotal: sub,
                    variant_color: itemData.variant_color,
                    vat_content: itemData.vat_content,
                    sample_image: itemData.sample_image, // <--- Ensure this is mapped
                    image_url: itemData.image_url || (product ? product.image_url : null), // <--- Prioritize User Input
                    position: validItems.indexOf(itemData) + 1, // Save Position
                    price_ranges: itemData.price_ranges,
                    // --- RESTORE BOOKING FIELDS ---
                    booking_status: bookingData?.booking_status as any || BookingStatus.NONE,
                    booked_quantity: bookingData?.booked_quantity || 0,
                    booking_expires_at: bookingData?.booking_expires_at || null,
                });
            }));

            await this.itemRepo.save(newItems);

            // --- QUAN TRỌNG: Cập nhật lại relation trong object Order để save(order) ko bị cascade lại items cũ ---
            order.items = newItems;

            // Recalculate Total
            const subtotal = itemsTotal;
            const discount = Number(order.discount_amount) || 0;
            const taxable = Math.max(0, subtotal - discount);
            order.total_amount = taxable * (1 + order.vat_rate / 100) + order.shipping_fee;
        }

        const saved = await this.orderRepo.save(order);

        // SYNC CHECKLIST IF STATUS CHANGED
        if (data.status) {
            await this.syncChecklistWithStatus(saved.id, saved.status);
        }

        // --- CALCULATE DIFF ---
        const changes: any = {};
        // Simple comparison for key fields
        const fieldsToCheck = [
            'status', 'delivery_date', 'customer_name', 'note', 'vat_company_name',
            'shipping_fee', 'discount_amount', 'total_amount'
        ];

        fieldsToCheck.forEach(field => {
            if (JSON.stringify(oldOrder[field]) !== JSON.stringify(saved[field])) {
                changes[field] = { old: oldOrder[field], new: saved[field] };
            }
        });

        // Items comparison (simplified)
        if (data.items) {
            const oldItemsStr = JSON.stringify(oldOrder.items);
            const newItemsStr = JSON.stringify(saved.items?.map(i => ({ sku: i.sku, qty: i.quantity })));
            if (oldItemsStr !== newItemsStr) {
                changes['items'] = 'Items changed';
            }
        }

        // Log Update with Details
        await this.systemService.logAction(
            'SALES',
            'UPDATE_ORDER',
            `Updated Order ${saved.order_code}`,
            data.user_id,
            data.username,
            saved.order_code,
            Object.keys(changes).length > 0 ? changes : null // Pass diff as details
        );

        // --- NOTIFICATIONS ---
        const oldAssigneeId = oldOrder.assigned_to?.id;
        const newAssigneeId = saved.assigned_to?.id;
        const currentUserId = Number(data.user_id);

        // 1. Assignee Changed
        if (newAssigneeId && newAssigneeId !== oldAssigneeId) {
            if (Number(newAssigneeId) !== currentUserId) {
                await this.notificationsService.create({
                    user_id: Number(newAssigneeId),
                    title: '📦 Bạn được giao đơn hàng',
                    message: `Đơn hàng ${saved.order_code} đã được chuyển giao cho bạn.`,
                    type: 'INFO',
                    link: saved.status === 'QUOTATION' ? `/sales?order=${saved.id}&highlight=order-${saved.id}` : `/orders?order=${saved.id}&highlight=order-${saved.id}`,
                    is_read: false
                });
            }
        }

        // 2. Status Changed
        if (oldOrder.status !== saved.status) {
            // Notify Assignee (if they didn't change it themselves)
            if (newAssigneeId && Number(newAssigneeId) !== currentUserId) {
                await this.notificationsService.create({
                    user_id: Number(newAssigneeId),
                    title: '🔄 Cập nhật trạng thái đơn hàng',
                    message: `Đơn hàng ${saved.order_code} đã chuyển sang: ${saved.status}`,
                    type: 'INFO',
                    link: saved.status === 'QUOTATION' ? `/sales?order=${saved.id}&highlight=order-${saved.id}` : `/orders?order=${saved.id}&highlight=order-${saved.id}`,
                    is_read: false
                });
            }
        }
        // Return fresh data with payment info
        return this.findOne(saved.id);
    }

    // --- REVISIONS ---
    async createRevision(orderId: number, userId?: number, username?: string) {
        const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items', 'items.product'] });
        if (!order) throw new NotFoundException('Order not found');

        // Snapshot current data
        const snapshot = { ...order };
        delete snapshot.id; // Avoid ID conflict in snapshot if strictly used

        const version = this.versionRepo.create({
            order,
            version_number: order.version,
            data_snapshot: snapshot,
            created_by: username || String(userId)
        });
        await this.versionRepo.save(version);

        // Increment Order Version
        order.version = (order.version || 1) + 1;
        await this.orderRepo.save(order);

        await this.systemService.logAction('SALES', 'CREATE_REVISION', `Created Version ${order.version - 1} for ${order.order_code}`, userId, username, order.order_code);
        return this.getRevisions(orderId);
    }

    async getRevisions(orderId: number) {
        return this.versionRepo.find({ where: { order: { id: orderId } }, order: { version_number: 'DESC' } });
    }

    async updateQuote(id: number, b: any) { return this.update(id, b); }
    async getOrder(code: string) { return this.findOne(code); }

    // ... (Các hàm phụ khác giữ nguyên) ...
    async completeOrder(id: number) {
        const order = await this.orderRepo.findOne({ where: { id } });
        if (!order) throw new NotFoundException();
        order.status = SalesOrderStatus.COMPLETED;
        const saved = await this.orderRepo.save(order);
        await this.syncChecklistWithStatus(saved.id, saved.status);
        return saved;
    }
    async addComment(orderId: number, content: string, sender: 'STAFF' | 'CUSTOMER', name?: string, commentType: 'CUSTOMER' | 'INTERNAL' = 'CUSTOMER', mentionedUserIds?: string) {
        const order = await this.orderRepo.findOne({ where: { id: orderId } });
        if (!order) throw new NotFoundException();
        const comment = this.commentRepo.create({
            order,
            content,
            sender_type: sender,
            sender_name: name,
            comment_type: commentType,
            mentioned_user_ids: mentionedUserIds,
            is_visible: commentType === 'CUSTOMER' // Internal comments are hidden on Portal
        });
        const savedComment = await this.commentRepo.save(comment);

        // Create notifications for @mentioned users (INTERNAL comments only)
        if (mentionedUserIds && commentType === 'INTERNAL') {
            const userIds = mentionedUserIds.split(',').filter(id => id.trim());
            for (const userId of userIds) {
                await this.notificationsService.create({
                    user_id: parseInt(userId, 10),
                    title: `${name || 'Nhân viên'} đã nhắc đến bạn`,
                    message: `Trong đơn hàng ${order.order_code}: ${content.replace(/<[^>]*>/g, '').substring(0, 100)}...`,
                    type: 'INFO',
                    link: order.status === 'QUOTATION' ? `/sales?order=${order.id}&tab=INTERNAL&highlight=comment-${savedComment.id}` : `/orders?order=${order.id}&tab=INTERNAL&highlight=comment-${savedComment.id}`,
                    is_read: false
                });
            }
        }

        return savedComment;
    }

    // Filter out deleted comments (deleted_at is null means not deleted)
    async getComments(orderId: number) {
        return this.commentRepo.find({
            where: { order: { id: orderId }, deleted_at: null as any },
            order: { created_at: 'ASC' }
        });
    }

    // Get all comments including deleted (for admin view)
    async getAllComments(orderId: number) {
        return this.commentRepo.find({
            where: { order: { id: orderId } },
            order: { created_at: 'ASC' }
        });
    }

    async toggleCommentVisibility(id: number) {
        const comment = await this.commentRepo.findOne({ where: { id } });
        if (comment) {
            comment.is_visible = !comment.is_visible;
            return this.commentRepo.save(comment);
        }
    }

    // Soft delete: mark as deleted but keep in database
    async softDeleteComment(id: number, deletedBy: string = 'Khách hàng') {
        const comment = await this.commentRepo.findOne({ where: { id } });
        if (!comment) throw new NotFoundException('Comment not found');

        comment.deleted_at = new Date();
        comment.deleted_by = deletedBy;
        comment.content = `[Đã thu hồi] ${comment.content}`; // Prefix for record keeping
        return this.commentRepo.save(comment);
    }

    async updateComment(id: number, content: string) {
        const comment = await this.commentRepo.findOne({ where: { id } });
        if (!comment) throw new NotFoundException('Comment not found');
        comment.content = content;
        return this.commentRepo.save(comment);
    }
    
    async getActivities(orderId: number) {
        return this.systemService.getActivityLogsForEntity('sales_orders', String(orderId));
    }
    
    async convertQuoteToSo(id: number, accepted: boolean) {
        const order = await this.orderRepo.findOne({ where: { id } });
        if (!order) throw new NotFoundException();
        order.status = accepted ? SalesOrderStatus.SO_PENDING : SalesOrderStatus.CANCELLED;
        const saved = await this.orderRepo.save(order);
        if (accepted) {
            await this.syncChecklistWithStatus(saved.id, saved.status);
            // Auto-create SO Project template
            try {
                await this.projectsService.createSOProject(saved.id);
            } catch (error) {
                this.logger.error(`Failed to auto-create SO_PROJECT for SO ${saved.id}`, error);
            }
        } else {
            // Cancel project if SO is rejected/cancelled
             try {
                await this.projectsService.cancelSOProject(saved.id);
            } catch (error) {
                 this.logger.error(`Failed to cancel SO_PROJECT for SO ${saved.id}`, error);
            }
        }
        return saved;
    }
    async approveAllSamples(id: number) {
        const order = await this.orderRepo.findOne({ where: { id }, relations: ['items'] });
        if (!order) throw new NotFoundException();
        for (const item of order.items) { item.is_sample_approved = true; await this.orderRepo.manager.save(item); }
        if (order.status === SalesOrderStatus.SO_PENDING) order.status = SalesOrderStatus.SAMPLE_APPROVED;
        const saved = await this.orderRepo.save(order);
        await this.syncChecklistWithStatus(saved.id, saved.status);
        return saved;
    }
    async deleteQuote(id: number, cascade: boolean = false) {
        const order = await this.orderRepo.findOne({ where: { id } });
        if (!order) throw new NotFoundException('Quote not found');

        // Xóa các items liên quan
        await this.itemRepo.delete({ order: { id } });

        // Xóa checklist nếu có
        const checklist = await this.checklistRepo.findOne({ where: { order_id: id } });
        if (checklist) {
            await this.checklistItemRepo.delete({ checklist: { id: checklist.id } });
            await this.checklistRepo.delete(checklist.id);
        }

        // Xóa comments nếu có
        await this.commentRepo.delete({ order: { id } });

        // Xóa Versions/Revisions nếu có
        await this.versionRepo.delete({ order: { id } });

        if (cascade) {
            // Unlink Social Orders
            try { await this.orderRepo.manager.query(`UPDATE social_orders SET sales_order_id = NULL WHERE sales_order_id = $1`, [id]); } catch (e) {}
            // Delete Projects
            try { await this.orderRepo.manager.query(`DELETE FROM projects WHERE sales_order_id = $1`, [id]); } catch (e) {}
            // Delete Tasks
            try { await this.orderRepo.manager.query(`DELETE FROM tasks WHERE reference_code = $1 AND reference_type = 'SALES'`, [order.order_code]); } catch (e) {}
            // Delete Deliveries
            try { await this.orderRepo.manager.query(`DELETE FROM sales_deliveries WHERE order_id = $1`, [id]); } catch (e) {}
        }

        // Xóa đơn hàng
        await this.systemService.logAction('SALES', 'DELETE_QUOTE', `Deleted Quote ${order.order_code}`, null, null, order.order_code);
        try {
            return await this.orderRepo.delete(id);
        } catch (error: any) {
            throw new BadRequestException('Không thể xóa Báo giá. Vui lòng kiểm tra các dữ liệu liên kết (Dự án, Giao hàng, Lịch sử MXH...)');
        }
    }

    // --- BOD FOLLOW UP ---
    async updateBodFollowUp(id: number, bodFollowUpData: any) {
        const order = await this.orderRepo.findOne({ where: { id } });
        if (!order) throw new NotFoundException('Order not found');
        
        order.bod_follow_up = bodFollowUpData;
        return this.orderRepo.save(order);
    }

    // --- DELETE ORDER (Only SO_PENDING status allowed) ---
    async deleteOrder(id: number, cascade: boolean = false) {
        const order = await this.orderRepo.findOne({ where: { id } });
        if (!order) throw new NotFoundException('Order not found');

        // Chỉ cho phép xóa SO ở trạng thái "Mới" (SO_PENDING)
        if (order.status !== SalesOrderStatus.SO_PENDING) {
            throw new BadRequestException('Chỉ có thể xóa đơn hàng ở trạng thái "Mới"');
        }

        // Xóa các items liên quan
        await this.itemRepo.delete({ order: { id } });

        // Xóa checklist nếu có
        const checklist = await this.checklistRepo.findOne({ where: { order_id: id } });
        if (checklist) {
            await this.checklistItemRepo.delete({ checklist: { id: checklist.id } });
            await this.checklistRepo.delete(checklist.id);
        }

        // Xóa comments nếu có
        await this.commentRepo.delete({ order: { id } });

        if (cascade) {
            try { await this.orderRepo.manager.query(`UPDATE social_orders SET sales_order_id = NULL WHERE sales_order_id = $1`, [id]); } catch (e) {}
            try { await this.orderRepo.manager.query(`DELETE FROM projects WHERE sales_order_id = $1`, [id]); } catch (e) {}
            try { await this.orderRepo.manager.query(`DELETE FROM tasks WHERE reference_code = $1 AND reference_type = 'SALES'`, [order.order_code]); } catch (e) {}
            try { await this.orderRepo.manager.query(`DELETE FROM sales_deliveries WHERE order_id = $1`, [id]); } catch (e) {}
        }

        // Xóa đơn hàng
        await this.systemService.logAction('SALES', 'DELETE_ORDER', `Deleted Order ${order.order_code}`, null, null, order.order_code);
        try {
            return await this.orderRepo.delete(id);
        } catch (error: any) {
            throw new BadRequestException('Không thể xóa Đơn hàng. Vui lòng kiểm tra các dữ liệu liên kết (Dự án, Giao hàng, Lịch sử MXH...)');
        }
    }
    async getQuoteByUuid(uuid: string) {
        const order = await this.orderRepo.findOne({
            where: { uuid },
            relations: ['customer', 'customer.contacts', 'items', 'items.product', 'comments', 'deliveries', 'deliveries.items', 'assigned_to'],
            order: { items: { position: 'ASC' } }
        });
        if (!order) throw new NotFoundException('Quote not found');

        // FIX: Ensure product relationship for items if missing (for legacy data)
        for (const item of order.items) {
            if (!item.product && item.sku) {
                item.product = await this.productsService.findOneBySku(item.sku);
            }
        }

        // Feature: Auto-populate description for COMBO products if empty
        if (order.items && order.items.length > 0) {
            await this.productsService.populateComboDescriptions(order.items);
        }

        // Filter out deleted comments for Portal View (Manual filter because relations loading ignores where condition)
        if (order.comments) {
            order.comments = order.comments.filter(c => !c.deleted_at);
        }

        // Fetch Payments manually
        const transactions = await this.transRepo.find({
            where: { reference_code: order.order_code, reference_type: 'SALES' },
            order: { date: 'DESC' }
        });

        const info = await this.calculatePaymentInfo(order.order_code);
        return { ...order, paid_amount: info.paid_amount, payments: transactions, deposit_date: info.deposit_date };
    }
    async customerAction(uuid: string, action: 'ACCEPT' | 'REJECT', metadata?: any) {
        const q = await this.getQuoteByUuid(uuid);
        if (q) {
            if (action === 'ACCEPT') {
                // Log with metadata
                await this.systemService.logAction(
                    'SALES',
                    'CUSTOMER_ACCEPT',
                    `Khách hàng xác nhận đơn ${q.order_code}`,
                    null,
                    'Customer',
                    q.order_code,
                    null,
                    metadata
                );
            }
            return this.convertQuoteToSo(q.id, action === 'ACCEPT');
        }
    }

    async updateViewLogs(id: number, logs: any) {
        await this.orderRepo.update(id, { portal_view_logs: logs });
    }
    async getDeliveryHistory(orderId: number) { return this.deliveryRepo.find({ where: { order_id: orderId }, relations: ['items'], order: { created_at: 'DESC' } }); }
    async getPaymentHistory(orderCode: string) { return this.transRepo.find({ where: { reference_code: orderCode }, order: { created_at: 'DESC' } }); }
    async createDelivery(orderId: number, data: any) {
        const order = await this.orderRepo.findOne({ 
            where: { id: orderId }, 
            relations: ['items', 'items.product', 'items.product.components', 'items.product.components.child_product'] 
        });
        if (!order) throw new NotFoundException('Not found');

        // Fetch real stock from inventory
        const allStocks = await this.inventoryService.getAllStocks();
        const stockMap = new Map<number, number>();
        for (const s of allStocks) {
            if (s.item_type === 'PRODUCT' && s.warehouse_code !== 'KHO_MAU') {
                const key = Number(s.item_id);
                stockMap.set(key, (stockMap.get(key) || 0) + Number(s.quantity));
            }
        }

        const isDraft = data.status === 'DRAFT';
        // --- Ràng buộc: CONFIRMED booking HOẶC tồn kho khả dụng đủ ---
        const errors: string[] = [];
        for (const reqItem of data.items || []) {
            const soItem = order.items.find(i => i.sku === reqItem.sku);
            if (!soItem) continue;

            if (isDraft) {
                // Phiếu nháp không cần kiểm tra tồn kho hoặc booking
                continue;
            }

            if (soItem.booking_status === BookingStatus.CONFIRMED) {
                // Đã duyệt booking → cho phép xuất
                continue;
            }

            // Chưa có booking CONFIRMED → kiểm tra tồn kho khả dụng
            const product = soItem.product;
            if (!product) {
                errors.push(`Sản phẩm ${reqItem.sku}: không tìm thấy thông tin sản phẩm`);
                continue;
            }

            let realStock = stockMap.get(product.id) || 0;
            let approvedBooking = Number(product.approved_booking_stock || 0);
            let availableStock = Math.max(0, realStock - approvedBooking);

            if (product.product_type === 'COMBO' && product.components && product.components.length > 0) {
                let minAvailableStock = Infinity;
                let minRealStock = Infinity;
                let minApprovedBooking = Infinity;
                for (const c of product.components) {
                    const childStock = c.child_product ? (stockMap.get(c.child_product.id) || 0) : 0;
                    const childApproved = Number(c.child_product?.approved_booking_stock || 0);
                    const childAvailable = Math.max(0, childStock - childApproved);
                    const possibleAvailable = Math.floor(childAvailable / Number(c.quantity));
                    const possibleReal = Math.floor(childStock / Number(c.quantity));
                    const possibleApproved = Math.floor(childApproved / Number(c.quantity));
                    if (possibleAvailable < minAvailableStock) minAvailableStock = possibleAvailable;
                    if (possibleReal < minRealStock) minRealStock = possibleReal;
                    if (possibleApproved < minApprovedBooking) minApprovedBooking = possibleApproved;
                }
                realStock = minRealStock === Infinity ? 0 : minRealStock;
                approvedBooking = minApprovedBooking === Infinity ? 0 : minApprovedBooking;
                availableStock = minAvailableStock === Infinity ? 0 : minAvailableStock;
            }

            const requestedQty = Number(reqItem.quantity);

            if (availableStock < requestedQty) {
                errors.push(`${reqItem.sku}: TK khả dụng = ${availableStock} (Thực tế: ${realStock}, Đã duyệt booking: ${approvedBooking}), cần ${requestedQty}`);
            }
        }

        if (errors.length > 0) {
            throw new BadRequestException(`Không thể xuất kho:\n${errors.join('\n')}`);
        }

        let deliveryCode = data.code;
        const existingCode = await this.deliveryRepo.findOne({ where: { code: deliveryCode } });
        if (existingCode) {
            // Fix duplicate code issue if user clicks multiple times in the same minute
            deliveryCode = `${deliveryCode}-${Math.floor(Math.random() * 1000)}`;
        }

        try {
            const delivery = this.deliveryRepo.create({
                code: deliveryCode,
                order_id: orderId,
                delivery_date: data.date,
                note: data.note,
                delivery_address: data.delivery_address,
                contact_name: data.contact_name,
                contact_phone: data.contact_phone,
                sales_order: order,
                attachments: data.attachments || []
            });

            // Ensure proper instantiation of SalesDeliveryItem to guarantee cascade insert
            if (data.items && Array.isArray(data.items)) {
                delivery.items = data.items.map((i: any) => {
                    return {
                        sku: i.sku,
                        quantity: Math.round(Number(i.quantity))
                    } as any;
                });
            }

            const savedDelivery = await this.deliveryRepo.save(delivery);

            // NO AUTO DEDUCT STOCK HERE. 
            // Stock will be deducted when Inventory User confirms (PENDING_EXPORT -> SHIPPED).

            return await this.orderRepo.save(order);
        } catch (e) {
            this.logger.error('Lỗi khi tạo phiếu xuất kho:', e.stack);
            throw new BadRequestException('Lỗi hệ thống khi tạo phiếu xuất kho: ' + e.message);
        }
    }

    async updateDelivery(deliveryId: number, data: any) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId }, relations: ['items'] });
        if (!delivery) throw new NotFoundException('Delivery not found');

        delivery.delivery_date = data.date;
        delivery.note = data.note;
        delivery.delivery_address = data.delivery_address;
        delivery.contact_name = data.contact_name;
        delivery.contact_phone = data.contact_phone;
        if (data.attachments) delivery.attachments = data.attachments; // <--- Update Attachments
        if (data.status) delivery.status = data.status; // <--- Update Status

        if (data.items) {
            // Delete old items
            await this.deliveryRepo.manager.delete('SalesDeliveryItem', { delivery: { id: deliveryId } });

            // Create new items
            // Note: Not adjusting inventory to avoid complex diff logic for now. 
            // Assuming user is fixing data, or will handle inventory manually if needed.
            // Ideally, we should diff old vs new and adjustStock.
            delivery.items = data.items.map((i: any) => ({
                sku: i.sku,
                quantity: Math.round(Number(i.quantity)),
                note: i.note
            }));
        }

        return this.deliveryRepo.save(delivery);
    }

    // --- DELETE DELIVERY (Only if SO is NOT COMPLETED) ---
    async deleteDelivery(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({
            where: { id: deliveryId },
            relations: ['items', 'sales_order', 'sales_order.items', 'sales_order.items.product', 'sales_order.pfos']
        });
        if (!delivery) throw new NotFoundException('Phiếu xuất kho không tồn tại');

        const order = delivery.sales_order;
        if (!order) throw new NotFoundException('Đơn hàng không tồn tại');

        // Block deletion if order is COMPLETED
        if (order.status === 'COMPLETED') {
            throw new Error('Không thể xóa phiếu xuất kho khi đơn hàng đã Hoàn thành');
        }

        for (const item of delivery.items || []) {
            const product = await this.productsService.findOneBySku(item.sku);
            
            // If delivery was already SHIPPED, restore inventory
            if (delivery.status === 'SHIPPED') {
                if (product) {
                    await this.inventoryService.adjustStock(
                        'IMPORT',           // type: restore = import
                        'PRODUCT',          // itemType
                        product.id,         // itemId
                        Number(item.quantity), // quantity
                        delivery.code || 'PXK-DELETE', // refCode
                        `Hoàn kho từ xóa PXK ${delivery.code}`, // note
                        'MAIN'              // warehouse (default)
                    );
                }
            } else if (delivery.status === 'PENDING_EXPORT') {
                // MỚI: Trừ approved_booking_stock nếu chưa xuất kho
                if (product) {
                    const revertQty = Number(item.quantity);
                    if (product.product_type === 'COMBO') {
                        const components = await this.productsService.getComboComponents(product.sku);
                        for (const comp of components) {
                            if (comp.child_product) {
                                const childRevert = revertQty * Number(comp.quantity);
                                comp.child_product.approved_booking_stock = Math.max(0, Number(comp.child_product.approved_booking_stock || 0) - childRevert);
                                await this.productsService.update(comp.child_product.id, { approved_booking_stock: comp.child_product.approved_booking_stock } as any);
                            }
                        }
                    } else {
                        product.approved_booking_stock = Math.max(0, Number(product.approved_booking_stock || 0) - revertQty);
                        await this.productsService.update(product.id, { approved_booking_stock: product.approved_booking_stock } as any);
                    }
                }
            }

            // Revert booked_quantity trên SalesOrderItem
            if (order.items) {
                const soItem = order.items.find(i => i.sku === item.sku);
                if (soItem) {
                    const newBookedQty = Math.max(0, Number(soItem.booked_quantity || 0) - Number(item.quantity));
                    soItem.booked_quantity = newBookedQty;
                    if (newBookedQty === 0) {
                        soItem.booking_status = BookingStatus.NONE; // HOẶC TEMPORARY tuỳ logic, set NONE là xoá booking luôn
                    }
                    await this.deliveryRepo.manager.save('SalesOrderItem', soItem);
                }
            }
        }

        // MỚI: Invalidate MRP cache của plan
        if (order.pfos && order.pfos.length > 0 && order.pfos[0].id) {
            await this.deliveryRepo.manager.update('ProductionFulfillmentOrder', order.pfos[0].id, {
                mrp_data: null,
                outsourcing_data: null,
                logistics_data: null
            });
        }

        // Delete delivery items first
        await this.deliveryRepo.manager.delete('SalesDeliveryItem', { delivery: { id: deliveryId } });

        // Delete delivery
        await this.deliveryRepo.delete(deliveryId);

        return { success: true, message: 'Đã xóa phiếu xuất kho' };
    }

    // --- BOOKING STOCK (TEMPORARY 5-DAY LOCK) ---
    async bookItems(orderId: number, items: { itemId: number, quantity: number }[]) {
        const order = await this.orderRepo.findOne({ where: { id: orderId }, relations: ['items', 'items.product'] });
        if (!order) throw new NotFoundException('Order not found');

        const errors = [];
        let bookedCount = 0;

        // Fetch real stock from inventory_stocks table (source of truth)
        const allStocks = await this.inventoryService.getAllStocks();
        const stockMap = new Map<number, number>(); // productId -> total stock (excl KHO_MAU)
        for (const s of allStocks) {
            if (s.item_type === 'PRODUCT' && s.warehouse_code !== 'KHO_MAU') {
                const key = Number(s.item_id);
                stockMap.set(key, (stockMap.get(key) || 0) + Number(s.quantity));
            }
        }

        // If items not provided or empty, try to book ALL unbooked items
        const itemsToBook = (items && items.length > 0) ? items : order.items.map(i => ({ itemId: i.id, quantity: Number(i.quantity) - Number(i.booked_quantity || 0) })).filter(i => i.quantity > 0);

        for (const reqItem of itemsToBook) {
            const orderItem = order.items.find(i => i.id === reqItem.itemId);
            if (!orderItem) continue;

            const product = orderItem.product;
            if (!product) continue;

            const requestedQty = Number(reqItem.quantity);
            if (requestedQty <= 0) continue;

            // Prevent over-booking
            const remainingToBook = Number(orderItem.quantity) - Number(orderItem.booked_quantity || 0);
            const qtyToBook = Math.min(requestedQty, remainingToBook);
            if (qtyToBook <= 0) continue;

            if (product.product_type === 'COMBO') {
                const components = await this.productsService.getComboComponents(product.sku);
                let canBookCombo = true;
                
                // 1. Verify using real stock
                for (const comp of components) {
                    const child = comp.child_product;
                    const neededQty = qtyToBook * Number(comp.quantity);
                    const realStock = stockMap.get(child.id) || 0;
                    const available = realStock - Number(child.approved_booking_stock || 0);
                    if (available < neededQty) {
                        canBookCombo = false;
                        errors.push(`Thành phần ${child.sku} của Combo ${product.sku} không đủ tồn kho. (Avail: ${available}, Need: ${neededQty})`);
                        break;
                    }
                }

                if (canBookCombo) {
                    // 2. Lock stock
                    for (const comp of components) {
                        const child = comp.child_product;
                        const neededQty = qtyToBook * Number(comp.quantity);
                        child.booking_stock = Number(child.booking_stock || 0) + neededQty;
                        await this.productsService.update(child.id, { booking_stock: child.booking_stock });
                    }
                    
                    orderItem.booked_quantity = Number(orderItem.booked_quantity || 0) + qtyToBook;
                    orderItem.booking_status = BookingStatus.TEMPORARY;
                    const expires = new Date();
                    expires.setDate(expires.getDate() + 5);
                    orderItem.booking_expires_at = expires;
                    await this.itemRepo.save(orderItem);
                    bookedCount++;
                }
            } else {
                // NORMAL PRODUCT - Use real stock from inventory
                const realStock = stockMap.get(product.id) || 0;
                const available = realStock - Number(product.approved_booking_stock || 0);
                if (available < qtyToBook) {
                    errors.push(`Sản phẩm ${product.sku} không đủ tồn kho. (Avail: ${available}, Need: ${qtyToBook})`);
                    continue;
                }

                product.booking_stock = Number(product.booking_stock || 0) + qtyToBook;
                await this.productsService.update(product.id, { booking_stock: product.booking_stock });

                orderItem.booked_quantity = Number(orderItem.booked_quantity || 0) + qtyToBook;
                orderItem.booking_status = BookingStatus.TEMPORARY;
                const expires = new Date();
                expires.setDate(expires.getDate() + 5);
                orderItem.booking_expires_at = expires;
                await this.itemRepo.save(orderItem);
                bookedCount++;
            }
        }

        if (errors.length > 0 && bookedCount === 0) {
            return { success: false, errors };
        }

        return { success: true, message: `Đã book thành công ${bookedCount} sản phẩm.`, errors: errors.length > 0 ? errors : undefined };
    }

    // --- CRON JOB: AUTO EXPIRE BOOKINGS ---
    @Cron(CronExpression.EVERY_HOUR)
    async checkExpiredBookings() {
        const now = new Date();
        const expiredItems = await this.itemRepo.find({
            where: {
                booking_status: BookingStatus.TEMPORARY,
                booking_expires_at: LessThan(now)
            },
            relations: ['product']
        });

        if (expiredItems.length === 0) return;

        for (const item of expiredItems) {
            const product = item.product;
            if (product) {
                if (product.product_type === 'COMBO') {
                    const components = await this.productsService.getComboComponents(product.sku);
                    for (const comp of components) {
                        const child = comp.child_product;
                        const returnQty = Number(item.booked_quantity) * Number(comp.quantity);
                        child.booking_stock = Math.max(0, Number(child.booking_stock || 0) - returnQty);
                        await this.productsService.update(child.id, { booking_stock: child.booking_stock });
                    }
                } else {
                    product.booking_stock = Math.max(0, Number(product.booking_stock || 0) - Number(item.booked_quantity));
                    await this.productsService.update(product.id, { booking_stock: product.booking_stock });
                }
            }

            item.booking_status = BookingStatus.EXPIRED;
            item.booked_quantity = 0;
            item.booking_expires_at = null;
            await this.itemRepo.save(item);
        }
        
        this.logger.log(`Expired ${expiredItems.length} temporary bookings.`);
    }

    // --- DELIVERY EMAIL ---
    async sendDeliveryEmail(deliveryId: number) {
        const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId }, relations: ['items', 'sales_order', 'sales_order.customer'] });
        if (!delivery) throw new NotFoundException('Delivery not found');

        const order = delivery.sales_order;
        const customer = order.customer;
        const smtpConfig = await this.systemService.getSmtpConfig();

        if (!smtpConfig.SMTP_HOST || !smtpConfig.SMTP_USER) {
            throw new Error('SMTP Config missing');
        }

        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: smtpConfig.SMTP_HOST,
            port: Number(smtpConfig.SMTP_PORT) || 587,
            secure: smtpConfig.SMTP_SECURE === 'true',
            auth: { user: smtpConfig.SMTP_USER, pass: smtpConfig.SMTP_PASS }
        });

        // Template
        const itemsHtml = delivery.items.map((i, idx) => `
            <tr>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${idx + 1}</td>
                <td style="padding:8px;border:1px solid #ddd;">${i.sku}</td>
                <td style="padding:8px;border:1px solid #ddd;text-align:center;">${i.quantity}</td>
                <td style="padding:8px;border:1px solid #ddd;"></td> 
            </tr>
        `).join('');

        const portalLink = `https://erp4u.vn/portal/quote/${order.uuid}`; // Replace with actual domain from env if possible, or config

        const html = `
            <div style="font-family: Arial, sans-serif; color: #333;">
                <h2 style="color: #1890ff;">Thông Báo Giao Hàng</h2>
                <p>Kính gửi <b>${customer ? customer.name : (order.customer_name || delivery.contact_name)}</b>,</p>
                <p>Đơn hàng <b>${order.order_code}</b> của quý khách đang được giao.</p>
                
                <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><b>Mã Phiếu Xuất:</b> ${delivery.code}</p>
                    <p><b>Ngày Giao:</b> ${new Date(delivery.delivery_date).toLocaleDateString('vi-VN')}</p>
                    <p><b>Người Nhận:</b> ${delivery.contact_name} (${delivery.contact_phone})</p>
                    <p><b>Địa Chỉ:</b> ${delivery.delivery_address}</p>
                </div>

                <h3>Chi Tiết Giao Hàng:</h3>
                <table style="width:100%; border-collapse:collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background:#eee;">
                            <th style="padding:8px;border:1px solid #ddd;">STT</th>
                            <th style="padding:8px;border:1px solid #ddd;">Sản Phẩm</th>
                            <th style="padding:8px;border:1px solid #ddd;">SL</th>
                            <th style="padding:8px;border:1px solid #ddd;">Ghi Chú</th>
                        </tr>
                    </thead>
                    <tbody>${itemsHtml}</tbody>
                </table>

                <p>Quý khách có thể theo dõi tiến độ đơn hàng tại:</p>
                <a href="${portalLink}" style="display:inline-block;padding:10px 20px;background:#1890ff;color:#fff;text-decoration:none;border-radius:4px;">Xem Đơn Hàng Online</a>
                
                <p style="margin-top:20px; font-size:12px; color:#999;">Cảm ơn quý khách đã tin tưởng ERP4U.</p>
            </div>
        `;

        await transporter.sendMail({
            from: `"${smtpConfig.SMTP_FROM_NAME}" <${smtpConfig.SMTP_FROM_EMAIL}>`,
            to: (customer && customer.email) || 'shinwon93@gmail.com', // Fallback for dev/demo or use contact email
            subject: `[ERP4U] Thông Báo Giao Hàng - ${delivery.code}`,
            html: html
        });

        delivery.email_sent = true;
        delivery.status = 'SHIPPED'; // Update status
        return this.deliveryRepo.save(delivery);
    }

    // ========================================
    // === CHECKLIST MANAGEMENT METHODS ===
    // ========================================

    /**
     * Initialize checklist for an order (called when creating order)
     */
    async initChecklist(orderId: number, initialStatus: string = 'QUOTATION'): Promise<SalesChecklist> {
        // Check if checklist already exists
        let checklist = await this.checklistRepo.findOne({ where: { order_id: orderId } });

        if (!checklist) {
            checklist = this.checklistRepo.create({ order_id: orderId, items: [] });
            checklist = await this.checklistRepo.save(checklist);
        }

        // Add items for initial stage
        await this.addChecklistItemsForStage(checklist.id, initialStatus);

        return this.getChecklist(orderId);
    }

    /**
     * Get checklist with all items for an order
     */
    async getChecklist(orderId: number): Promise<any> {
        const checklist = await this.checklistRepo.findOne({
            where: { order_id: orderId },
            relations: ['items'],
        });

        if (!checklist) {
            // Auto-create if not exists, respecting current Order Status
            const order = await this.orderRepo.findOne({ where: { id: orderId } });
            return this.initChecklist(orderId, order?.status || 'QUOTATION');
        }

        // Sort items by sort_order
        checklist.items = (checklist.items || []).sort((a, b) => a.sort_order - b.sort_order);

        // Calculate progress
        const total = checklist.items.length;
        const completed = checklist.items.filter(i => i.is_completed).length;

        return {
            ...checklist,
            progress: { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 }
        };
    }

    /**
     * Toggle a checklist item (complete/uncomplete)
     */
    async toggleChecklistItem(itemId: number, completedBy?: string): Promise<SalesChecklistItem> {
        const item = await this.checklistItemRepo.findOne({ where: { id: itemId } });
        if (!item) throw new NotFoundException('Checklist item not found');

        item.is_completed = !item.is_completed;
        item.completed_at = item.is_completed ? new Date() : null;
        item.completed_by = item.is_completed ? (completedBy || 'User') : null;

        return this.checklistItemRepo.save(item);
    }

    /**
     * Add a custom task to the checklist
     */
    async addCustomChecklistItem(orderId: number, taskName: string, dueDate?: Date): Promise<SalesChecklistItem> {
        const checklist = await this.checklistRepo.findOne({ where: { order_id: orderId } });
        if (!checklist) throw new NotFoundException('Checklist not found');

        // Get max sort order
        const maxSort = await this.checklistItemRepo
            .createQueryBuilder('item')
            .select('MAX(item.sort_order)', 'max')
            .where('item.checklist_id = :id', { id: checklist.id })
            .getRawOne();

        const newItem = this.checklistItemRepo.create({
            checklist_id: checklist.id,
            task_code: 'CUSTOM_' + Date.now(),
            task_name: taskName,
            stage: 'CUSTOM',
            is_completed: false,
            due_date: dueDate || null,
            sort_order: (maxSort?.max || 0) + 1,
        });

        return this.checklistItemRepo.save(newItem);
    }

    /**
     * Update checklist note for an item
     */
    async updateChecklistItemNote(itemId: number, note: string): Promise<SalesChecklistItem> {
        const item = await this.checklistItemRepo.findOne({ where: { id: itemId } });
        if (!item) throw new NotFoundException('Checklist item not found');
        item.note = note;
        return this.checklistItemRepo.save(item);
    }

    /**
     * Add checklist items for a specific stage (internal helper)
     */
    private async addChecklistItemsForStage(checklistId: number, stage: string): Promise<void> {
        const templates = CHECKLIST_TEMPLATES[stage];
        if (!templates || templates.length === 0) return;

        // Check which items already exist
        const existing = await this.checklistItemRepo.find({ where: { checklist_id: checklistId } });
        const existingCodes = existing.map(e => e.task_code);

        const newItems = templates
            .filter(t => !existingCodes.includes(t.code))
            .map(t => this.checklistItemRepo.create({
                checklist_id: checklistId,
                task_code: t.code,
                task_name: t.name,
                stage: stage,
                is_completed: false,
                sort_order: t.sort,
            }));

        if (newItems.length > 0) {
            await this.checklistItemRepo.save(newItems);
        }
    }

    /**
     * Sync checklist when order status changes
     * Call this after any status update to add new stage tasks
     */
    async syncChecklistWithStatus(orderId: number, newStatus: string): Promise<any> {
        const checklist = await this.checklistRepo.findOne({ where: { order_id: orderId } });
        if (!checklist) {
            return this.initChecklist(orderId, newStatus);
        }

        // Add items for new stage
        await this.addChecklistItemsForStage(checklist.id, newStatus);

        return this.getChecklist(orderId);
    }

    /**
     * Delete a custom checklist item
     */
    async deleteChecklistItem(itemId: number): Promise<void> {
        const item = await this.checklistItemRepo.findOne({ where: { id: itemId } });
        if (!item) throw new NotFoundException('Checklist item not found');
        if (!item.task_code.startsWith('CUSTOM_')) {
            throw new Error('Cannot delete system-generated checklist items');
        }
        await this.checklistItemRepo.delete(itemId);
    }

    // ===================== ANALYTICS DASHBOARD =====================

    private readonly FORECAST_WEIGHTS: Record<string, number> = {
        NEW: 0.05,
        CONTACTED: 0.10,
        QUALIFIED: 0.20,
        SAMPLE_APPROVED: 0.50,
        NEGOTIATION: 0.80,
        WON: 1.0,
    };

    async getAnalyticsDashboard(filters: {
        startDate?: string; endDate?: string;
        assignedToId?: number; productType?: string;
    }) {
        const start = filters.startDate ? new Date(filters.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = filters.endDate ? new Date(filters.endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // Previous period (same duration)
        const duration = end.getTime() - start.getTime();
        const prevStart = new Date(start.getTime() - duration);
        const prevEnd = new Date(start.getTime() - 1);

        // === 1. KPI CARDS ===
        const kpi = await this.calculateKPIs(start, end, prevStart, prevEnd, filters.assignedToId);

        // === 2. FUNNEL DATA (Lead Source) ===
        const funnelData = await this.calculateFunnelData(start, end, filters.assignedToId);

        // === 3. VELOCITY DATA ===
        const velocityData = await this.calculateVelocityData(filters.assignedToId);

        // === 4. SCORECARD DATA ===
        const scorecardData = await this.calculateScorecardData(start, end);

        // === 5. FORECAST DATA ===
        const forecastData = await this.calculateForecastData();

        // === 6. TOP PRODUCTS ===
        const topProducts = await this.calculateTopProductsData(start, end, filters.assignedToId);

        // === 7. LOST DEAL ANALYSIS (grouped by lead_source) ===
        const lostReasons = await this.calculateLostReasonData(start, end);

        // === 8. ACCOUNTS RECEIVABLE AGING ===
        const accountsReceivable = await this.calculateAccountsReceivableData();

        // === 9. MONTHLY TREND (12 months) ===
        const monthlyTrend = await this.calculateMonthlyTrendData();

        // === 10. TOP CUSTOMERS ===
        const topCustomers = await this.calculateTopCustomersData(start, end, filters.assignedToId);

        // === 11. HIGH-VALUE LEADS TO WIN ===
        const highValueLeads = await this.calculateHighValueLeadsData(filters.assignedToId);

        // === 12. TOP CATEGORIES ===
        const topCategories = await this.calculateTopCategoriesData(start, end, filters.assignedToId);

        // === 13. REGION STATS (District & Province) ===
        const regionData = await this.calculateRegionData(start, end, filters.assignedToId);

        return { kpi, funnelData, velocityData, scorecardData, forecastData, topProducts, lostReasons, accountsReceivable, monthlyTrend, topCustomers, highValueLeads, topCategories, regionData };
    }

    private async calculateKPIs(
        start: Date, end: Date, prevStart: Date, prevEnd: Date, assignedToId?: number
    ) {
        // Current period leads
        const leadsQuery = this.customerRepo.createQueryBuilder('c')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.created_at BETWEEN :start AND :end', { start, end });
        if (assignedToId) leadsQuery.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
        const totalLeads = await leadsQuery.getCount();

        // WON leads
        const wonQuery = this.customerRepo.createQueryBuilder('c')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.lead_status = :s', { s: 'WON' })
            .andWhere('c.created_at BETWEEN :start AND :end', { start, end });
        if (assignedToId) wonQuery.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
        const wonLeads = await wonQuery.getCount();

        const conversionRate = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

        // Pipeline Value (open leads)
        const pipelineQuery = this.customerRepo.createQueryBuilder('c')
            .select('COALESCE(SUM(c.potential_value), 0)', 'total')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.created_at BETWEEN :start AND :end', { start, end })
            .andWhere('c.lead_status NOT IN (:...closed)', { closed: ['WON', 'LOST'] });
        if (assignedToId) pipelineQuery.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
        const pipelineResult = await pipelineQuery.getRawOne();
        const pipelineValue = Number(pipelineResult?.total || 0);

        // Expected Revenue (All quotes in timeframe)
        const expectedResult = await this.orderRepo.createQueryBuilder('o')
            .select('COALESCE(SUM(o.total_amount), 0)', 'total')
            .where('o.status = :status', { status: 'QUOTATION' })
            .andWhere('o.order_date BETWEEN :start AND :end', { start, end });
        if (assignedToId) expectedResult.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
        const expectedRevenue = Number((await expectedResult.getRawOne())?.total || 0);

        // Actual Revenue (All confirmed SOs - not requiring transactions to exist)
        const actualQuery = this.orderRepo.createQueryBuilder('o')
            .select('COALESCE(SUM(o.total_amount), 0)', 'total')
            .where('o.status NOT IN (:...statuses)', { statuses: ['QUOTATION', 'CANCELLED'] })
            .andWhere('o.order_date BETWEEN :start AND :end', { start, end });
        if (assignedToId) actualQuery.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
        const actualRevenue = Number((await actualQuery.getRawOne())?.total || 0);

        // Paid Revenue (Sum of all payments)
        const paidQuery = this.transRepo.createQueryBuilder('t')
            .select('COALESCE(SUM(t.amount), 0)', 'total')
            .where('t.reference_type = :type', { type: 'SALES' })
            .andWhere('t.date BETWEEN :start AND :end', { start, end });
        if (assignedToId) {
            paidQuery.innerJoin(SalesOrder, 'o', 't.reference_code = o.order_code')
                .andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
        }
        const paidRevenue = Number((await paidQuery.getRawOne())?.total || 0);

        // Previous period for trends
        const prevLeadsQuery = this.customerRepo.createQueryBuilder('c')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.created_at BETWEEN :start AND :end', { start: prevStart, end: prevEnd });
        if (assignedToId) prevLeadsQuery.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
        const prevLeads = await prevLeadsQuery.getCount();
        
        const prevPipelineQuery = this.customerRepo.createQueryBuilder('c')
            .select('COALESCE(SUM(c.potential_value), 0)', 'total')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.created_at BETWEEN :start AND :end', { start: prevStart, end: prevEnd })
            .andWhere('c.lead_status NOT IN (:...closed)', { closed: ['WON', 'LOST'] });
        if (assignedToId) prevPipelineQuery.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
        const prevPipelineValue = Number((await prevPipelineQuery.getRawOne())?.total || 0);

        const prevActualQuery = this.orderRepo.createQueryBuilder('o')
            .select('COALESCE(SUM(o.total_amount), 0)', 'total')
            .where('o.status NOT IN (:...statuses)', { statuses: ['QUOTATION', 'CANCELLED'] })
            .andWhere('o.order_date BETWEEN :start AND :end', { start: prevStart, end: prevEnd });
        if (assignedToId) prevActualQuery.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
        const prevActual = Number((await prevActualQuery.getRawOne())?.total || 0);

        const prevExpectedQuery = this.orderRepo.createQueryBuilder('o')
            .select('COALESCE(SUM(o.total_amount), 0)', 'total')
            .where('o.status = :status', { status: 'QUOTATION' })
            .andWhere('o.order_date BETWEEN :start AND :end', { start: prevStart, end: prevEnd });
        if (assignedToId) prevExpectedQuery.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
        const prevExpected = Number((await prevExpectedQuery.getRawOne())?.total || 0);

        const prevPaidQuery = this.transRepo.createQueryBuilder('t')
            .select('COALESCE(SUM(t.amount), 0)', 'total')
            .where('t.reference_type = :type', { type: 'SALES' })
            .andWhere('t.date BETWEEN :start AND :end', { start: prevStart, end: prevEnd });
        if (assignedToId) {
            prevPaidQuery.innerJoin(SalesOrder, 'o', 't.reference_code = o.order_code')
                .andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
        }
        const prevPaid = Number((await prevPaidQuery.getRawOne())?.total || 0);

        const trendPercent = (current: number, prev: number) =>
            prev > 0 ? Math.round(((current - prev) / prev) * 100) : (current > 0 ? 100 : 0);

        // 4. Funnel Stages (cumulative from all leads in period)
        const qs = (statuses: string[]) => {
            const q = this.customerRepo.createQueryBuilder('c')
                .where('c.type = :type', { type: 'LEAD' })
                .andWhere('c.created_at BETWEEN :start AND :end', { start, end })
                .andWhere('c.lead_status IN (:...s)', { s: statuses });
            if (assignedToId) q.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
            return q.getCount();
        };

        const funnelStages = {
            new: totalLeads,
            contacted: await qs(['CONTACTED', 'QUALIFIED', 'SAMPLE_APPROVED', 'NEGOTIATION', 'WON']),
            qualified: await qs(['QUALIFIED', 'SAMPLE_APPROVED', 'NEGOTIATION', 'WON']),
            sample_approved: await qs(['SAMPLE_APPROVED', 'NEGOTIATION', 'WON']),
            negotiation: await qs(['NEGOTIATION', 'WON']),
            won: wonLeads,
        };

        return {
            totalLeads,
            conversionRate,
            pipelineValue,
            expectedRevenue,
            actualRevenue,
            paidRevenue,
            funnelStages,
            trends: {
                leadsTrend: trendPercent(totalLeads, prevLeads),
                expectedTrend: trendPercent(expectedRevenue, prevExpected),
                actualTrend: trendPercent(actualRevenue, prevActual),
                paidTrend: trendPercent(paidRevenue, prevPaid),
                pipelineTrend: trendPercent(pipelineValue, prevPipelineValue),
            }
        };
    }

    private async calculateFunnelData(start: Date, end: Date, assignedToId?: number) {
        const sources = ['OUTBOUND', 'REFERRAL', 'FACEBOOK', 'WEBSITE', 'RETURNING_CUSTOMER', 'OTHER'];
        const result = [];

        // 1. Fetch leads info grouped by source
        const leadsQuery = this.customerRepo.createQueryBuilder('c')
            .select('c.lead_source', 'source')
            .addSelect('COUNT(*)', 'total')
            .addSelect(`SUM(CASE WHEN c.lead_status IN ('QUALIFIED', 'NEGOTIATION', 'WON', 'SAMPLE_APPROVED') THEN 1 ELSE 0 END)`, 'qualified')
            .addSelect(`SUM(CASE WHEN c.lead_status = 'WON' THEN 1 ELSE 0 END)`, 'won')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.created_at BETWEEN :start AND :end', { start, end });
        if (assignedToId) leadsQuery.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
        
        const leadsResult = await leadsQuery.groupBy('c.lead_source').getRawMany();
        
        // 2. Fetch avg order value grouped by source
        const avgQuery = this.orderRepo.createQueryBuilder('o')
            .select('c.lead_source', 'source')
            .addSelect('COALESCE(AVG(o.total_amount), 0)', 'avg')
            .innerJoin('o.customer', 'c')
            .where('o.status NOT IN (:...ex)', { ex: ['CANCELLED', 'QUOTATION'] })
            .andWhere('o.order_date BETWEEN :start AND :end', { start, end });
        if (assignedToId) avgQuery.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
        
        const avgResult = await avgQuery.groupBy('c.lead_source').getRawMany();
        const avgMap = new Map(avgResult.map(r => [r.source, Number(r.avg)]));

        for (const source of sources) {
            const lData = leadsResult.find(r => r.source === source) || { total: 0, qualified: 0, won: 0 };
            const leads = Number(lData.total);
            if (leads === 0) continue;
            
            const qualified = Number(lData.qualified);
            const won = Number(lData.won);
            const avgOrderValue = Math.round(avgMap.get(source) || 0);

            result.push({
                source,
                sourceLabel: this.getSourceLabel(source),
                leads,
                qualified,
                unqualified: leads - qualified,
                won,
                winRate: Math.round((won / leads) * 100),
                avgOrderValue,
            });
        }

        return result;
    }

    private getSourceLabel(source: string): string {
        const labels: Record<string, string> = {
            OUTBOUND: 'Đi thị trường',
            REFERRAL: 'Khách cũ giới thiệu',
            FACEBOOK: 'Facebook/Ads',
            WEBSITE: 'Website',
            RETURNING_CUSTOMER: 'Khách hàng cũ',
            OTHER: 'Khác',
        };
        return labels[source] || source;
    }

    private async calculateVelocityData(assignedToId?: number) {
        const query = this.customerRepo.createQueryBuilder('c')
            .leftJoinAndSelect('c.assigned_to', 'u')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.lead_status IN (:...statuses)', { statuses: ['QUALIFIED', 'SAMPLE_APPROVED', 'CONTACTED', 'NEGOTIATION'] });
        if (assignedToId) query.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });

        const leads = await query.getMany();
        const now = new Date();

        return leads.map(lead => {
            // Calculate days since last action from history
            const history = lead.history || [];
            const lastAction = history.length > 0 ? history[history.length - 1] : null;
            const lastActionDate = lastAction?.date ? new Date(lastAction.date) : lead.updated_at;
            const daysSinceLastAction = Math.floor((now.getTime() - lastActionDate.getTime()) / (1000 * 60 * 60 * 24));

            // Alert level
            let alertLevel = 'green';
            if (lead.lead_status === 'QUALIFIED' && daysSinceLastAction > 3) alertLevel = 'red';
            else if (lead.lead_status === 'SAMPLE_APPROVED' && daysSinceLastAction > 5) alertLevel = 'orange';
            else if (daysSinceLastAction > 7) alertLevel = 'orange';

            return {
                customerId: lead.id,
                customerName: lead.name,
                phone: lead.phone,
                status: lead.lead_status,
                leadSource: lead.lead_source,
                potentialValue: Number(lead.potential_value),
                daysSinceLastAction,
                lastActionDate: lastActionDate.toISOString(),
                assignedTo: lead.assigned_to?.full_name || lead.assigned_to?.username || 'N/A',
                assignedToId: lead.assigned_to_id,
                alertLevel,
            };
        }).sort((a, b) => b.daysSinceLastAction - a.daysSinceLastAction);
    }

    private async calculateScorecardData(start: Date, end: Date) {
        // Get all sales users
        const users = await this.userRepo.find();
        const salesUsers = [];

        // Pre-fetch all targets for the first month of the range
        const year = start.getFullYear();
        const month = start.getMonth() + 1;
        const targets = await this.targetRepo.find({ where: { year, month } });
        const targetMap = new Map(targets.map(t => [t.user_id, t]));

        // Aggregate actual revenue by user
        const revResult = await this.orderRepo.createQueryBuilder('o')
            .select('o.assigned_to_id', 'uid')
            .addSelect('COALESCE(SUM(o.total_amount), 0)', 'total')
            .where('o.status NOT IN (:...s)', { s: ['QUOTATION', 'CANCELLED'] })
            .andWhere('o.order_date BETWEEN :start AND :end', { start, end })
            .andWhere('o.assigned_to_id IS NOT NULL')
            .groupBy('o.assigned_to_id')
            .getRawMany();
        const revMap = new Map(revResult.map(r => [r.uid, Number(r.total)]));

        // Aggregate new leads by user
        const newLeadsResult = await this.customerRepo.createQueryBuilder('c')
            .select('c.assigned_to_id', 'uid')
            .addSelect('COUNT(*)', 'count')
            .where('c.type = :type', { type: 'LEAD' })
            .andWhere('c.created_at BETWEEN :start AND :end', { start, end })
            .andWhere('c.assigned_to_id IS NOT NULL')
            .groupBy('c.assigned_to_id')
            .getRawMany();
        const newLeadsMap = new Map(newLeadsResult.map(r => [r.uid, Number(r.count)]));

        // Aggregate average days to close by user
        const closedOrders = await this.orderRepo.createQueryBuilder('o')
            .where('o.status = :s', { s: 'COMPLETED' })
            .andWhere('o.order_date BETWEEN :start AND :end', { start, end })
            .andWhere('o.assigned_to_id IS NOT NULL')
            .getMany();
        const closedDaysMap = new Map<number, { totalDays: number, count: number }>();
        for (const o of closedOrders) {
            if (!o.assigned_to_id) continue;
            const created = new Date(o.order_date).getTime();
            const updated = new Date(o.updated_at).getTime();
            const days = Math.floor((updated - created) / (1000 * 60 * 60 * 24));
            const stat = closedDaysMap.get(o.assigned_to_id) || { totalDays: 0, count: 0 };
            stat.totalDays += days;
            stat.count += 1;
            closedDaysMap.set(o.assigned_to_id, stat);
        }

        // Aggregate activities by user
        const allLeads = await this.customerRepo.find({ where: { type: 'LEAD' as any } });
        const activitiesMap = new Map<number, number>();
        for (const lead of allLeads) {
            if (!lead.assigned_to_id) continue;
            const h = lead.history || [];
            const count = h.filter((entry: any) => {
                const entryDate = new Date(entry.date);
                return entryDate >= start && entryDate <= end;
            }).length;
            if (count > 0) {
                activitiesMap.set(lead.assigned_to_id, (activitiesMap.get(lead.assigned_to_id) || 0) + count);
            }
        }

        for (const user of users) {
            const actualRevenue = revMap.get(user.id) || 0;
            const newLeads = newLeadsMap.get(user.id) || 0;
            const activities = activitiesMap.get(user.id) || 0;
            
            // Only include user if they have any activity, revenue, leads, or a target
            const target = targetMap.get(user.id);
            if (actualRevenue === 0 && newLeads === 0 && activities === 0 && !target) continue;

            let avgDaysToClose = 0;
            const closedStats = closedDaysMap.get(user.id);
            if (closedStats && closedStats.count > 0) {
                avgDaysToClose = Math.round(closedStats.totalDays / closedStats.count);
            }

            salesUsers.push({
                userId: user.id,
                userName: (user as any).full_name || (user as any).username,
                targetRevenue: Number(target?.target_revenue || 0),
                targetLeads: target?.target_leads || 0,
                targetActivities: target?.target_activities || 0,
                actualRevenue,
                newLeads,
                avgDaysToClose,
                activities,
            });
        }

        return salesUsers;
    }

    private async calculateForecastData() {
        const now = new Date();
        const months = [];

        // Past 3 months actual
        for (let i = 3; i >= 1; i--) {
            const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

            const result = await this.orderRepo.createQueryBuilder('o')
                .select('COALESCE(SUM(o.total_amount), 0)', 'total')
                .where('o.status NOT IN (:...s)', { s: ['QUOTATION', 'CANCELLED'] })
                .andWhere('o.order_date BETWEEN :start AND :end', { start: monthStart, end: monthEnd })
                .getRawOne();

            months.push({
                month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
                label: `T${monthStart.getMonth() + 1}`,
                actualRevenue: Number(result?.total || 0),
                forecastRevenue: Number(result?.total || 0), // Past = actual
            });
        }

        // Current month (partial actual + forecast)
        const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const currentResult = await this.orderRepo.createQueryBuilder('o')
            .select('COALESCE(SUM(o.total_amount), 0)', 'total')
            .where('o.status NOT IN (:...s)', { s: ['QUOTATION', 'CANCELLED'] })
            .andWhere('o.order_date BETWEEN :start AND :end', { start: currentMonthStart, end: now })
            .getRawOne();

        // Forecast from open deals
        const openLeads = await this.customerRepo.find({
            where: { type: 'LEAD' as any },
        });
        const currentForecast = openLeads.reduce((sum, lead) => {
            if (lead.lead_status === 'WON' || lead.lead_status === 'LOST') return sum;
            const weight = this.FORECAST_WEIGHTS[lead.lead_status] || 0.05;
            return sum + Number(lead.potential_value || 0) * weight;
        }, 0);

        months.push({
            month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
            label: `T${now.getMonth() + 1} (hiện tại)`,
            actualRevenue: Number(currentResult?.total || 0),
            forecastRevenue: Number(currentResult?.total || 0) + currentForecast,
        });

        // Next 2 months forecast
        for (let i = 1; i <= 2; i++) {
            const futureMonth = new Date(now.getFullYear(), now.getMonth() + i, 1);
            // Distribute forecast across future months (60% next, 40% after)
            const monthForecast = currentForecast * (i === 1 ? 0.6 : 0.4);

            months.push({
                month: `${futureMonth.getFullYear()}-${String(futureMonth.getMonth() + 1).padStart(2, '0')}`,
                label: `T${futureMonth.getMonth() + 1} (dự báo)`,
                actualRevenue: 0,
                forecastRevenue: Math.round(monthForecast),
            });
        }

        return months;
    }

    // ===================== NEW ANALYTICS: TOP PRODUCTS =====================
    private async calculateTopProductsData(start: Date, end: Date, assignedToId?: number) {
        try {
            const query = this.itemRepo.createQueryBuilder('i')
                .select('i.sku', 'sku')
                .addSelect('p.name', 'productName')
                .addSelect('p.category', 'category')
                .addSelect('SUM(i.quantity)', 'totalQuantity')
                .addSelect('SUM(i.subtotal)', 'totalRevenue')
                .addSelect('COUNT(DISTINCT i.order_id)', 'orderCount')
                .innerJoin('i.order', 'o')
                .leftJoin('i.product', 'p')
                .where('o.status NOT IN (:...statuses)', { statuses: ['QUOTATION', 'CANCELLED'] })
                .andWhere('o.order_date BETWEEN :start AND :end', { start, end });
            if (assignedToId) query.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
            query.groupBy('i.sku')
                .addGroupBy('p.name')
                .addGroupBy('p.category')
                .orderBy('"totalRevenue"', 'DESC')
                .limit(10);
            const results = await query.getRawMany();
            return results.map(r => ({
                sku: r.sku,
                productName: r.productName || 'N/A',
                category: r.category || 'N/A',
                totalQuantity: Number(r.totalQuantity || 0),
                totalRevenue: Number(r.totalRevenue || 0),
                orderCount: Number(r.orderCount || 0),
            }));
        } catch (e) {
            console.error('Error calculating top products:', e);
            return [];
        }
    }

    // ===================== NEW ANALYTICS: TOP CATEGORIES =====================
    private async calculateTopCategoriesData(start: Date, end: Date, assignedToId?: number) {
        try {
            const query = this.itemRepo.createQueryBuilder('i')
                .select('COALESCE(p.category, \'Chưa phân loại\')', 'category')
                .addSelect('SUM(i.quantity)', 'totalQuantity')
                .addSelect('SUM(i.subtotal)', 'totalRevenue')
                .addSelect('COUNT(DISTINCT i.order_id)', 'orderCount')
                .innerJoin('i.order', 'o')
                .leftJoin('i.product', 'p')
                .where('o.status NOT IN (:...statuses)', { statuses: ['QUOTATION', 'CANCELLED'] })
                .andWhere('o.order_date BETWEEN :start AND :end', { start, end });
            
            if (assignedToId) query.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
            
            query.groupBy('p.category')
                .orderBy('"totalRevenue"', 'DESC')
                .limit(10);
            const results = await query.getRawMany();
            return results.map(r => ({
                category: r.category || 'N/A',
                totalQuantity: Number(r.totalQuantity || 0),
                totalRevenue: Number(r.totalRevenue || 0),
                orderCount: Number(r.orderCount || 0),
            }));
        } catch (e) {
            console.error('Error calculating top categories:', e);
            return [];
        }
    }

    // ===================== NEW ANALYTICS: REGION STATS =====================
    private async calculateRegionData(start: Date, end: Date, assignedToId?: number) {
        try {
            const query = this.orderRepo.createQueryBuilder('o')
                .select('COALESCE(c.province, \'Chưa cập nhật\')', 'province')
                .addSelect('COALESCE(c.district, \'Chưa cập nhật\')', 'district')
                .addSelect('SUM(o.total_amount)', 'totalRevenue')
                .addSelect('COUNT(DISTINCT c.id)', 'customerCount')
                .addSelect('COUNT(o.id)', 'orderCount')
                .innerJoin('o.customer', 'c')
                .where('o.status NOT IN (:...statuses)', { statuses: ['QUOTATION', 'CANCELLED'] })
                .andWhere('o.order_date BETWEEN :start AND :end', { start, end });
            
            if (assignedToId) query.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
            
            query.groupBy('c.province')
                .addGroupBy('c.district')
                .orderBy('"totalRevenue"', 'DESC');

            const results = await query.getRawMany();
            return results.map(r => ({
                province: r.province,
                district: r.district,
                totalRevenue: Number(r.totalRevenue || 0),
                customerCount: Number(r.customerCount || 0),
                orderCount: Number(r.orderCount || 0),
            }));
        } catch (e) {
            console.error('Error calculating region stats:', e);
            return [];
        }
    }

    // ===================== NEW ANALYTICS: LOST DEAL ANALYSIS =====================
    private async calculateLostReasonData(start: Date, end: Date) {
        try {
            const sources = ['OUTBOUND', 'REFERRAL', 'FACEBOOK', 'WEBSITE', 'RETURNING_CUSTOMER', 'OTHER'];
            
            const stats = await this.customerRepo.createQueryBuilder('c')
                .select('c.lead_source', 'source')
                .addSelect(`SUM(CASE WHEN c.lead_status = 'LOST' THEN 1 ELSE 0 END)`, 'lostCount')
                .addSelect(`SUM(CASE WHEN c.lead_status = 'LOST' THEN COALESCE(c.potential_value, 0) ELSE 0 END)`, 'lostValue')
                .addSelect('COUNT(*)', 'totalCount')
                .where('c.type = :type', { type: 'LEAD' })
                .andWhere('c.updated_at BETWEEN :start AND :end', { start, end })
                .groupBy('c.lead_source')
                .getRawMany();

            const result = [];
            for (const source of sources) {
                const stat = stats.find(s => s.source === source);
                if (!stat) continue;

                const lostCount = Number(stat.lostCount || 0);
                const lostValue = Number(stat.lostValue || 0);
                const totalCount = Number(stat.totalCount || 0);

                if (lostCount > 0) {
                    result.push({
                        source,
                        sourceLabel: this.getSourceLabel(source),
                        lostCount,
                        lostValue,
                        totalLeads: totalCount,
                        lostRate: totalCount > 0 ? Math.round((lostCount / totalCount) * 100) : 0,
                    });
                }
            }
            return result.sort((a, b) => b.lostValue - a.lostValue);
        } catch (e) {
            console.error('Error calculating lost reasons:', e);
            return [];
        }
    }

    // ===================== NEW ANALYTICS: ACCOUNTS RECEIVABLE AGING =====================
    private async calculateAccountsReceivableData() {
        try {
            const orders = await this.orderRepo.createQueryBuilder('o')
                .leftJoinAndSelect('o.customer', 'c')
                .where('o.status NOT IN (:...statuses)', { statuses: ['QUOTATION', 'CANCELLED'] })
                .andWhere('o.payment_status != :paid', { paid: 'PAID' })
                .orderBy('o.order_date', 'ASC')
                .getMany();

            if (orders.length === 0) {
                return {
                    summary: { '0-30': { count: 0, total: 0 }, '31-60': { count: 0, total: 0 }, '61-90': { count: 0, total: 0 }, '>90': { count: 0, total: 0 } },
                    details: []
                };
            }

            const orderCodes = orders.map(o => o.order_code);
            const payments = await this.transRepo.createQueryBuilder('t')
                .select('t.reference_code', 'code')
                .addSelect('SUM(t.amount)', 'total')
                .where('t.reference_type = :type', { type: 'SALES' })
                .andWhere('t.reference_code IN (:...codes)', { codes: orderCodes })
                .groupBy('t.reference_code')
                .getRawMany();
            
            const paidMap = new Map(payments.map(p => [p.code, Number(p.total)]));

            const now = new Date();
            const arData = [];

            for (const order of orders) {
                const paidAmount = paidMap.get(order.order_code) || 0;
                const remaining = Number(order.total_amount) - paidAmount;
                if (remaining <= 0) continue;

                const orderDate = new Date(order.order_date);
                const daysPast = Math.floor((now.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24));

                let agingBucket = '0-30';
                if (daysPast > 90) agingBucket = '>90';
                else if (daysPast > 60) agingBucket = '61-90';
                else if (daysPast > 30) agingBucket = '31-60';

                arData.push({
                    orderCode: order.order_code,
                    customerName: order.customer?.name || 'Khách lẻ',
                    totalAmount: Number(order.total_amount),
                    paidAmount: paidAmount,
                    remainingAmount: remaining,
                    daysPast,
                    agingBucket,
                    orderDate: orderDate.toISOString(),
                    paymentStatus: order.payment_status,
                });
            }

            // Summary by bucket
            const summary = {
                '0-30': { count: 0, total: 0 },
                '31-60': { count: 0, total: 0 },
                '61-90': { count: 0, total: 0 },
                '>90': { count: 0, total: 0 },
            };
            arData.forEach(ar => {
                const bucket = summary[ar.agingBucket as keyof typeof summary];
                if (bucket) { bucket.count++; bucket.total += ar.remainingAmount; }
            });

            return { details: arData.slice(0, 20), summary };
        } catch (e) {
            console.error('Error calculating AR:', e);
            return { details: [], summary: { '0-30': { count: 0, total: 0 }, '31-60': { count: 0, total: 0 }, '61-90': { count: 0, total: 0 }, '>90': { count: 0, total: 0 } } };
        }
    }

    // ===================== NEW ANALYTICS: MONTHLY TREND 12 MONTHS =====================
    private async calculateMonthlyTrendData() {
        try {
            const now = new Date();
            const startDate = new Date(now.getFullYear(), now.getMonth() - 11, 1);
            const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

            const orders = await this.orderRepo.createQueryBuilder('o')
                .select('o.order_date', 'date')
                .addSelect('o.status', 'status')
                .addSelect('o.total_amount', 'amount')
                .where('o.order_date BETWEEN :start AND :end', { start: startDate, end: endDate })
                .getRawMany();

            const trans = await this.transRepo.createQueryBuilder('t')
                .select('t.date', 'date')
                .addSelect('t.amount', 'amount')
                .where('t.reference_type = :type', { type: 'SALES' })
                .andWhere('t.date BETWEEN :start AND :end', { start: startDate, end: endDate })
                .getRawMany();

            const months = [];
            for (let i = 11; i >= 0; i--) {
                const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

                const monthOrders = orders.filter(o => {
                    const d = new Date(o.date);
                    return d >= monthStart && d <= monthEnd;
                });
                
                const actualRevenue = monthOrders
                    .filter(o => !['QUOTATION', 'CANCELLED'].includes(o.status))
                    .reduce((sum, o) => sum + Number(o.amount || 0), 0);
                    
                const expectedRevenue = monthOrders
                    .filter(o => o.status === 'QUOTATION')
                    .reduce((sum, o) => sum + Number(o.amount || 0), 0);

                const orderCount = monthOrders
                    .filter(o => !['QUOTATION', 'CANCELLED'].includes(o.status)).length;

                const paidRevenue = trans.filter(t => {
                    const d = new Date(t.date);
                    return d >= monthStart && d <= monthEnd;
                }).reduce((sum, t) => sum + Number(t.amount || 0), 0);

                months.push({
                    month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
                    label: `T${monthStart.getMonth() + 1}/${String(monthStart.getFullYear()).slice(2)}`,
                    actualRevenue,
                    expectedRevenue,
                    paidRevenue,
                    orderCount,
                });
            }
            return months;
        } catch (e) {
            console.error('Error calculating monthly trend:', e);
            return [];
        }
    }

    // ===================== NEW ANALYTICS: TOP CUSTOMERS =====================
    private async calculateTopCustomersData(start: Date, end: Date, assignedToId?: number) {
        try {
            const query = this.orderRepo.createQueryBuilder('o')
                .select('o.customer_id', 'customerId')
                .addSelect('c.name', 'customerName')
                .addSelect('c.phone', 'phone')
                .addSelect('SUM(o.total_amount)', 'totalRevenue')
                .addSelect('COUNT(o.id)', 'orderCount')
                .innerJoin('o.customer', 'c')
                .where('o.status NOT IN (:...statuses)', { statuses: ['QUOTATION', 'CANCELLED'] })
                .andWhere('o.order_date BETWEEN :start AND :end', { start, end });
            
            if (assignedToId) {
                query.andWhere('o.assigned_to_id = :uid', { uid: assignedToId });
            }

            const results = await query
                .groupBy('o.customer_id')
                .addGroupBy('c.name')
                .addGroupBy('c.phone')
                .orderBy('"totalRevenue"', 'DESC')
                .limit(10)
                .getRawMany();

            if (results.length === 0) return [];

            const customerIds = results.map(r => r.customerId);
            const paidQuery = this.transRepo.createQueryBuilder('t')
                .select('o.customer_id', 'customerId')
                .addSelect('COALESCE(SUM(t.amount), 0)', 'total')
                .innerJoin(SalesOrder, 'o', 't.reference_code = o.order_code')
                .where('t.reference_type = :type', { type: 'SALES' })
                .andWhere('o.customer_id IN (:...cids)', { cids: customerIds })
                .andWhere('t.date BETWEEN :start AND :end', { start, end })
                .groupBy('o.customer_id');
            const paidResults = await paidQuery.getRawMany();
            const paidMap = new Map(paidResults.map(p => [p.customerId, Number(p.total)]));

            return results.map(r => ({
                customerId: r.customerId,
                customerName: r.customerName,
                phone: r.phone || '',
                totalRevenue: Number(r.totalRevenue || 0),
                orderCount: Number(r.orderCount || 0),
                paidAmount: paidMap.get(r.customerId) || 0,
            }));
        } catch (e) {
            console.error('Error calculating top customers:', e);
            return [];
        }
    }

    // ===================== NEW ANALYTICS: HIGH VALUE LEADS TO WIN =====================
    private async calculateHighValueLeadsData(assignedToId?: number) {
        try {
            const query = this.customerRepo.createQueryBuilder('c')
                .leftJoinAndSelect('c.assigned_to', 'u')
                .where('c.type = :type', { type: 'LEAD' })
                .andWhere('c.lead_status NOT IN (:...closed)', { closed: ['WON', 'LOST'] })
                .andWhere('c.potential_value > :minValue', { minValue: 0 });
            if (assignedToId) query.andWhere('c.assigned_to_id = :uid', { uid: assignedToId });
            query.orderBy('c.potential_value', 'DESC').limit(15);

            const leads = await query.getMany();
            const now = new Date();

            return leads.map(lead => {
                const history = lead.history || [];
                const lastAction = history.length > 0 ? history[history.length - 1] : null;
                const lastActionDate = lastAction?.date ? new Date(lastAction.date) : lead.updated_at;
                const daysSinceLastAction = Math.floor((now.getTime() - new Date(lastActionDate).getTime()) / (1000 * 60 * 60 * 24));
                const weight = this.FORECAST_WEIGHTS[lead.lead_status] || 0.05;
                const weightedValue = Number(lead.potential_value || 0) * weight;

                // Priority score: higher = more urgent
                let priority: 'HOT' | 'WARM' | 'NORMAL' = 'NORMAL';
                if (Number(lead.potential_value) >= 100000000 || (daysSinceLastAction <= 3 && lead.lead_status === 'NEGOTIATION')) priority = 'HOT';
                else if (Number(lead.potential_value) >= 30000000 || lead.lead_status === 'QUALIFIED' || lead.lead_status === 'SAMPLE_APPROVED') priority = 'WARM';

                return {
                    id: lead.id,
                    name: lead.name,
                    phone: lead.phone,
                    status: lead.lead_status,
                    source: lead.lead_source,
                    sourceLabel: this.getSourceLabel(lead.lead_source),
                    potentialValue: Number(lead.potential_value),
                    weightedValue: Math.round(weightedValue),
                    assignedTo: lead.assigned_to?.full_name || lead.assigned_to?.username || 'Chưa gán',
                    assignedToId: lead.assigned_to_id,
                    daysSinceLastAction,
                    lastActionDate: lastActionDate ? new Date(lastActionDate).toISOString() : null,
                    priority,
                };
            });
        } catch (e) {
            console.error('Error calculating high value leads:', e);
            return [];
        }
    }

    // === PUSH REMINDER ===
    async sendPushReminder(data: { userId: number; customerName: string; message: string; senderId?: number; senderName?: string }) {
        await this.notificationsService.create({
            user_id: data.userId,
            title: `⚡ Nhắc nhở: ${data.customerName}`,
            message: data.message || `Hãy follow-up khách hàng ${data.customerName} ngay!`,
            type: 'WARNING',
            link: '/sales',
        });
        return { success: true };
    }

    // === SALES TARGETS CRUD ===
    async getTargets(year: number) {
        return this.targetRepo.find({ where: { year }, relations: ['user'] });
    }

    async upsertTarget(data: { user_id: number; year: number; month: number; target_revenue: number; target_leads?: number; target_activities?: number }) {
        const existing = await this.targetRepo.findOne({
            where: { user_id: data.user_id, year: data.year, month: data.month }
        });
        if (existing) {
            Object.assign(existing, data);
            return this.targetRepo.save(existing);
        }
        return this.targetRepo.save(this.targetRepo.create(data));
    }

    // ============================================================
    // PROMOTIONS CRUD
    // ============================================================

    async getAllPromotions() {
        try {
            return await this.promotionRepo.find({ order: { created_at: 'DESC' } });
        } catch (error) {
            console.error('Promotions table may not exist:', error.message);
            return [];
        }
    }

    async getActivePromotions() {
        try {
            const today = new Date().toISOString().split('T')[0];
            return await this.promotionRepo
                .createQueryBuilder('p')
                .where('p.is_active = :active', { active: true })
                .andWhere('p.start_date <= :today', { today })
                .andWhere('p.end_date >= :today', { today })
                .andWhere('(p.max_uses IS NULL OR p.used_count < p.max_uses)')
                .orderBy('p.created_at', 'DESC')
                .getMany();
        } catch (error) {
            console.error('Error fetching active promotions:', error.message);
            return [];
        }
    }

    async getActivePromotionsForCustomer(customerId: number) {
        try {
            const allActive = await this.getActivePromotions();
            // Filter: applicable_customer_ids is empty (=all) or contains customerId
            return allActive.filter(p => {
                const customerIds = p.applicable_customer_ids || [];
                return customerIds.length === 0 || customerIds.includes(customerId);
            });
        } catch (error) {
            console.error('Error fetching promotions for customer:', error.message);
            return [];
        }
    }

    async getPromotionWithProducts(promotionId: number, customerId: number) {
        const promotion = await this.promotionRepo.findOne({ where: { id: promotionId } });
        if (!promotion) throw new NotFoundException('Promotion not found');

        // Verify customer is eligible
        const customerIds = promotion.applicable_customer_ids || [];
        if (customerIds.length > 0 && !customerIds.includes(customerId)) {
            throw new NotFoundException('Promotion not available for this customer');
        }

        // Check if promotion is active
        const today = new Date().toISOString().split('T')[0];
        if (!promotion.is_active || promotion.start_date > new Date(today) || promotion.end_date < new Date(today)) {
            throw new NotFoundException('Promotion is no longer active');
        }

        // If no applicable products, return empty products list
        const productIds = promotion.applicable_product_ids || [];
        if (productIds.length === 0) {
            return { promotion, products: [] };
        }

        // Fetch products
        const products = await this.productsService.findAll();
        const filtered = products
            .filter((p: any) => productIds.includes(p.id) && p.is_active)
            .map((p: any) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                unit: p.unit,
                base_price: Number(p.base_price),
                image_url: p.image_url,
                category: p.category_link?.name || p.category || '',
                customer_description: p.customer_description || '',
                product_type: p.product_type || '',
            }));

        return { promotion, products: filtered };
    }

    async createPromotion(data: any) {
        try {
            const promotion = this.promotionRepo.create({
                name: data.name,
                description: data.description,
                discount_type: data.discount_type,
                discount_value: Number(data.discount_value) || 0,
                start_date: data.start_date,
                end_date: data.end_date,
                is_active: data.is_active !== undefined ? data.is_active : true,
                applicable_customer_ids: data.applicable_customer_ids || [],
                applicable_product_ids: data.applicable_product_ids || [],
                min_quantity: data.min_quantity || null,
                min_order_value: data.min_order_value || null,
                max_uses: data.max_uses || null,
                used_count: 0,
            });
            return await this.promotionRepo.save(promotion);
        } catch (error) {
            console.error('Error creating promotion:', error);
            throw error;
        }
    }

    async updatePromotion(id: number, data: any) {
        try {
            const promotion = await this.promotionRepo.findOne({ where: { id } });
            if (!promotion) throw new NotFoundException('Promotion not found');

            if (data.name !== undefined) promotion.name = data.name;
            if (data.description !== undefined) promotion.description = data.description;
            if (data.discount_type !== undefined) promotion.discount_type = data.discount_type;
            if (data.discount_value !== undefined) promotion.discount_value = Number(data.discount_value);
            if (data.start_date !== undefined) promotion.start_date = data.start_date;
            if (data.end_date !== undefined) promotion.end_date = data.end_date;
            if (data.is_active !== undefined) promotion.is_active = data.is_active;
            if (data.applicable_customer_ids !== undefined) promotion.applicable_customer_ids = data.applicable_customer_ids;
            if (data.applicable_product_ids !== undefined) promotion.applicable_product_ids = data.applicable_product_ids;
            if (data.min_quantity !== undefined) promotion.min_quantity = data.min_quantity;
            if (data.min_order_value !== undefined) promotion.min_order_value = data.min_order_value;
            if (data.max_uses !== undefined) promotion.max_uses = data.max_uses;

            return await this.promotionRepo.save(promotion);
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('Error updating promotion:', error);
            throw error;
        }
    }

    async deletePromotion(id: number) {
        try {
            const promotion = await this.promotionRepo.findOne({ where: { id } });
            if (!promotion) throw new NotFoundException('Promotion not found');
            await this.promotionRepo.delete(id);
            return { success: true, message: 'Xóa khuyến mãi thành công' };
        } catch (error) {
            if (error instanceof NotFoundException) throw error;
            console.error('Error deleting promotion:', error);
            throw error;
        }
    }
}
