import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Supplier } from './supplier.entity';
import { SupplierMaterial } from './supplier-material.entity';
import { ProductRouting } from '../products/product-routing.entity';
import { Material } from '../materials/material.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';

@Injectable()
export class SuppliersService {
    constructor(
        @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
        @InjectRepository(SupplierMaterial) private supplierMaterialRepo: Repository<SupplierMaterial>,
        @InjectRepository(ProductRouting) private routingRepo: Repository<ProductRouting>,
        @InjectRepository(Material) private materialRepo: Repository<Material>,
        @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    ) { }

    // --- HÀM CRUD CƠ BẢN (KHÔNG THỂ THIẾU) ---

    async create(data: any) { return this.supplierRepo.save(this.supplierRepo.create(data)); }
    async findAll() {
        const qb = this.supplierRepo.createQueryBuilder('s')
            .leftJoin('s.transactions', 't', 't.type = :type', { type: 'EXPENSE' })
            .select(['s.id', 's.code', 's.name', 's.type', 's.phone', 's.email', 's.address', 's.note', 's.created_at', 's.uuid'])
            .addSelect('SUM(CASE WHEN t.reference_code LIKE :poPrefix OR t.reference_code LIKE :bulkPrefix THEN t.amount ELSE 0 END)', 'paid_po')
            .addSelect('SUM(CASE WHEN t.reference_code IS NULL OR (t.reference_code NOT LIKE :poPrefix AND t.reference_code NOT LIKE :bulkPrefix) THEN t.amount ELSE 0 END)', 'paid_other')
            .groupBy('s.id')
            .orderBy('s.created_at', 'DESC') // Note: Order by in group by might require s.created_at in select
            .setParameter('poPrefix', 'PO-%')
            .setParameter('bulkPrefix', 'BULK-PO-%');

        const { entities, raw } = await qb.getRawAndEntities();

        // Calculate Debt separately to avoid cartesian product
        const debtData = await this.poRepo.createQueryBuilder('po')
            .select('po.supplier_id', 'supplier_id')
            .addSelect('SUM(po.total_amount - COALESCE(po.paid_amount, 0))', 'debt')
            .where('po.status != :cancelled', { cancelled: 'CANCELLED' })
            .groupBy('po.supplier_id')
            .getRawMany();

        return entities.map(e => {
            const r = raw.find(row => row.s_id === e.id);
            const d = debtData.find(row => row.supplier_id === e.id);
            return {
                ...e,
                debt: d ? Number(d.debt) : 0,
                paid_po: r ? Math.abs(Number(r.paid_po)) : 0,
                paid_other: r ? Math.abs(Number(r.paid_other)) : 0
            };
        });
    }
    async findOne(id: number) {
        const supplier = await this.supplierRepo.findOne({
            where: { id },
            relations: ['price_list', 'price_list.material', 'routings', 'routings.product']
        });
        if (!supplier) throw new NotFoundException('Not found');
        return supplier;
    }
    async update(id: number, data: any) { await this.supplierRepo.update(id, data); return this.findOne(id); }
    async remove(id: number) { await this.supplierRepo.delete(id); return { deleted: true }; }


    // --- LOGIC GIÁ NPL ---
    async addMaterialPrice(supplierId: number, data: any) {
        const { material_id, price, valid_from, valid_to, is_preferred } = data;

        let record = await this.supplierMaterialRepo.findOne({
            where: { supplier: { id: supplierId }, material: { id: material_id } }
        });

        if (record) {
            record.price = price;
            if (valid_from) record.valid_from = valid_from;
            if (valid_to) record.valid_to = valid_to;
            record.is_preferred = is_preferred;
        } else {
            record = this.supplierMaterialRepo.create({
                supplier: { id: supplierId },
                material: { id: material_id },
                price: price,
                valid_from: valid_from,
                valid_to: valid_to,
                is_preferred: is_preferred
            });
        }

        const saved = await this.supplierMaterialRepo.save(record);

        if (is_preferred) {
            await this.materialRepo.update(material_id, { cost_price: price });
        }
        return saved;
    }

    // --- FIX: THÊM HÀM XÓA GIÁ NPL ---
    async deleteMaterialPrice(id: number) {
        return this.supplierMaterialRepo.delete(id);
    }


    // --- LOGIC GIÁ CHUNG (cho ManufacturersPage) ---
    async addSupplierPrice(data: any) {
        const { supplierId, itemId, itemType, productId, price, isPreferred, validFrom, validTo } = data;

        if (!supplierId || !itemId || !price) {
            throw new BadRequestException('Missing required fields: supplierId, itemId, price');
        }

        if (itemType === 'MATERIAL') {
            // Xử lý thông qua hàm chuyên biệt (Upsert)
            return this.addMaterialPrice(supplierId, {
                material_id: itemId, price, valid_from: validFrom, valid_to: validTo, is_preferred: isPreferred
            });

        } else if (itemType === 'PROCESS') {
            // LOGIC XỬ LÝ GIÁ GIA CÔNG (Sản phẩm + Công đoạn)

            // FIX: Dùng quan hệ process_id (itemId) và supplier_id
            const existingRouting = await this.routingRepo.findOne({
                where: {
                    supplier: { id: supplierId },
                    product: { id: productId || null },
                    process: { id: itemId } // Dùng quan hệ process đã fix ở Bước 1
                }
            });

            // Tương tự, nếu không tồn tại thì báo lỗi (chờ người dùng định nghĩa routing)
            if (!existingRouting) throw new NotFoundException('Vui lòng định nghĩa quy trình sản phẩm trước khi thêm giá gia công.');

            existingRouting.cost = price;
            // Cập nhật các trường ngày nếu Entity ProductRouting có
            // existingRouting.valid_from = validFrom;
            // existingRouting.valid_to = validTo; 
            return this.routingRepo.save(existingRouting);
        }

        throw new BadRequestException('Invalid itemType');
    }


    async checkPrice(supplierId: number, processId: number) { return { price: 0 }; }

    // --- MỚI: LẤY LỊCH SỬ GIAO DỊCH (CHI TIỀN) CỦA NCC ---
    async getTransactions(supplierId: number) {
        // Vì Transaction import Supplier, nên SupplierService không thể import TransactionService/Repo trực tiếp dễ dàng (cyclic).
        // Tuy nhiên, ta có thể dùng QueryBuilder hoặc inject forwardRef nếu cần.
        // Ở đây đơn giản nhất là dùng Relation 'transactions' đã định nghĩa ở Entity Supplier.

        const supplier = await this.supplierRepo.findOne({
            where: { id: supplierId },
            relations: ['transactions', 'transactions.category'],
            order: { transactions: { date: 'DESC', created_at: 'DESC' } } as any
        });

        if (!supplier) throw new NotFoundException('Supplier not found');
        return supplier.transactions || [];
    }
}