import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerLogo } from './entities/customer-logo.entity';
import { PrintDesign } from './entities/print-design.entity';
import { PrintSample } from './entities/print-sample.entity';
import { DesignOrder } from './entities/design-order.entity';
import { DesignOrderItem } from './entities/design-order-item.entity';

@Injectable()
export class DesignsService {
    constructor(
        @InjectRepository(CustomerLogo) private logoRepo: Repository<CustomerLogo>,
        @InjectRepository(PrintDesign) private designRepo: Repository<PrintDesign>,
        @InjectRepository(PrintSample) private sampleRepo: Repository<PrintSample>,
        @InjectRepository(DesignOrder) private designOrderRepo: Repository<DesignOrder>,
        @InjectRepository(DesignOrderItem) private designOrderItemRepo: Repository<DesignOrderItem>
    ) {}

    // --- Customer Logo ---
    async getLogos(customerId?: number) {
        const query = this.logoRepo.createQueryBuilder('logo').leftJoinAndSelect('logo.customer', 'customer');
        if (customerId) {
            query.where('logo.customer_id = :customerId', { customerId });
        }
        query.orderBy('logo.created_at', 'DESC');
        return query.getMany();
    }

    async createLogo(data: any) {
        const logo = this.logoRepo.create(data);
        return this.logoRepo.save(logo);
    }

    async updateLogo(id: number, data: any) {
        await this.logoRepo.update(id, data);
        return this.logoRepo.findOne({ where: { id } });
    }

    async deleteLogo(id: number) {
        return this.logoRepo.delete(id);
    }

    // --- Print Design ---
    async getPrintDesigns(customerId?: number, productId?: number, categoryId?: number) {
        const query = this.designRepo.createQueryBuilder('design')
            .leftJoinAndSelect('design.customer', 'customer')
            .leftJoinAndSelect('design.product', 'product')
            .leftJoinAndSelect('design.customer_logos', 'logos');
        
        if (customerId) {
            query.andWhere('design.customer_id = :customerId', { customerId });
        }
        if (productId) {
            query.andWhere('design.product_id = :productId', { productId });
        }
        if (categoryId) {
            query.andWhere('product.category_id = :categoryId', { categoryId });
        }
        query.orderBy('design.created_at', 'DESC');
        return query.getMany();
    }

    async getPrintDesignById(id: number) {
        return this.designRepo.findOne({ 
            where: { id }, 
            relations: ['customer', 'product', 'customer_logos'] 
        });
    }

    async createPrintDesign(data: any) {
        const design = new PrintDesign();
        Object.assign(design, data);
        
        if (data.logo_ids && Array.isArray(data.logo_ids)) {
            design.customer_logos = data.logo_ids.map(id => ({ id } as CustomerLogo));
        }
        
        return this.designRepo.save(design);
    }

    async updatePrintDesign(id: number, data: any) {
        const design = await this.designRepo.findOne({ where: { id }, relations: ['customer_logos'] });
        if (!design) throw new NotFoundException('Print design not found');

        if (data.logo_ids && Array.isArray(data.logo_ids)) {
            design.customer_logos = data.logo_ids.map(id => ({ id } as CustomerLogo));
        }

        Object.assign(design, data);
        return this.designRepo.save(design);
    }

    async deletePrintDesign(id: number) {
        return this.designRepo.delete(id);
    }

    // --- Print Sample ---
    async getSamplesByPo(poId: number) {
        return this.sampleRepo.find({
            where: { po_id: poId },
            relations: ['print_design', 'supplier'],
            order: { created_at: 'DESC' }
        });
    }

    async createPrintSample(data: any) {
        const sample = this.sampleRepo.create(data);
        return this.sampleRepo.save(sample);
    }

    async updatePrintSampleStatus(id: number, status: string, feedback?: string) {
        await this.sampleRepo.update(id, { status: status as any, feedback_notes: feedback });
        return this.sampleRepo.findOne({ where: { id } });
    }
    // --- Design Order ---
    async getDesignOrders(filters?: any) {
        const query = this.designOrderRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.customer', 'customer')
            .leftJoinAndSelect('order.product', 'product')
            .leftJoinAndSelect('order.designer', 'designer')
            .leftJoinAndSelect('order.items', 'items');

        if (filters?.customer_id) query.andWhere('order.customer_id = :customerId', { customerId: filters.customer_id });
        if (filters?.product_id) query.andWhere('order.product_id = :productId', { productId: filters.product_id });
        if (filters?.status) query.andWhere('order.status = :status', { status: filters.status });

        query.orderBy('order.created_at', 'DESC');
        return query.getMany();
    }

    async getDesignOrderById(id: number) {
        const order = await this.designOrderRepo.findOne({
            where: { id },
            relations: ['customer', 'product', 'designer', 'items', 'sales_order', 'purchase_order']
        });
        if (!order) throw new NotFoundException('Design order not found');
        return order;
    }

    async getDesignOrderByUuid(uuid: string) {
        return this.designOrderRepo.findOne({
            where: { uuid },
            relations: ['customer', 'product', 'designer', 'items', 'sales_order', 'purchase_order']
        });
    }

    async createDesignOrder(data: any) {
        // Auto-generate code if not provided
        if (!data.code) {
            const count = await this.designOrderRepo.count();
            data.code = `DO-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;
        }
        
        if (!data.uuid) {
            data.uuid = crypto.randomUUID();
        }
        
        const order = this.designOrderRepo.create(data);
        return this.designOrderRepo.save(order);
    }

    async updateDesignOrder(id: number, data: any) {
        await this.designOrderRepo.update(id, data);
        return this.getDesignOrderById(id);
    }

    async updateDesignOrderStatus(id: number, status: string) {
        await this.designOrderRepo.update(id, { status: status as any });
        return this.getDesignOrderById(id);
    }

    async deleteDesignOrder(id: number) {
        return this.designOrderRepo.delete(id);
    }

    // --- Design Order Items ---
    async addDesignOrderItem(orderId: number, data: any) {
        const item = this.designOrderItemRepo.create({ ...data, design_order_id: orderId });
        return this.designOrderItemRepo.save(item);
    }

    async updateDesignOrderItem(itemId: number, data: any) {
        await this.designOrderItemRepo.update(itemId, data);
        return this.designOrderItemRepo.findOne({ where: { id: itemId } });
    }

    async deleteDesignOrderItem(itemId: number) {
        return this.designOrderItemRepo.delete(itemId);
    }
}
