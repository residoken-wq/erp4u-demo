import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SocialChannel, SocialPlatform, ChannelStatus } from './entities/social-channel.entity';
import { SocialOrder, SocialOrderStatus } from './entities/social-order.entity';
import { SocialProductMapping } from './entities/social-product-mapping.entity';
import { SalesOrder, SalesOrderStatus } from '../sales/sales-order.entity';
import { Product } from '../products/product.entity';

@Injectable()
export class SocialService {
    private readonly logger = new Logger(SocialService.name);

    constructor(
        @InjectRepository(SocialChannel)
        private channelRepo: Repository<SocialChannel>,
        @InjectRepository(SocialOrder)
        private orderRepo: Repository<SocialOrder>,
        @InjectRepository(SocialProductMapping)
        private mappingRepo: Repository<SocialProductMapping>,
        @InjectRepository(SalesOrder)
        private salesOrderRepo: Repository<SalesOrder>,
        @InjectRepository(Product)
        private productRepo: Repository<Product>,
    ) { }

    // ===================== CHANNELS =====================

    async findAllChannels(): Promise<SocialChannel[]> {
        return this.channelRepo.find({
            order: { created_at: 'DESC' },
        });
    }

    async findChannelById(id: number): Promise<SocialChannel> {
        const channel = await this.channelRepo.findOne({ where: { id } });
        if (!channel) {
            throw new NotFoundException(`Channel #${id} not found`);
        }
        return channel;
    }

    async createChannel(data: Partial<SocialChannel>): Promise<SocialChannel> {
        const channel = this.channelRepo.create(data);
        return this.channelRepo.save(channel);
    }

    async updateChannel(id: number, data: Partial<SocialChannel>): Promise<SocialChannel> {
        await this.channelRepo.update(id, data);
        return this.findChannelById(id);
    }

    async deleteChannel(id: number): Promise<void> {
        await this.channelRepo.delete(id);
    }

    async updateChannelStatus(id: number, status: ChannelStatus, error?: string): Promise<void> {
        await this.channelRepo.update(id, {
            status,
            last_error: error || null,
            last_sync_at: new Date(),
        });
    }

    // ===================== ORDERS =====================

    async findAllOrders(filters?: { platform?: SocialPlatform; status?: SocialOrderStatus }): Promise<SocialOrder[]> {
        const qb = this.orderRepo.createQueryBuilder('o')
            .leftJoinAndSelect('o.channel', 'channel')
            .leftJoinAndSelect('o.sales_order', 'sales_order')
            .orderBy('o.created_at', 'DESC');

        if (filters?.platform) {
            qb.andWhere('o.platform = :platform', { platform: filters.platform });
        }
        if (filters?.status) {
            qb.andWhere('o.sync_status = :status', { status: filters.status });
        }

        return qb.getMany();
    }

    async findOrderById(id: number): Promise<SocialOrder> {
        const order = await this.orderRepo.findOne({
            where: { id },
            relations: ['channel', 'sales_order'],
        });
        if (!order) {
            throw new NotFoundException(`Social order #${id} not found`);
        }
        return order;
    }

    async createSocialOrder(data: Partial<SocialOrder>): Promise<SocialOrder> {
        const order = this.orderRepo.create(data);
        return this.orderRepo.save(order);
    }

    async syncOrderToSalesOrder(socialOrderId: number): Promise<SalesOrder> {
        const socialOrder = await this.findOrderById(socialOrderId);

        if (socialOrder.sales_order_id) {
            throw new BadRequestException('Order already synced');
        }

        // Generate order code
        const count = await this.salesOrderRepo.count();
        const orderCode = `SO-${new Date().getFullYear()}${String(count + 1).padStart(5, '0')}`;

        // Create sales order from social order
        const salesOrder = this.salesOrderRepo.create({
            order_code: orderCode,
            customer_name: socialOrder.buyer_name,
            shipping_address: socialOrder.shipping_address,
            receiver_name: socialOrder.buyer_name,
            receiver_phone: socialOrder.buyer_phone,
            shipping_fee: Number(socialOrder.shipping_fee),
            total_amount: Number(socialOrder.total_amount),
            order_source: socialOrder.platform,
            status: SalesOrderStatus.SO_PENDING,
            note: `Đồng bộ từ ${socialOrder.platform} - ${socialOrder.platform_order_code}`,
        });

        const savedOrder = await this.salesOrderRepo.save(salesOrder);

        // Update social order with sales_order_id
        await this.orderRepo.update(socialOrderId, {
            sales_order_id: savedOrder.id,
            sync_status: SocialOrderStatus.SYNCED,
            synced_at: new Date(),
        });

        this.logger.log(`Synced social order ${socialOrderId} to sales order ${savedOrder.order_code}`);
        return savedOrder;
    }

    // ===================== PRODUCT MAPPINGS =====================

    async findAllMappings(channelId?: number): Promise<SocialProductMapping[]> {
        const qb = this.mappingRepo.createQueryBuilder('m')
            .leftJoinAndSelect('m.channel', 'channel')
            .leftJoinAndSelect('m.product', 'product')
            .orderBy('m.created_at', 'DESC');

        if (channelId) {
            qb.andWhere('m.channel_id = :channelId', { channelId });
        }

        return qb.getMany();
    }

    async createMapping(data: Partial<SocialProductMapping>): Promise<SocialProductMapping> {
        const mapping = this.mappingRepo.create(data);
        return this.mappingRepo.save(mapping);
    }

    async updateMapping(id: number, data: Partial<SocialProductMapping>): Promise<SocialProductMapping> {
        await this.mappingRepo.update(id, data);
        return this.mappingRepo.findOne({ where: { id }, relations: ['channel', 'product'] });
    }

    async deleteMapping(id: number): Promise<void> {
        await this.mappingRepo.delete(id);
    }

    async findMappingBySku(channelId: number, sku: string): Promise<SocialProductMapping | null> {
        return this.mappingRepo.findOne({
            where: { channel_id: channelId, platform_sku: sku },
            relations: ['product'],
        });
    }

    // ===================== SYNC OPERATIONS =====================

    async getChannelStats(channelId: number): Promise<{
        total_orders: number;
        pending_orders: number;
        synced_orders: number;
        total_products: number;
    }> {
        const totalOrders = await this.orderRepo.count({ where: { channel_id: channelId } });
        const pendingOrders = await this.orderRepo.count({ where: { channel_id: channelId, sync_status: SocialOrderStatus.PENDING } });
        const syncedOrders = await this.orderRepo.count({ where: { channel_id: channelId, sync_status: SocialOrderStatus.SYNCED } });
        const totalProducts = await this.mappingRepo.count({ where: { channel_id: channelId } });

        return {
            total_orders: totalOrders,
            pending_orders: pendingOrders,
            synced_orders: syncedOrders,
            total_products: totalProducts,
        };
    }
}
