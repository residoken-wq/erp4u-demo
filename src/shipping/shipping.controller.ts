// Shipping Controller - Logistics & Deliveries Management
import { Controller, Post, Get, Body, Param, Query, Res, UseGuards, HttpCode } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { GhtkService, GhtkFeeDto } from './carriers/ghtk.service';
import { LalamoveService, LalamoveQuotationDto, LalamovePushOrderOptions, LALAMOVE_VIETNAM_VEHICLES } from './carriers/lalamove.service';
import { SalesDelivery } from '../sales/sales-delivery.entity';
import { Response } from 'express';

@Controller('shipping')
export class ShippingController {
    constructor(
        private readonly ghtkService: GhtkService,
        private readonly lalamoveService: LalamoveService,
        @InjectRepository(SalesDelivery)
        private readonly deliveryRepo: Repository<SalesDelivery>,
    ) {}

    // ==========================================
    // QUẢN LÝ TẬP TRUNG DANH SÁCH VẬN ĐƠN
    // ==========================================

    @Get('deliveries')
    async getAllDeliveries(
        @Query('carrier') carrier?: string,
        @Query('status') status?: string,
        @Query('search') search?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        const qb = this.deliveryRepo.createQueryBuilder('d')
            .leftJoinAndSelect('d.sales_order', 'so')
            .leftJoinAndSelect('so.customer', 'customer')
            .leftJoinAndSelect('so.items', 'so_items')
            .leftJoinAndSelect('so_items.product', 'product')
            .leftJoinAndSelect('d.items', 'items');

        // Carrier filter
        if (carrier && carrier !== 'ALL') {
            const upper = carrier.toUpperCase();
            if (upper === 'GHTK') {
                qb.andWhere("(UPPER(d.shipping_carrier) LIKE '%GHTK%' OR UPPER(d.shipping_provider) = 'GHTK')");
            } else if (upper === 'LALAMOVE') {
                qb.andWhere("(UPPER(d.shipping_carrier) LIKE '%LALAMOVE%' OR UPPER(d.shipping_provider) = 'LALAMOVE')");
            } else if (upper === 'OTHER') {
                qb.andWhere("(UPPER(COALESCE(d.shipping_carrier, '')) NOT LIKE '%GHTK%' AND UPPER(COALESCE(d.shipping_carrier, '')) NOT LIKE '%LALAMOVE%' AND (d.shipping_provider IS NULL OR d.shipping_provider = 'OTHER'))");
            } else {
                qb.andWhere("UPPER(d.shipping_carrier) LIKE :carrier", { carrier: `%${upper}%` });
            }
        }

        // Status filter
        if (status && status !== 'ALL') {
            qb.andWhere('d.status = :status', { status });
        }

        // Date range filter
        if (startDate) {
            qb.andWhere('d.delivery_date >= :startDate', { startDate });
        }
        if (endDate) {
            qb.andWhere('d.delivery_date <= :endDate', { endDate });
        }

        // Search filter
        if (search && search.trim()) {
            const term = `%${search.trim().toLowerCase()}%`;
            qb.andWhere(
                '(LOWER(so.order_code) LIKE :term OR LOWER(d.code) LIKE :term OR LOWER(COALESCE(d.tracking_code, \'\')) LIKE :term OR LOWER(COALESCE(customer.name, \'\')) LIKE :term OR LOWER(COALESCE(so.customer_name, \'\')) LIKE :term OR LOWER(COALESCE(d.contact_name, \'\')) LIKE :term OR LOWER(COALESCE(d.contact_phone, \'\')) LIKE :term)',
                { term }
            );
        }

        qb.orderBy('d.delivery_date', 'DESC')
          .addOrderBy('d.created_at', 'DESC')
          .addOrderBy('d.id', 'DESC');

        const deliveries = await qb.getMany();

        // Load sibling deliveries for each order
        const orderIds = Array.from(new Set(deliveries.map(d => d.order_id).filter(Boolean)));
        let siblingMap: Record<number, any[]> = {};
        if (orderIds.length > 0) {
            const allSiblings = await this.deliveryRepo.find({
                where: { order_id: In(orderIds) },
                relations: ['items'],
                order: { delivery_date: 'ASC', id: 'ASC' }
            });

            for (const sib of allSiblings) {
                if (!siblingMap[sib.order_id]) {
                    siblingMap[sib.order_id] = [];
                }
                siblingMap[sib.order_id].push({
                    id: sib.id,
                    code: sib.code,
                    delivery_date: sib.delivery_date,
                    status: sib.status,
                    shipping_carrier: sib.shipping_carrier,
                    tracking_code: sib.tracking_code,
                    shipping_cost: Number(sib.shipping_cost) || 0,
                    items_count: sib.items?.length || 0,
                    total_quantity: (sib.items || []).reduce((acc, it) => acc + (Number(it.quantity) || 0), 0),
                    pick_money: Number(sib.pick_money) || 0,
                    shipping_status_text: sib.shipping_status_text
                });
            }
        }

        // Format and enrich each delivery
        const enriched = deliveries.map(d => {
            const so = d.sales_order;
            const customer = so?.customer;

            // Map delivery items with product info from sales_order.items
            const mappedItems = (d.items || []).map(di => {
                const matchedSoItem = so?.items?.find(soi => soi.sku === di.sku);
                return {
                    id: di.id,
                    sku: di.sku,
                    quantity: Number(di.quantity) || 0,
                    product_name: matchedSoItem?.product?.name || (matchedSoItem as any)?.vat_content || di.sku,
                    unit: matchedSoItem?.product?.unit || 'Bộ',
                    unit_price: Number(matchedSoItem?.unit_price) || 0,
                    order_quantity: Number(matchedSoItem?.quantity) || 0
                };
            });

            const allOrderDeliveries = siblingMap[d.order_id] || [];
            const otherDeliveries = allOrderDeliveries.filter(x => x.id !== d.id);

            return {
                id: d.id,
                code: d.code,
                order_id: d.order_id,
                order_code: so?.order_code || '',
                customer_id: customer?.id || so?.customer_id,
                customer_name: customer?.name || so?.customer_name || 'Quý khách',
                customer_phone: d.contact_phone || customer?.phone || so?.receiver_phone || so?.contact_phone || '',
                customer_address: d.delivery_address || customer?.address || so?.shipping_address || '',
                contact_name: d.contact_name || so?.receiver_name || customer?.name || '',
                contact_phone: d.contact_phone || so?.receiver_phone || customer?.phone || '',
                delivery_date: d.delivery_date,
                created_at: d.created_at,
                status: d.status,
                email_sent: d.email_sent,
                note: d.note,
                attachments: d.attachments,
                shipping_carrier: d.shipping_carrier || 'Chành xe / Nội bộ',
                shipping_provider: d.shipping_provider,
                tracking_code: d.tracking_code || '',
                shipping_cost: Number(d.shipping_cost) || 0,
                pick_money: Number(d.pick_money) || 0,
                is_freeship: d.is_freeship,
                weight_gram: d.weight_gram,
                package_count: d.package_count || 1,
                package_length: d.package_length,
                package_width: d.package_width,
                package_height: d.package_height,
                packing_spec_name: d.packing_spec_name,
                shipping_status_id: d.shipping_status_id,
                shipping_status_text: d.shipping_status_text,
                shipping_metadata: d.shipping_metadata,
                shipping_legs: d.shipping_legs,
                delivery_notice: d.delivery_notice,
                order_status: so?.status,
                order_total_amount: Number(so?.total_amount) || 0,
                order_paid_amount: Number(so?.paid_amount) || 0,
                items: mappedItems,
                sibling_deliveries: otherDeliveries,
                all_order_deliveries: allOrderDeliveries,
            };
        });

        // Compute summary statistics
        const stats = {
            total_count: enriched.length,
            ghtk_count: enriched.filter(d => (d.shipping_carrier || '').toUpperCase().includes('GHTK') || d.shipping_provider === 'GHTK').length,
            lalamove_count: enriched.filter(d => (d.shipping_carrier || '').toUpperCase().includes('LALAMOVE') || d.shipping_provider === 'LALAMOVE').length,
            other_count: enriched.filter(d => !(d.shipping_carrier || '').toUpperCase().includes('GHTK') && !(d.shipping_carrier || '').toUpperCase().includes('LALAMOVE')).length,
            total_shipping_cost: enriched.reduce((sum, d) => sum + (Number(d.shipping_cost) || 0), 0),
            total_pick_money: enriched.reduce((sum, d) => sum + (Number(d.pick_money) || 0), 0)
        };

        return {
            data: enriched,
            stats
        };
    }

    // ==========================================
    // CẤU HÌNH GHTK
    // ==========================================

    @Get('config')
    async getConfig() {
        const cfg = await this.ghtkService.getConfig();
        return {
            apiUrl: cfg.apiUrl,
            isConfigured: !!cfg.token,
            isSandbox: cfg.isSandbox,
            partnerCode: cfg.partnerCode || '',
            maskedToken: cfg.token ? `${cfg.token.slice(0, 6)}...${cfg.token.slice(-4)}` : '',
            hasToken: !!cfg.token,
            defaultPickAddressId: cfg.defaultPickAddressId || '',
            defaultPickOption: cfg.defaultPickOption || 'cod',
        };
    }

    @Post('config')
    async saveConfig(@Body() body: any) {
        return this.ghtkService.saveConfig(body);
    }

    @Post('test-connection')
    async testConnection(@Body() body: any) {
        return this.ghtkService.testConnection(body);
    }

    @Post('ghtk/parse-address')
    async parseAddress(@Body('address') address: string) {
        return this.ghtkService.parseAddress(address);
    }

    @Get('ghtk/pick-addresses')
    async getPickAddresses() {
        return this.ghtkService.getPickAddresses();
    }

    @Post('ghtk/estimate-fee')
    async estimateFee(@Body() body: GhtkFeeDto) {
        return this.ghtkService.calculateFee(body);
    }

    @Post('delivery/:deliveryId/push-ghtk')
    async pushDeliveryToGhtk(
        @Param('deliveryId') deliveryId: string,
        @Body() options: any,
    ) {
        return this.ghtkService.pushDeliveryToGhtk(Number(deliveryId), options);
    }

    @Post('delivery/:deliveryId/cancel-ghtk')
    async cancelGhtkOrder(@Param('deliveryId') deliveryId: string) {
        return this.ghtkService.cancelGhtkOrder(Number(deliveryId));
    }

    @Get('delivery/:deliveryId/tracking')
    async getTracking(@Param('deliveryId') deliveryId: string) {
        return this.ghtkService.getTracking(Number(deliveryId));
    }

    @Get('delivery/:deliveryId/label')
    async getLabelUrl(
        @Param('deliveryId') deliveryId: string,
        @Query('pageSize') pageSize: string = 'A6',
        @Query('format') format: string,
        @Res() res: Response,
    ) {
        const id = Number(deliveryId);
        const reqAccept = (res.req?.headers?.accept || '').toLowerCase();
        const wantsJson = (format === 'json') || (reqAccept.includes('application/json') && format !== 'pdf' && format !== 'stream');

        // Nếu client gọi API dạng JSON (tương thích ngược với frontend cũ gọi api.get() đợi { url: ... })
        if (wantsJson) {
            const url = await this.ghtkService.getLabelUrl(id, pageSize);
            return res.json({ url });
        }

        // Nếu mở trực tiếp trong tab trình duyệt, stream file PDF ra tab
        return this.streamLabelPdf(id, pageSize, res);
    }

    @Get('delivery/:deliveryId/print-label')
    async printLabel(
        @Param('deliveryId') deliveryId: string,
        @Query('pageSize') pageSize: string = 'A6',
        @Res() res: Response,
    ) {
        return this.streamLabelPdf(Number(deliveryId), pageSize, res);
    }

    @Get('delivery/:deliveryId/label-pdf')
    async printLabelPdf(
        @Param('deliveryId') deliveryId: string,
        @Query('pageSize') pageSize: string = 'A6',
        @Res() res: Response,
    ) {
        return this.streamLabelPdf(Number(deliveryId), pageSize, res);
    }

    private async streamLabelPdf(deliveryId: number, pageSize: string, res: Response) {
        try {
            const file = await this.ghtkService.getLabelBuffer(deliveryId, pageSize || 'A6');
            res.setHeader('Content-Type', file.contentType);
            if (!file.isHtml) {
                res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
            }
            res.setHeader('Content-Length', file.buffer.length);
            return res.send(file.buffer);
        } catch (err: any) {
            const msg = err.message || 'Không thể tải nhãn in từ hãng GHTK';
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            return res.status(200).send(this.ghtkService.renderErrorHtml(String(deliveryId), msg));
        }
    }

    @Post('webhook/ghtk')
    @HttpCode(200)
    async handleGhtkWebhook(@Body() body: any) {
        return this.ghtkService.handleWebhook(body);
    }

    // ==========================================
    // CẤU HÌNH & TÍCH HỢP LALAMOVE API v3
    // ==========================================

    @Get('lalamove/config')
    async getLalamoveConfig() {
        const cfg = await this.lalamoveService.getConfig();
        return {
            apiUrl: cfg.apiUrl,
            isConfigured: !!(cfg.apiKey && cfg.apiSecret),
            isSandbox: cfg.isSandbox,
            market: cfg.market,
            hasApiKey: !!cfg.apiKey,
            hasApiSecret: !!cfg.apiSecret,
            maskedApiKey: cfg.apiKey ? `${cfg.apiKey.slice(0, 6)}...${cfg.apiKey.slice(-4)}` : '',
            maskedApiSecret: cfg.apiSecret ? `${cfg.apiSecret.slice(0, 4)}...${cfg.apiSecret.slice(-4)}` : '',
            defaultPickAddress: cfg.defaultPickAddress,
            defaultPickLat: cfg.defaultPickLat,
            defaultPickLng: cfg.defaultPickLng,
            defaultSenderName: cfg.defaultSenderName,
            defaultSenderPhone: cfg.defaultSenderPhone,
            supportedVehicles: LALAMOVE_VIETNAM_VEHICLES,
        };
    }

    @Post('lalamove/config')
    async saveLalamoveConfig(@Body() body: any) {
        return this.lalamoveService.saveConfig(body);
    }

    @Post('lalamove/test-connection')
    async testLalamoveConnection(@Body() body: any) {
        return this.lalamoveService.testConnection(body);
    }

    @Get('lalamove/vehicles')
    getLalamoveVehicles() {
        return LALAMOVE_VIETNAM_VEHICLES;
    }

    @Post('lalamove/geocode')
    async geocodeLalamoveAddress(@Body('address') address: string) {
        return this.lalamoveService.geocodeAddress(address);
    }

    @Post('lalamove/quotation')
    async getLalamoveQuotation(@Body() body: LalamoveQuotationDto) {
        return this.lalamoveService.getQuotation(body);
    }

    @Post('lalamove/estimate-fee')
    async estimateLalamoveFee(@Body() body: any) {
        return this.lalamoveService.estimateFee(body);
    }

    @Post('delivery/:deliveryId/push-lalamove')
    async pushDeliveryToLalamove(
        @Param('deliveryId') deliveryId: string,
        @Body() options: LalamovePushOrderOptions,
    ) {
        return this.lalamoveService.pushDeliveryToLalamove(Number(deliveryId), options);
    }

    @Post('delivery/:deliveryId/sync-lalamove')
    async syncLalamoveStatus(@Param('deliveryId') deliveryId: string) {
        return this.lalamoveService.syncDeliveryStatus(Number(deliveryId));
    }

    @Post('delivery/:deliveryId/sync-carrier')
    async syncCarrierStatus(@Param('deliveryId') deliveryId: string) {
        const id = Number(deliveryId);
        const delivery = await this.deliveryRepo.findOne({ where: { id } });
        if (!delivery) {
            return { success: false, message: `Không tìm thấy phiếu xuất kho #${deliveryId}` };
        }

        const isGhtk = (delivery.shipping_carrier || '').toUpperCase().includes('GHTK') || delivery.shipping_provider === 'GHTK';
        const isLalamove = (delivery.shipping_carrier || '').toUpperCase().includes('LALAMOVE') || delivery.shipping_provider === 'LALAMOVE';

        if (isLalamove) {
            return this.lalamoveService.syncDeliveryStatus(id);
        } else if (isGhtk) {
            return this.ghtkService.syncDeliveryStatus(id);
        } else {
            return {
                success: true,
                message: `Đơn vị vận chuyển "${delivery.shipping_carrier || 'Nội bộ'}": Trạng thái phiếu hiện tại là ${delivery.status}`,
                status: delivery.shipping_status_text || delivery.status
            };
        }
    }

    @Get('delivery/:deliveryId/lalamove-order/:orderId')
    async getLalamoveOrderDetails(
        @Param('deliveryId') deliveryId: string,
        @Param('orderId') orderId: string,
    ) {
        return this.lalamoveService.getOrderDetails(orderId);
    }

    @Get('delivery/:deliveryId/lalamove-driver/:driverId')
    async getLalamoveDriverDetails(
        @Param('deliveryId') deliveryId: string,
        @Param('driverId') driverId: string,
    ) {
        return this.lalamoveService.getDriverDetails(deliveryId, driverId);
    }

    @Post('delivery/:deliveryId/lalamove-priority-fee')
    async addLalamovePriorityFee(
        @Param('deliveryId') deliveryId: string,
        @Body('priorityFee') priorityFee: number,
    ) {
        return this.lalamoveService.addPriorityFee(Number(deliveryId), Number(priorityFee));
    }

    @Post('delivery/:deliveryId/cancel-lalamove')
    async cancelLalamoveOrder(@Param('deliveryId') deliveryId: string) {
        return this.lalamoveService.cancelOrder(Number(deliveryId));
    }

    @Get('webhook/lalamove')
    @HttpCode(200)
    async verifyLalamoveWebhook() {
        return { success: true, message: 'Lalamove Webhook endpoint is active' };
    }

    @Post('webhook/lalamove')
    @HttpCode(200)
    async handleLalamoveWebhook(@Body() body: any) {
        return this.lalamoveService.handleWebhook(body);
    }
}
