import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer, CustomerType } from './customer.entity';
import { CustomerContact } from './customer-contact.entity';
import { CustomerComment } from './customer-comment.entity';
import { CustomerCredit, CreditTransactionType } from './customer-credit.entity';

import { Transaction } from '../finance/transaction.entity';
import { SalesComment } from '../sales/sales-comment.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { ProductionFulfillmentOrder } from '../planning/pfo.entity';
import { PortalSession } from '../public/entities/portal-session.entity';
import * as crypto from 'crypto';

@Injectable()
export class CustomersService {
    constructor(
        @InjectRepository(Customer)
        private customerRepo: Repository<Customer>,
        @InjectRepository(CustomerContact)
        private contactRepo: Repository<CustomerContact>,
        @InjectRepository(CustomerComment)
        private commentRepo: Repository<CustomerComment>,
        @InjectRepository(CustomerCredit)
        private creditRepo: Repository<CustomerCredit>,
        @InjectRepository(Transaction)
        private transRepo: Repository<Transaction>,
        @InjectRepository(PortalSession)
        private sessionRepo: Repository<PortalSession>,
    ) { }

    async create(data: any) {
        // Auto-generate customer code if not provided
        if (!data.code) {
            data.code = await this.generateCustomerCode();
        }

        const existing = await this.customerRepo.findOne({ where: { code: data.code } });
        if (existing) throw new BadRequestException('Mã khách hàng đã tồn tại: ' + data.code);

        let parent = null;
        if (data.parent_id) {
            parent = await this.customerRepo.findOne({ where: { id: data.parent_id } });
        }

        const customer = this.customerRepo.create({
            ...data,
            type: data.type || CustomerType.LEAD,
            credit_limit: Number(data.credit_limit) || 0,
            current_debt: 0,
            parent: parent,
            contacts: data.contacts?.map((c: any) => this.contactRepo.create(c) as unknown as CustomerContact) || []
        });
        return this.customerRepo.save(customer);
    }

    // --- AUTO-GENERATE CUSTOMER CODE ---
    private async generateCustomerCode(): Promise<string> {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const prefix = `KH-${yy}${mm}-`;

        // Find the latest customer code with this prefix
        const latest = await this.customerRepo
            .createQueryBuilder('c')
            .where('c.code LIKE :prefix', { prefix: `${prefix}%` })
            .orderBy('c.code', 'DESC')
            .getOne();

        let nextNum = 1;
        if (latest && latest.code) {
            const lastNum = parseInt(latest.code.slice(-4), 10);
            if (!isNaN(lastNum)) {
                nextNum = lastNum + 1;
            }
        }

        return `${prefix}${nextNum.toString().padStart(4, '0')}`;
    }

    async findAll() {
        const customers = await this.customerRepo.find({
            order: { id: 'DESC' },
            relations: ['parent', 'contacts', 'assigned_to', 'orders'] // Load orders
        });

        // Calculate Revenue and Debt
        // Note: For better performance with large data, use aggregation query instead of map
        return Promise.all(customers.map(async (c) => {
            let revenue = 0;
            let paid = 0;

            // Ensure orders is loaded
            if (c.orders && c.orders.length > 0) {
                for (const order of c.orders) {
                    // Only count non-cancelled, non-quotation (or maybe count quotation potential? No, usually revenue = sold)
                    // Let's assume Valid orders are NOT Cancelled and NOT Quotation
                    if (order.status !== 'CANCELLED' && order.status !== 'QUOTATION') {
                        revenue += Number(order.total_amount || 0);

                        // Fetch payments for this order
                        // We can optimize this by batch loading, but for now loop is simpler for logic
                        const payments = await this.transRepo.find({ where: { reference_code: order.order_code, reference_type: 'SALES', status: 'COMPLETED' } });
                        const paidAmt = payments.reduce((acc, p) => acc + Number(p.amount), 0);
                        paid += paidAmt;
                    }
                }
            }

            // Update runtime values (not saving to DB to avoid overhead, or should we?)
            // User requested "Updated Value".
            // We return enriched object.
            return {
                ...c,
                total_revenue: revenue,
                current_debt: revenue - paid
            };
        }));
    }

    // --- ADVANCED SEARCH FOR AI (VỚI THUẬT TOÁN TÍNH ĐIỂM RELEVANCE SCORE) ---
    async searchCustomersAdvanced(searchQuery: string) {
        if (!searchQuery || searchQuery.trim() === '') {
            return this.customerRepo.find({ order: { id: 'DESC' }, take: 10 });
        }

        const cleanQuery = searchQuery.trim();
        // Loại bỏ các cụm từ lệnh phổ biến của AI trước khi tìm kiếm
        const strippedQuery = cleanQuery
            .replace(/^(tổng hợp thông tin|phân tích thông tin|phân tích hồ sơ|phân tích|hồ sơ|thông tin về|thông tin|tìm kiếm|tra cứu)\s+/i, '')
            .trim();

        const stopWords = ['trường', 'mầm', 'non', 'công', 'ty', 'tnhh', 'cp', 'khách', 'hàng', 'anh', 'chị', 'tổng', 'hợp', 'thông', 'tin', 'cho', 'về'];
        const tokens = strippedQuery.toLowerCase().split(/\s+/).filter(w => w.length >= 2 && !stopWords.includes(w));

        // 1. Tìm kiếm tập hợp khách hàng ứng viên
        const query = this.customerRepo.createQueryBuilder('customer');
        query.where('(LOWER(customer.name) LIKE LOWER(:q) OR LOWER(customer.phone) LIKE LOWER(:q) OR LOWER(customer.code) LIKE LOWER(:q))', { q: `%${strippedQuery}%` });

        if (tokens.length > 0) {
            tokens.forEach((token, idx) => {
                query.orWhere(`LOWER(customer.name) LIKE LOWER(:t_${idx})`, { [`t_${idx}`]: `%${token}%` });
                query.orWhere(`LOWER(customer.code) LIKE LOWER(:t_${idx})`, { [`t_${idx}`]: `%${token}%` });
            });
        }

        const candidates = await query.take(30).getMany();

        // 2. Chấm điểm độ trùng khớp (Relevance Scoring)
        const searchLower = strippedQuery.toLowerCase();
        const scored = candidates.map(c => {
            const nameLower = (c.name || '').toLowerCase();
            const codeLower = (c.code || '').toLowerCase();
            let score = 0;

            // Khớp chính xác tên hoặc mã
            if (nameLower === searchLower || codeLower === searchLower) score += 1000;
            // Tên chứa toàn bộ cụm tìm kiếm
            if (nameLower.includes(searchLower)) score += 500;

            // Đếm số từ khóa (tokens) khớp
            let matchedTokenCount = 0;
            tokens.forEach(t => {
                if (nameLower.includes(t) || codeLower.includes(t)) {
                    score += 50;
                    matchedTokenCount++;
                }
            });

            // Thưởng lớn nếu khớp TẤT CẢ các từ khóa
            if (tokens.length > 0 && matchedTokenCount === tokens.length) {
                score += 200;
            }

            return { customer: c, score };
        });

        // Sắp xếp điểm cao nhất lên đầu
        scored.sort((a, b) => b.score - a.score || b.customer.id - a.customer.id);
        return scored.map(s => s.customer).slice(0, 10);
    }

    async findOne(id: number) {
        return this.customerRepo.findOne({
            where: { id },
            relations: ['parent', 'children', 'contacts']
        });
    }

    // --- LẤY LỊCH SỬ MUA HÀNG VỚI ĐẦY ĐỦ ITEMS & THANH TOÁN ---
    async getOrders(id: number) {
        const customer = await this.customerRepo.findOne({
            where: { id },
            relations: ['orders', 'orders.items', 'orders.items.product']
        });
        if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

        const orderList = customer.orders || [];

        // Tính tiền đã thanh toán từ bảng Transaction cho từng đơn
        const ordersWithPayment = await Promise.all(orderList.map(async (order: any) => {
            let paid = 0;
            try {
                const payments = await this.transRepo.find({
                    where: [
                        { reference_code: order.order_code, type: 'INCOME', status: 'COMPLETED' },
                        { reference_code: order.order_code, reference_type: 'SALES', status: 'COMPLETED' }
                    ]
                });
                paid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            } catch (e) {
                paid = 0;
            }
            return {
                ...order,
                total_amount: Number(order.total_amount || 0),
                paid_amount: paid
            };
        }));

        // Sắp xếp đơn mới nhất lên đầu
        return ordersWithPayment.sort((a: any, b: any) =>
            new Date(b.created_at || b.order_date).getTime() - new Date(a.created_at || a.order_date).getTime()
        );
    }
    // --------------------------------------

    async update(id: number, data: any) {
        const customer = await this.findOne(id);
        if (!customer) throw new NotFoundException();

        const { contacts, parent_id, ...info } = data;

        if (parent_id) {
            if (parent_id === id) throw new BadRequestException('Khong the chon chinh minh lam cha');
            customer.parent = await this.customerRepo.findOne({ where: { id: parent_id } });
        } else {
            customer.parent = null;
        }

        if (contacts && Array.isArray(contacts)) {
            await this.contactRepo.delete({ customer: { id } });
            customer.contacts = contacts.map((c: any) => this.contactRepo.create(c) as unknown as CustomerContact);
        }

        // --- VALIDATION: potential_value > 0 khi chuyển sang QUALIFIED ---
        if (info.lead_status === 'QUALIFIED') {
            const potentialValue = Number(info.potential_value ?? customer.potential_value);
            if (!potentialValue || potentialValue <= 0) {
                throw new BadRequestException('Cần nhập Giá trị dự kiến (potential_value > 0) trước khi chuyển sang Tiềm năng (QUALIFIED).');
            }
        }

        Object.assign(customer, info);
        return this.customerRepo.save(customer);
    }

    async remove(id: number) {
        const customer = await this.findOne(id);
        return this.customerRepo.remove(customer);
    }

    async addHistory(id: number, note: string) {
        const customer = await this.findOne(id);
        const newLog = { date: new Date(), note: note, user: 'Admin' };
        if (!customer.history) customer.history = [];
        customer.history.unshift(newLog);
        return this.customerRepo.save(customer);
    }

    async convertToCustomer(id: number) {
        return this.customerRepo.update(id, { type: CustomerType.CUSTOMER });
    }

    async updateBodFollowUp(id: number, bodData: any) {
        const customer = await this.findOne(id);
        if (!customer) throw new NotFoundException('Customer not found');
        customer.bod_follow_up = bodData;
        return this.customerRepo.save(customer);
    }

    // --- LEAD CARE: GET ALL COMMENTS ---
    async getComments(customerId: number) {
        const customer = await this.customerRepo.findOne({
            where: { id: customerId },
            relations: ['orders']
        });
        if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

        // 1. Get direct comments to customer
        const directComments = await this.commentRepo.find({
            where: { customer_id: customerId },
            order: { created_at: 'DESC' }
        });

        // 2. Get ALL comments from all SOs (both STAFF and CUSTOMER types)
        const soComments: any[] = [];
        if (customer.orders && customer.orders.length > 0) {
            for (const order of customer.orders) {
                // Use TypeORM repository for cross-database compatibility
                const comments = await this.commentRepo.manager
                    .getRepository(SalesComment)
                    .find({
                        where: { order: { id: order.id } },
                        order: { created_at: 'DESC' }
                    });

                comments.forEach((c: any) => {
                    // Filter out deleted comments
                    if (!c.deleted_at) {
                        soComments.push({
                            ...c,
                            source: 'SO',
                            order_code: order.order_code
                        });
                    }
                });
            }
        }

        // 3. Merge and sort
        const merged = [
            ...directComments.map(c => ({ ...c, source: 'DIRECT', order_code: null })),
            ...soComments
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        return merged;
    }

    // --- LEAD CARE: ADD DIRECT COMMENT ---
    async addComment(customerId: number, content: string, senderType: 'STAFF' | 'CUSTOMER', senderName: string, commentType?: string, mentionedUserIds?: string) {
        const customer = await this.customerRepo.findOne({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

        const comment = this.commentRepo.create({
            customer: customer,
            content,
            sender_type: senderType,
            sender_name: senderName,
            comment_type: (commentType as any) || 'CUSTOMER',
            mentioned_user_ids: mentionedUserIds || undefined
        });
        return this.commentRepo.save(comment);
    }

    // --- IMPERSONATE ---
    private generateSlug(name: string, id: number): string {
        const slug = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/đ/g, 'd').replace(/Đ/g, 'd')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        return `${slug}-${id}`;
    }

    async impersonate(id: number) {
        const customer = await this.customerRepo.findOne({ where: { id } });
        if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

        const token = crypto.randomUUID() + '-' + crypto.randomBytes(16).toString('hex');
        const slug = this.generateSlug(customer.name, customer.id);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for impersonation

        const session = this.sessionRepo.create({
            customer_id: customer.id,
            token,
            slug,
            expires_at: expiresAt,
        });
        await this.sessionRepo.save(session);

        return { token, slug };
    }

    // --- CUSTOMER CREDIT LOGIC ---
    async addCredit(customerId: number, amount: number, type: CreditTransactionType, note?: string, refCode?: string) {
        const customer = await this.customerRepo.findOne({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Customer not found');

        const credit = this.creditRepo.create({
            customer_id: customerId,
            type,
            amount: Number(amount),
            note,
            reference_code: refCode
        });

        await this.creditRepo.save(credit);

        // Update balance
        if (type === CreditTransactionType.ADD) {
            customer.credit_balance = Number(customer.credit_balance || 0) + Number(amount);
        } else if (type === CreditTransactionType.USE || type === CreditTransactionType.REFUND) {
            customer.credit_balance = Number(customer.credit_balance || 0) - Number(amount);
        }

        await this.customerRepo.save(customer);
        return credit;
    }

    async getCreditHistory(customerId: number) {
        return this.creditRepo.find({ 
            where: { customer_id: customerId },
            order: { created_at: 'DESC' }
        });
    }

    // --- CUSTOMER 360 PORTRAIT: GET ALL DATA (BG, SO, PFO, CRM) ---
    async getPortrait360Data(customerId: number) {
        const customer = await this.customerRepo.findOne({
            where: { id: customerId },
            relations: ['parent', 'children', 'contacts', 'assigned_to', 'orders', 'orders.items', 'orders.items.product']
        });
        if (!customer) throw new NotFoundException('Khách hàng không tồn tại');

        const allOrders = customer.orders || [];

        // 1. Split into BG (Quotations) and SO (Sales Orders)
        const quotations: any[] = [];
        const salesOrders: any[] = [];

        // Fetch payments for all orders
        const orderIds = allOrders.map(o => o.id);
        const orderCodes = allOrders.map(o => o.order_code).filter(Boolean);

        let payments: Transaction[] = [];
        if (orderCodes.length > 0) {
            try {
                payments = await this.transRepo.createQueryBuilder('t')
                    .where('t.reference_code IN (:...orderCodes)', { orderCodes })
                    .andWhere('t.status = :status', { status: 'COMPLETED' })
                    .getMany();
            } catch (e) {
                payments = [];
            }
        }

        const paymentMap = new Map<string, number>();
        payments.forEach(p => {
            if (p.type === 'INCOME' || p.reference_type === 'SALES') {
                const current = paymentMap.get(p.reference_code) || 0;
                paymentMap.set(p.reference_code, current + Number(p.amount || 0));
            }
        });

        // Tally products purchased
        const productStatsMap = new Map<string, { product_id: number; name: string; sku: string; quantity: number; subtotal: number }>();

        allOrders.forEach(o => {
            const totalAmount = Number(o.total_amount || 0);
            const paidAmount = paymentMap.get(o.order_code) || 0;
            const remainingDebt = Math.max(0, totalAmount - paidAmount);

            const enrichedOrder = {
                id: o.id,
                order_code: o.order_code,
                order_date: o.order_date || o.created_at,
                status: o.status,
                total_amount: totalAmount,
                paid_amount: paidAmount,
                remaining_debt: remainingDebt,
                delivery_date: o.delivery_date,
                shipping_address: o.shipping_address,
                notes: o.notes,
                items: (o.items || []).map((item: any) => {
                    const prodName = item.product_name_real || item.product?.name || item.sku || 'Sản phẩm';
                    const sku = item.sku || item.product?.code || '';
                    const qty = Number(item.quantity || 0);
                    const subtotal = Number(item.subtotal || (item.unit_price * qty) || 0);

                    // Track if in actual SO
                    if (o.status !== 'QUOTATION' && o.status !== 'CANCELLED') {
                        const key = sku || prodName;
                        const existing = productStatsMap.get(key) || { product_id: item.product_id, name: prodName, sku, quantity: 0, subtotal: 0 };
                        existing.quantity += qty;
                        existing.subtotal += subtotal;
                        productStatsMap.set(key, existing);
                    }

                    return {
                        id: item.id,
                        product_id: item.product_id,
                        product_name: prodName,
                        sku: sku,
                        quantity: qty,
                        unit_price: Number(item.unit_price || 0),
                        subtotal: subtotal
                    };
                })
            };

            if (o.status === 'QUOTATION' || (o.status === 'CANCELLED' && o.order_code?.startsWith('BG-'))) {
                quotations.push(enrichedOrder);
            } else {
                salesOrders.push(enrichedOrder);
            }
        });

        // 2. Fetch PFOs
        let pfos: any[] = [];
        if (orderIds.length > 0) {
            try {
                pfos = await this.customerRepo.manager.getRepository(ProductionFulfillmentOrder)
                    .createQueryBuilder('pfo')
                    .where('pfo.sales_order_id IN (:...orderIds)', { orderIds })
                    .orderBy('pfo.id', 'DESC')
                    .getMany();
            } catch (e) {
                pfos = [];
            }
        }

        // 3. Fetch Direct Comments
        let directComments: any[] = [];
        try {
            directComments = await this.commentRepo.find({
                where: { customer_id: customerId },
                order: { created_at: 'DESC' },
                take: 15
            });
        } catch (e) {
            directComments = [];
        }

        // Top products sorted by revenue
        const topProducts = Array.from(productStatsMap.values()).sort((a, b) => b.subtotal - a.subtotal);

        // Calculate summary metrics
        const totalQuotationCount = quotations.length;
        const totalQuotationValue = quotations.reduce((sum, q) => sum + q.total_amount, 0);

        const totalOrdersCount = salesOrders.filter(s => s.status !== 'CANCELLED').length;
        const totalRevenue = salesOrders.filter(s => s.status !== 'CANCELLED').reduce((sum, s) => sum + s.total_amount, 0);
        const totalPaid = salesOrders.filter(s => s.status !== 'CANCELLED').reduce((sum, s) => sum + s.paid_amount, 0);
        const totalDebt = Math.max(0, totalRevenue - totalPaid);

        const winRate = (totalQuotationCount + totalOrdersCount) > 0 
            ? Math.round((totalOrdersCount / (totalQuotationCount + totalOrdersCount)) * 100) 
            : 0;
        const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

        const pfoSummary = {
            total: pfos.length,
            in_production: pfos.filter(p => ['IN_PRODUCTION', 'MATERIAL_PREP', 'QC'].includes(p.status)).length,
            completed: pfos.filter(p => ['READY_TO_SHIP', 'RECEIVING', 'RECONCILIATION', 'CLOSED'].includes(p.status)).length,
            risk_count: pfos.filter(p => p.risk_status === 'AMBER' || p.risk_status === 'RED').length
        };

        return {
            customer: {
                id: customer.id,
                code: customer.code,
                name: customer.name,
                type: customer.type,
                lead_status: customer.lead_status,
                lead_source: customer.lead_source,
                potential_value: customer.potential_value,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                province: customer.province,
                tax_code: customer.tax_code,
                credit_limit: customer.credit_limit,
                credit_balance: customer.credit_balance,
                portrait_notes: customer.portrait_notes || '',
                assigned_to: customer.assigned_to ? {
                    id: customer.assigned_to.id,
                    name: customer.assigned_to.full_name || customer.assigned_to.username
                } : null,
                contacts: (customer.contacts || []).map(c => ({
                    id: c.id,
                    full_name: c.full_name,
                    job_title: c.job_title,
                    phone: c.phone
                }))
            },
            summary: {
                total_quotations: totalQuotationCount,
                total_quotations_amount: totalQuotationValue,
                total_orders: totalOrdersCount,
                total_revenue: totalRevenue,
                total_paid: totalPaid,
                total_debt: totalDebt,
                win_rate: winRate,
                avg_order_value: avgOrderValue,
                pfo_summary: pfoSummary,
                top_products: topProducts.slice(0, 5)
            },
            quotations: quotations.slice(0, 20),
            sales_orders: salesOrders.slice(0, 20),
            pfos: pfos.slice(0, 20),
            comments: directComments
        };
    }

    async updatePortraitNotes(customerId: number, notes: string) {
        const customer = await this.customerRepo.findOne({ where: { id: customerId } });
        if (!customer) throw new NotFoundException('Khách hàng không tồn tại');
        customer.portrait_notes = notes;
        await this.customerRepo.save(customer);
        return { success: true, message: 'Đã lưu ghi chú chân dung 360', portrait_notes: customer.portrait_notes };
    }
}