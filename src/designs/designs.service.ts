import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomerLogo } from './entities/customer-logo.entity';
import { PrintDesign } from './entities/print-design.entity';
import { PrintSample } from './entities/print-sample.entity';

@Injectable()
export class DesignsService {
    constructor(
        @InjectRepository(CustomerLogo) private logoRepo: Repository<CustomerLogo>,
        @InjectRepository(PrintDesign) private designRepo: Repository<PrintDesign>,
        @InjectRepository(PrintSample) private sampleRepo: Repository<PrintSample>
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
}
