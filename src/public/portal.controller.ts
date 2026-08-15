import { Controller, Post, Get, Body, Param, HttpException, HttpStatus, Headers, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Customer } from '../customers/customer.entity';
import { CustomerContact } from '../customers/customer-contact.entity';
import { PortalOtp } from './entities/portal-otp.entity';
import { PortalSession } from './entities/portal-session.entity';
import { SalesOrder } from '../sales/sales-order.entity';
import { EmailService } from '../common/services/email.service';
import { SalesService } from '../sales/sales.service';
import { SystemConfig } from '../system/system-config.entity';
import * as crypto from 'crypto';

@Controller('public/portal')
export class PortalController {
    constructor(
        @InjectRepository(Customer)
        private readonly customerRepo: Repository<Customer>,
        @InjectRepository(CustomerContact)
        private readonly contactRepo: Repository<CustomerContact>,
        @InjectRepository(PortalOtp)
        private readonly otpRepo: Repository<PortalOtp>,
        @InjectRepository(PortalSession)
        private readonly sessionRepo: Repository<PortalSession>,
        @InjectRepository(SalesOrder)
        private readonly salesOrderRepo: Repository<SalesOrder>,
        @InjectRepository(SystemConfig)
        private readonly configRepo: Repository<SystemConfig>,
        private readonly emailService: EmailService,
        private readonly salesService: SalesService,
    ) { }

    // ============================================================
    // HELPER: Generate slug from customer name + ID
    // ============================================================
    private generateSlug(name: string, id: number): string {
        const slug = name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove Vietnamese diacritics
            .replace(/đ/g, 'd').replace(/Đ/g, 'd')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim();
        return `${slug}-${id}`;
    }

    // ============================================================
    // HELPER: Validate portal token from Authorization header
    // ============================================================
    private async validateSession(authHeader: string | undefined): Promise<PortalSession> {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
        }
        const token = authHeader.replace('Bearer ', '');
        const session = await this.sessionRepo.findOne({
            where: { token, expires_at: MoreThan(new Date()) }
        });
        if (!session) {
            throw new HttpException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn', HttpStatus.UNAUTHORIZED);
        }
        return session;
    }

    // ============================================================
    // 1. REQUEST OTP
    // ============================================================
    @Post('request-otp')
    async requestOtp(@Body() body: { email: string }) {
        const email = body.email?.trim()?.toLowerCase();
        if (!email) {
            throw new HttpException('Email không được bỏ trống', HttpStatus.BAD_REQUEST);
        }

        // Validate email exists in customers table or customer_contacts table
        let customer: Customer | null = null;

        // 1. Check in customers.email
        customer = await this.customerRepo.findOne({ where: { email } });

        // 2. If not found, check in customer_contacts.email
        if (!customer) {
            const contact = await this.contactRepo.findOne({
                where: { email },
                relations: ['customer']
            });
            if (contact && contact.customer) {
                customer = contact.customer;
            }
        }

        if (!customer) {
            throw new HttpException(
                'Email không tồn tại trong hệ thống. Vui lòng liên hệ sales để được đăng ký.',
                HttpStatus.NOT_FOUND
            );
        }

        // Generate 6-digit OTP
        const otpCode = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Save OTP
        try {
            const otp = this.otpRepo.create({
                email,
                otp_code: otpCode,
                customer_id: customer.id,
                is_used: false,
                expires_at: expiresAt,
            });
            await this.otpRepo.save(otp);
        } catch (error) {
            console.error('Error saving OTP:', error);
            throw new HttpException('Lỗi server khi tạo OTP', HttpStatus.INTERNAL_SERVER_ERROR);
        }

        // Send OTP email
        const htmlContent = `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 460px; margin: 0 auto; padding: 30px; background: #fff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #23A7D3; font-size: 24px; margin: 0;">ERP4U</h1>
                    <p style="color: #888; font-size: 13px; margin-top: 4px;">Cổng Đối Tác B2B</p>
                </div>
                <div style="background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 20px;">
                    <p style="color: #555; margin: 0 0 12px;">Mã xác thực đăng nhập của bạn:</p>
                    <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #23A7D3; font-family: monospace; padding: 12px; background: #fff; border-radius: 8px; display: inline-block; min-width: 200px;">
                        ${otpCode}
                    </div>
                    <p style="color: #999; font-size: 12px; margin-top: 12px;">Mã hết hạn sau 5 phút</p>
                </div>
                <p style="color: #666; font-size: 13px; line-height: 1.5;">
                    Xin chào <strong>${customer.name}</strong>,<br/>
                    Vui lòng nhập mã trên vào trang đăng nhập để truy cập Cổng Đối Tác.<br/>
                    Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email.
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="color: #aaa; font-size: 11px; text-align: center;">
                    © ERP4U - Nệm Mầm Non | localhost:3000
                </p>
            </div>
        `;

        await this.emailService.sendMail(
            email,
            '[ERP4U] Mã xác thực đăng nhập Cổng Đối Tác',
            htmlContent
        );

        return {
            success: true,
            message: 'Mã OTP đã được gửi đến email của bạn',
            customer_name: customer.name, // For display on frontend
        };
    }

    // ============================================================
    // 2. VERIFY OTP
    // ============================================================
    @Post('verify-otp')
    async verifyOtp(@Body() body: { email: string; otp_code: string }) {
        const email = body.email?.trim()?.toLowerCase();
        const otpCode = body.otp_code?.trim();

        if (!email || !otpCode) {
            throw new HttpException('Email và mã OTP không được bỏ trống', HttpStatus.BAD_REQUEST);
        }

        // Find valid OTP
        try {
            const otp = await this.otpRepo.findOne({
                where: {
                    email,
                    otp_code: otpCode,
                    is_used: false,
                    expires_at: MoreThan(new Date()),
                },
                order: { created_at: 'DESC' }
            });

            if (!otp) {
                throw new HttpException('Mã OTP không hợp lệ hoặc đã hết hạn', HttpStatus.UNAUTHORIZED);
            }

            // Mark OTP as used
            otp.is_used = true;
            await this.otpRepo.save(otp);

            // Find customer
            const customer = await this.customerRepo.findOne({ where: { id: otp.customer_id } });
            if (!customer) {
                throw new HttpException('Khách hàng không tồn tại', HttpStatus.NOT_FOUND);
            }

            // Generate portal session token
            const token = crypto.randomUUID() + '-' + crypto.randomBytes(16).toString('hex');
            const slug = this.generateSlug(customer.name, customer.id);
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            const session = this.sessionRepo.create({
                customer_id: customer.id,
                token,
                slug,
                expires_at: expiresAt,
            });
            await this.sessionRepo.save(session);

            return {
                success: true,
                token,
                slug,
                customer: {
                    id: customer.id,
                    name: customer.name,
                    code: customer.code,
                    email: customer.email,
                    phone: customer.phone,
                },
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('Error verifying OTP:', error);
            throw new HttpException('Lỗi server khi xác thực OTP', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ============================================================
    // 3. DASHBOARD DATA
    // ============================================================
    @Get('dashboard/:slug')
    async getDashboard(
        @Param('slug') slug: string,
        @Headers('authorization') authHeader: string,
    ) {
        const session = await this.validateSession(authHeader);

        // Verify slug matches session
        if (session.slug !== slug) {
            throw new HttpException('Slug không khớp với phiên đăng nhập', HttpStatus.FORBIDDEN);
        }

        try {
            const customer = await this.customerRepo.findOne({
                where: { id: session.customer_id },
                relations: ['contacts']
            });

            if (!customer) {
                throw new HttpException('Không tìm thấy khách hàng', HttpStatus.NOT_FOUND);
            }

            // Fetch orders for this customer
            const orders = await this.salesOrderRepo.find({
                where: { customer_id: customer.id },
                relations: ['items', 'items.product', 'assigned_to'],
                order: { order_date: 'DESC' },
                take: 20,
            });

            // Fetch active promotions for this customer
            let promotions: any[] = [];
            try {
                promotions = await this.salesService.getActivePromotionsForCustomer(customer.id);
            } catch (e) {
                // Promotions table may not exist yet
                console.warn('Could not fetch promotions:', e.message);
            }

            // Calculate stats
            const totalOrders = orders.length;
            const totalRevenue = orders
                .filter(o => o.status !== 'CANCELLED')
                .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
            const activeOrders = orders.filter(o =>
                ['SO_PENDING', 'DEPOSITED', 'SAMPLE_APPROVED', 'IN_PRODUCTION', 'PLANNED', 'MANUFACTURING_COMPLETED'].includes(o.status)
            ).length;

            const watermarkConfig = await this.configRepo.findOne({ where: { key: 'PORTAL_WATERMARK_IMAGE' } });

            return {
                customer: {
                    id: customer.id,
                    name: customer.name,
                    code: customer.code,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    contacts: customer.contacts,
                },
                stats: {
                    total_orders: totalOrders,
                    total_revenue: totalRevenue,
                    active_orders: activeOrders,
                },
                orders: orders.map(o => ({
                    id: o.id,
                    uuid: o.uuid,
                    order_code: o.order_code,
                    status: o.status,
                    total_amount: Number(o.total_amount || 0),
                    paid_amount: Number(o.paid_amount || 0),
                    payment_status: o.payment_status,
                    payment_note: o.payment_note,
                    discount_amount: Number(o.discount_amount || 0),
                    order_date: o.order_date,
                    delivery_date: o.delivery_date,
                    shipping_address: o.shipping_address,
                    receiver_name: o.receiver_name,
                    receiver_phone: o.receiver_phone,
                    shipping_carrier: o.shipping_carrier,
                    tracking_code: o.tracking_code,
                    shipping_fee: Number(o.shipping_fee || 0),
                    assigned_to: o.assigned_to ? { full_name: o.assigned_to.full_name } : null,
                    items: (o.items || []).map(i => ({
                        sku: i.sku,
                        product_name: i.product?.name || i.sku,
                        quantity: Number(i.quantity),
                        unit_price: Number(i.unit_price),
                        subtotal: Number(i.subtotal),
                        image_url: i.image_url || i.product?.image_url,
                        customer_description: i.product?.customer_description || '',
                        product_type: i.product?.product_type || '',
                        vat_content: i.vat_content || '',
                    })),
                })),
                promotions,
                watermark_image: watermarkConfig?.value || '',
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('Error fetching dashboard:', error);
            throw new HttpException('Lỗi server khi tải dữ liệu dashboard', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ============================================================
    // 4. REORDER (Create new Quotation from old order)
    // ============================================================
    @Post('reorder/:slug')
    async reorder(
        @Param('slug') slug: string,
        @Headers('authorization') authHeader: string,
        @Body() body: { order_id: number; items?: Array<{ sku: string; quantity: number; unit_price: number }>; note?: string },
    ) {
        const session = await this.validateSession(authHeader);
        if (session.slug !== slug) {
            throw new HttpException('Slug không khớp', HttpStatus.FORBIDDEN);
        }

        try {
            // Fetch original order
            const originalOrder = await this.salesOrderRepo.findOne({
                where: { id: body.order_id, customer_id: session.customer_id },
                relations: ['items', 'customer'],
            });

            if (!originalOrder) {
                throw new HttpException('Không tìm thấy đơn hàng gốc', HttpStatus.NOT_FOUND);
            }

            // Use provided items (adjusted quantities) or original items
            const items = body.items || originalOrder.items.map(i => ({
                sku: i.sku,
                quantity: Number(i.quantity),
                unit_price: Number(i.unit_price),
            }));

            // Create new Quotation
            const newQuotation = await this.salesService.createOrder({
                customer_id: originalOrder.customer_id,
                customer_name: originalOrder.customer?.name || originalOrder.customer_name,
                items: items.map(i => ({
                    sku: i.sku,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                })),
                note: body.note ? `📦 Đặt lại từ đơn ${originalOrder.order_code} (Portal B2B)\nKhách ghi chú: ${body.note}` : `📦 Đặt lại từ đơn ${originalOrder.order_code} (Portal B2B)`,
                order_source: 'B2B_PORTAL',
            });

            // Update lead history
            if (originalOrder.customer) {
                const customer = await this.customerRepo.findOne({ where: { id: originalOrder.customer_id } });
                if (customer) {
                    const history = customer.history || [];
                    history.push({
                        action: 'REORDER_FROM_PORTAL',
                        timestamp: new Date(),
                        data: {
                            original_order: originalOrder.order_code,
                            new_order: newQuotation.order_code,
                        },
                    });
                    customer.history = history;
                    await this.customerRepo.save(customer);
                }
            }

            return {
                success: true,
                message: 'Báo giá mới đã được tạo thành công. Đội ngũ Sales sẽ liên hệ xác nhận.',
                order_code: newQuotation.order_code,
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('Error creating reorder:', error);
            throw new HttpException('Lỗi khi tạo báo giá mới', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ============================================================
    // 5. VALIDATE TOKEN (for frontend to check if session is valid)
    // ============================================================
    @Get('validate-token')
    async validateToken(@Headers('authorization') authHeader: string) {
        const session = await this.validateSession(authHeader);
        const customer = await this.customerRepo.findOne({ where: { id: session.customer_id } });
        return {
            valid: true,
            slug: session.slug,
            customer: customer ? {
                id: customer.id,
                name: customer.name,
                code: customer.code,
            } : null,
        };
    }

    // ============================================================
    // 6. PROMOTION DETAIL (Products list for a promotion)
    // ============================================================
    @Get('promotion/:slug/:id')
    async getPromotionDetail(
        @Param('slug') slug: string,
        @Param('id') id: string,
        @Headers('authorization') authHeader: string,
    ) {
        const session = await this.validateSession(authHeader);
        if (session.slug !== slug) {
            throw new HttpException('Slug không khớp', HttpStatus.FORBIDDEN);
        }

        try {
            const result = await this.salesService.getPromotionWithProducts(
                Number(id),
                session.customer_id,
            );
            return result;
        } catch (error) {
            if (error instanceof HttpException) throw error;
            throw new HttpException('Lỗi tải chi tiết khuyến mãi', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ============================================================
    // 7. ORDER FROM PROMOTION
    // ============================================================
    @Post('promotion/:slug/:id/order')
    async orderFromPromotion(
        @Param('slug') slug: string,
        @Param('id') id: string,
        @Headers('authorization') authHeader: string,
        @Body() body: { items: Array<{ sku: string; quantity: number; unit_price: number }> },
    ) {
        const session = await this.validateSession(authHeader);
        if (session.slug !== slug) {
            throw new HttpException('Slug không khớp', HttpStatus.FORBIDDEN);
        }

        if (!body.items || body.items.length === 0) {
            throw new HttpException('Vui lòng chọn ít nhất 1 sản phẩm', HttpStatus.BAD_REQUEST);
        }

        try {
            // Verify promotion exists and is valid for this customer
            const { promotion } = await this.salesService.getPromotionWithProducts(
                Number(id),
                session.customer_id,
            );

            // Calculate discount
            let discountRate = 0;
            let discountAmount = 0;
            if (promotion.discount_type === 'PERCENTAGE') {
                discountRate = Number(promotion.discount_value);
            } else if (promotion.discount_type === 'FIXED_AMOUNT') {
                discountAmount = Number(promotion.discount_value);
            }

            // Create quotation
            const customer = await this.customerRepo.findOne({ where: { id: session.customer_id } });
            const newOrder = await this.salesService.createOrder({
                customer_id: session.customer_id,
                customer_name: customer?.name || '',
                items: body.items.map(i => ({
                    sku: i.sku,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                })),
                is_quotation: true,
                discount_rate: discountRate,
                discount_amount: discountAmount,
                note: `🎁 Đặt hàng từ chương trình KM: ${promotion.name} (Portal B2B)`,
                order_source: 'B2B_PORTAL_PROMO',
            });

            // Increment used_count
            promotion.used_count = (promotion.used_count || 0) + 1;
            await this.salesService.updatePromotion(promotion.id, { used_count: promotion.used_count });

            // Log to customer history
            if (customer) {
                const history = customer.history || [];
                history.push({
                    action: 'ORDER_FROM_PROMOTION',
                    timestamp: new Date(),
                    data: {
                        promotion_name: promotion.name,
                        order_code: newOrder.order_code,
                    },
                });
                customer.history = history;
                await this.customerRepo.save(customer);
            }

            return {
                success: true,
                message: `Báo giá ${newOrder.order_code} đã được tạo thành công từ chương trình khuyến mãi "${promotion.name}". Đội ngũ Sales sẽ liên hệ xác nhận.`,
                order_code: newOrder.order_code,
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('Error creating promotion order:', error);
            throw new HttpException('Lỗi khi tạo đơn hàng từ khuyến mãi', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    // ============================================================
    // 8. PRODUCT STATS (For customer to check their inventory/purchases)
    // ============================================================
    @Get('product-stats/:slug')
    async getProductStats(
        @Param('slug') slug: string,
        @Headers('authorization') authHeader: string,
        @Query('fromDate') fromDate?: string,
        @Query('toDate') toDate?: string,
    ) {
        const session = await this.validateSession(authHeader);
        if (session.slug !== slug) {
            throw new HttpException('Slug không khớp', HttpStatus.FORBIDDEN);
        }

        try {
            const qb = this.salesOrderRepo.createQueryBuilder('order')
                .leftJoinAndSelect('order.items', 'item')
                .leftJoinAndSelect('item.product', 'product')
                .where('order.customer_id = :customerId', { customerId: session.customer_id })
                .andWhere('order.status != :status', { status: 'CANCELLED' });

            if (fromDate) {
                qb.andWhere('order.order_date >= :fromDate', { fromDate });
            }
            if (toDate) {
                qb.andWhere('order.order_date <= :toDate', { toDate: toDate + ' 23:59:59' });
            }

            const orders = await qb.getMany();

            const productStats: Record<string, { sku: string, name: string, unit: string, image_url: string, total_quantity: number, total_value: number }> = {};

            orders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        const sku = item.sku;
                        if (!productStats[sku]) {
                            productStats[sku] = {
                                sku: sku,
                                name: item.product?.name || sku,
                                unit: item.product?.unit || 'Cái',
                                image_url: item.image_url || item.product?.image_url || '',
                                total_quantity: 0,
                                total_value: 0,
                            };
                        }
                        productStats[sku].total_quantity += Number(item.quantity) || 0;
                        productStats[sku].total_value += Number(item.subtotal) || 0;
                    });
                }
            });

            return {
                success: true,
                data: Object.values(productStats).sort((a, b) => b.total_quantity - a.total_quantity)
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('Error fetching product stats:', error);
            throw new HttpException('Lỗi server khi tải thống kê sản phẩm', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    // ============================================================
    // 9. CUSTOM ORDER FROM PORTAL B2B
    // ============================================================
    @Post('custom-order/:slug')
    async createCustomOrder(
        @Param('slug') slug: string,
        @Headers('authorization') authHeader: string,
        @Body() body: { 
            category: string; 
            subcategory: string; 
            quantity: number; 
            total_price: number;
            selections: Array<{ step_label: string; option_name: string; modifier: number }>;
            notes: string;
        },
    ) {
        const session = await this.validateSession(authHeader);
        if (session.slug !== slug) {
            throw new HttpException('Slug không khớp', HttpStatus.FORBIDDEN);
        }

        try {
            const customer = await this.customerRepo.findOne({ where: { id: session.customer_id } });
            
            // Build description from selections
            const descLines = body.selections.map(s => `- ${s.step_label}: ${s.option_name}`);
            const fullNote = `🎨 ĐẶT HÀNG TỰ THIẾT KẾ (B2B PORTAL)\nDanh mục: ${body.category} > ${body.subcategory}\nCấu hình:\n${descLines.join('\n')}\n\nGhi chú khách: ${body.notes || 'Không có'}`;

            // Create quotation
            const newOrder = await this.salesService.createOrder({
                customer_id: session.customer_id,
                customer_name: customer?.name || '',
                items: [{
                    sku: 'CUSTOM-B2B',
                    quantity: body.quantity,
                    unit_price: body.total_price / body.quantity, // unit_price = total/quantity
                }],
                is_quotation: true,
                note: fullNote,
                order_source: 'B2B_PORTAL_CUSTOM',
            });

            // Log to customer history
            if (customer) {
                const history = customer.history || [];
                history.push({
                    action: 'CUSTOM_ORDER_FROM_PORTAL',
                    timestamp: new Date(),
                    data: {
                        product: body.subcategory,
                        order_code: newOrder.order_code,
                    },
                });
                customer.history = history;
                await this.customerRepo.save(customer);
            }

            return {
                success: true,
                message: `Yêu cầu báo giá tự thiết kế (${newOrder.order_code}) đã được tạo thành công. Đội ngũ Sales sẽ liên hệ xác nhận.`,
                order_code: newOrder.order_code,
            };
        } catch (error) {
            if (error instanceof HttpException) throw error;
            console.error('Error creating custom order:', error);
            throw new HttpException('Lỗi khi tạo báo giá tự thiết kế', HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
