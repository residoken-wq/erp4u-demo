import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SalesOrder, SalesOrderStatus } from '../sales/sales-order.entity';
import { InventoryStock } from '../inventory/inventory-stock.entity';
import { ProductionFulfillmentOrder } from '../planning/pfo.entity';
import { Customer } from '../customers/customer.entity';
import { Product } from '../products/product.entity';
import { Material } from '../materials/material.entity';

@Injectable()
export class AgentApiService {
    constructor(
        @InjectRepository(SalesOrder) private orderRepo: Repository<SalesOrder>,
        @InjectRepository(InventoryStock) private stockRepo: Repository<InventoryStock>,
        @InjectRepository(ProductionFulfillmentOrder) private planRepo: Repository<ProductionFulfillmentOrder>,
        @InjectRepository(Customer) private customerRepo: Repository<Customer>,
        @InjectRepository(Product) private productRepo: Repository<Product>,
        @InjectRepository(Material) private materialRepo: Repository<Material>,
    ) {}

    // --- HELPER: MAP ORDER STATUS ---
    private mapOrderStatus(systemStatus: string): string {
        switch (systemStatus) {
            case SalesOrderStatus.QUOTATION:
            case SalesOrderStatus.SO_PENDING:
            case SalesOrderStatus.SAMPLE_APPROVED:
                return 'pending';
            case SalesOrderStatus.DEPOSITED:
            case SalesOrderStatus.IN_PRODUCTION:
                return 'processing';
            case SalesOrderStatus.PLANNED:
            case SalesOrderStatus.PARTIAL_DELIVERY:
                return 'ready';
            case SalesOrderStatus.DELIVERED:
            case SalesOrderStatus.COMPLETED:
                return 'delivered';
            case SalesOrderStatus.CANCELLED:
                return 'cancelled';
            default:
                return 'pending';
        }
    }

    // --- ORDERS ---
    async getOrders(filters: any) {
        const qb = this.orderRepo.createQueryBuilder('order')
            .leftJoinAndSelect('order.assigned_to', 'user')
            .leftJoinAndSelect('order.items', 'items');

        if (filters.status) {
            // Support both system status and bot simplified status
            if (['pending', 'processing', 'ready', 'delivered', 'cancelled'].includes(filters.status)) {
                let systemStatuses = [];
                if (filters.status === 'pending') systemStatuses = [SalesOrderStatus.QUOTATION, SalesOrderStatus.SO_PENDING, SalesOrderStatus.SAMPLE_APPROVED];
                if (filters.status === 'processing') systemStatuses = [SalesOrderStatus.DEPOSITED, SalesOrderStatus.IN_PRODUCTION];
                if (filters.status === 'ready') systemStatuses = [SalesOrderStatus.PLANNED, SalesOrderStatus.PARTIAL_DELIVERY];
                if (filters.status === 'delivered') systemStatuses = [SalesOrderStatus.DELIVERED, SalesOrderStatus.COMPLETED];
                if (filters.status === 'cancelled') systemStatuses = [SalesOrderStatus.CANCELLED];
                
                qb.andWhere('order.status IN (:...statuses)', { statuses: systemStatuses });
            } else {
                qb.andWhere('order.status = :status', { status: filters.status });
            }
        }

        if (filters.deadline_from) {
            qb.andWhere('order.delivery_date >= :from', { from: filters.deadline_from });
        }
        if (filters.deadline_to) {
            qb.andWhere('order.delivery_date <= :to', { to: filters.deadline_to });
        }

        const orders = await qb.orderBy('order.created_at', 'DESC').take(100).getMany();

        // Format for bot
        return orders.map(o => ({
            id: o.id,
            order_code: o.order_code,
            customer_id: o.customer_id,
            customer_name: o.customer_name,
            order_date: o.order_date,
            delivery_date: o.delivery_date,
            system_status: o.status,
            status: this.mapOrderStatus(o.status),
            payment_status: o.payment_status,
            total_amount: Number(o.total_amount),
            paid_amount: Number(o.paid_amount),
            assigned_to: o.assigned_to ? o.assigned_to.full_name : null,
            note: o.note,
            items: o.items.map(i => ({
                sku: i.sku,
                quantity: Number(i.quantity),
                unit_price: Number(i.unit_price),
                subtotal: Number(i.subtotal)
            }))
        }));
    }

    async getOrderDetail(id: number) {
        const order = await this.orderRepo.findOne({
            where: { id },
            relations: ['assigned_to', 'items', 'items.product']
        });

        if (!order) throw new NotFoundException('Order not found');

        // Fetch warehouse stock for items
        const skus = order.items.map(i => i.sku);
        const products = await this.productRepo.find({ where: { sku: In(skus) } });
        const productMap = new Map(products.map(p => [p.sku, p]));
        
        const productIds = products.map(p => p.id);
        const stocks = await this.stockRepo.find({ 
            where: { item_type: 'PRODUCT', item_id: In(productIds) } 
        });

        const formattedItems = order.items.map(i => {
            const product = productMap.get(i.sku);
            let totalStock = 0;
            if (product) {
                const itemStocks = stocks.filter(s => s.item_id === product.id);
                totalStock = itemStocks.reduce((sum, s) => sum + Number(s.quantity), 0);
            }

            return {
                sku: i.sku,
                product_name: product ? product.name : '',
                unit: product ? product.unit : '',
                quantity: Number(i.quantity),
                unit_price: Number(i.unit_price),
                subtotal: Number(i.subtotal),
                warehouse_stock: totalStock
            };
        });

        return {
            id: order.id,
            order_code: order.order_code,
            customer_id: order.customer_id,
            customer_name: order.customer_name,
            order_date: order.order_date,
            delivery_date: order.delivery_date,
            system_status: order.status,
            status: this.mapOrderStatus(order.status),
            payment_status: order.payment_status,
            total_amount: Number(order.total_amount),
            paid_amount: Number(order.paid_amount),
            assigned_to: order.assigned_to ? order.assigned_to.full_name : null,
            note: order.note,
            items: formattedItems
        };
    }

    // --- INVENTORY ---
    async getInventory(filters: any) {
        const qb = this.stockRepo.createQueryBuilder('stock');

        if (filters.type) {
            qb.andWhere('stock.item_type = :type', { type: filters.type });
        }

        const stocks = await qb.getMany();

        // Aggregate by item
        const aggregated = new Map<string, any>();
        for (const stock of stocks) {
            const key = `${stock.item_type}_${stock.item_id}`;
            if (!aggregated.has(key)) {
                aggregated.set(key, {
                    item_type: stock.item_type,
                    item_id: stock.item_id,
                    total_stock: 0,
                    by_warehouse: []
                });
            }
            const agg = aggregated.get(key);
            agg.total_stock += Number(stock.quantity);
            agg.by_warehouse.push({
                warehouse_code: stock.warehouse_code,
                quantity: Number(stock.quantity)
            });
        }

        let result = Array.from(aggregated.values());

        // Attach names and codes
        const productIds = result.filter(r => r.item_type === 'PRODUCT').map(r => r.item_id);
        const materialIds = result.filter(r => r.item_type === 'MATERIAL').map(r => r.item_id);

        const [products, materials] = await Promise.all([
            productIds.length > 0 ? this.productRepo.find({ where: { id: In(productIds) }, select: ['id', 'sku', 'name', 'unit'] }) : [],
            materialIds.length > 0 ? this.materialRepo.find({ where: { id: In(materialIds) }, select: ['id', 'code', 'name', 'unit'] }) : []
        ]);

        const productMap = new Map<number, Product>(products.map(p => [p.id, p as Product] as [number, Product]));
        const materialMap = new Map<number, Material>(materials.map(m => [m.id, m as Material] as [number, Material]));

        result = result.map(r => {
            if (r.item_type === 'PRODUCT') {
                const master = productMap.get(r.item_id);
                if (master) {
                    r.item_name = master.name;
                    r.item_code = master.sku;
                    r.unit = master.unit;
                }
            } else {
                const master = materialMap.get(r.item_id);
                if (master) {
                    r.item_name = master.name;
                    r.item_code = master.code;
                    r.unit = master.unit;
                }
            }
            return r;
        });

        if (filters.low_stock === 'true') {
            result = result.filter(r => r.total_stock <= 0); // Need minimum_stock field to do this properly
        }

        // Limit results to 100 to prevent large payloads
        return result.slice(0, 100);
    }

    // --- MRP ---
    async getMrpNeeds(filters: any) {
        const qb = this.planRepo.createQueryBuilder('plan');

        if (filters.pfo_id) {
            qb.andWhere('plan.id = :pfoId', { pfoId: filters.pfo_id });
        }
        if (filters.plan_status) {
            qb.andWhere('plan.status = :status', { status: filters.plan_status });
        }

        const plans = await qb.getMany();
        
        return plans.map(plan => {
            let materials = [];
            if (plan.mrp_data && Array.isArray(plan.mrp_data)) {
                materials = plan.mrp_data.map(m => ({
                    material_id: m.material_id,
                    material_code: m.material_code,
                    material_name: m.material_name,
                    gross_requirement: Number(m.gross_requirement),
                    available_stock: Number(m.available_stock),
                    net_requirement: Number(m.net_requirement),
                    unit: m.unit,
                    wastage_percent: Number(m.wastage_percent || 0),
                    supplier_name: m.supplier_name,
                    status: Number(m.net_requirement) > 0 ? 'shortage' : 'sufficient'
                }));
            }

            return {
                pfo_id: plan.id,
                plan_name: plan.name,
                plan_status: plan.status,
                materials: materials
            };
        });
    }

    // --- CUSTOMERS ---
    async getCustomers(filters: any) {
        const qb = this.customerRepo.createQueryBuilder('customer')
            .leftJoinAndSelect('customer.assigned_to', 'user');

        if (filters.type) {
            qb.andWhere('customer.type = :type', { type: filters.type });
        }
        if (filters.search) {
            qb.andWhere('(customer.name ILIKE :search OR customer.phone ILIKE :search)', { search: `%${filters.search}%` });
        }

        const customers = await qb.orderBy('customer.created_at', 'DESC').take(100).getMany();

        return customers.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            type: c.type,
            phone: c.phone,
            email: c.email,
            address: c.address,
            tax_code: c.tax_code,
            credit_limit: Number(c.credit_limit),
            current_debt: Number(c.current_debt),
            lead_status: c.lead_status,
            lead_source: c.lead_source,
            potential_value: Number(c.potential_value),
            assigned_to_name: c.assigned_to ? c.assigned_to.full_name : null
        }));
    }
}
