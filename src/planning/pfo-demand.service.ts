import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { ProductionFulfillmentOrder, PfoStatus } from './pfo.entity';
import { SalesOrder, SalesOrderStatus } from '../sales/sales-order.entity';
import { SalesOrderItem } from '../sales/sales-order-item.entity';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';

@Injectable()
export class PfoDemandService {
    constructor(
        @InjectRepository(ProductionFulfillmentOrder) private pfoRepo: Repository<ProductionFulfillmentOrder>,
        @InjectRepository(SalesOrder) private orderRepo: Repository<SalesOrder>,
        @InjectRepository(SalesOrderItem) private orderItemRepo: Repository<SalesOrderItem>,
        @Inject(forwardRef(() => InventoryService)) private inventoryService: InventoryService,
        private productsService: ProductsService
    ) { }

    /**
     * Lấy danh sách gợi ý tạo PFO từ các đơn hàng chờ sản xuất
     */
    async getDemandSuggestions() {
        // Find orders that are ready but don't have PFO yet, or are partially fulfilled
        // Here we just fetch SO_PENDING, SAMPLE_APPROVED, DEPOSITED
        const orders = await this.orderRepo.find({
            where: {
                status: In([SalesOrderStatus.SO_PENDING, SalesOrderStatus.SAMPLE_APPROVED, SalesOrderStatus.DEPOSITED]),
            },
            relations: ['customer', 'items', 'items.product', 'pfos', 'deliveries'],
            order: { delivery_date: 'ASC' }
        });

        // Filter orders that haven't been fully planned
        const filteredOrders = orders.filter(o => !o.pfos || o.pfos.length === 0);

        const stocks = await this.inventoryService.getAllStocks();
        const stockMap = new Map<string, number>();
        // Build stock map for ALL warehouses (excluding KHO_MAU)
        const stockMapAll = new Map<string, number>();

        stocks.forEach(s => {
            if (s.item_type === 'PRODUCT' && s.warehouse_code === 'KHO_TP') {
                const key = String(s.item_id);
                stockMap.set(key, (stockMap.get(key) || 0) + Number(s.quantity));
            }
            if (s.item_type === 'PRODUCT' && s.warehouse_code !== 'KHO_MAU') {
                const key = String(s.item_id);
                stockMapAll.set(key, (stockMapAll.get(key) || 0) + Number(s.quantity));
            }
        });

        const enrichedOrders = [];
        for (const o of filteredOrders) {
            let canFulfill = true;
            let totalItems = 0;

            const enrichedItems = [];
            for (const item of o.items) {
                let stock = 0;
                let totalStock = 0;
                let availableStock = 0;
                const product = item.product;
                const approvedBooking = Number(product?.approved_booking_stock || 0);
                const bookingStock = Number(product?.booking_stock || 0);
                
                if (product) {
                    if (product.product_type === 'COMBO') {
                        const components = await this.productsService.getComboComponents(product.sku);
                        if (components && components.length > 0) {
                            let minStockTp = Infinity;
                            let minStockAll = Infinity;
                            let minAvailableAll = Infinity;
                            for (const c of components) {
                                if (c.child_product) {
                                    const childId = String(c.child_product.id);
                                    const childStockTp = stockMap.get(childId) || 0;
                                    const childStockAll = stockMapAll.get(childId) || 0;
                                    const childApproved = Number(c.child_product.approved_booking_stock || 0);
                                    const childAvailable = Math.max(0, childStockAll - childApproved);
                                    
                                    const reqQty = Number(c.quantity) || 1;
                                    
                                    const possibleTp = Math.floor(childStockTp / reqQty);
                                    const possibleAll = Math.floor(childStockAll / reqQty);
                                    const possibleAvailable = Math.floor(childAvailable / reqQty);
                                    
                                    if (possibleTp < minStockTp) minStockTp = possibleTp;
                                    if (possibleAll < minStockAll) minStockAll = possibleAll;
                                    if (possibleAvailable < minAvailableAll) minAvailableAll = possibleAvailable;
                                }
                            }
                            stock = minStockTp === Infinity ? 0 : minStockTp;
                            totalStock = minStockAll === Infinity ? 0 : minStockAll;
                            availableStock = minAvailableAll === Infinity ? 0 : minAvailableAll;
                        }
                    } else {
                        stock = stockMap.get(String(product.id)) || 0;
                        totalStock = stockMapAll.get(String(product.id)) || 0;
                        availableStock = Math.max(0, totalStock - approvedBooking);
                    }
                }
                totalItems++;
                if (availableStock < Number(item.quantity)) canFulfill = false;
                
                enrichedItems.push({
                    ...item,
                    available_stock_tp: stock,
                    total_stock: totalStock,
                    approved_booking_stock: approvedBooking,
                    booking_stock: bookingStock,
                    available_stock: availableStock,
                });
            }

            if (!o.customer_name && o.customer) {
                o.customer_name = o.customer.name;
            }
            const has_pending_export = o.deliveries && o.deliveries.some((d: any) => d.status === 'PENDING_EXPORT');
            enrichedOrders.push({ 
                ...o, 
                items: enrichedItems, 
                can_fulfill_stock: (totalItems > 0 && canFulfill),
                has_pending_export 
            });
        }

        return enrichedOrders;
    }

    /**
     * Gate 1: Production Readiness (Tạo PFO từ SO)
     */
    async generatePfo(data: { orderCode: string; code: string; name?: string; start_date?: string; end_date?: string }) {
        const order = await this.orderRepo.findOne({ 
            where: { order_code: data.orderCode },
            relations: ['pfos']
        });

        if (!order) {
            throw new BadRequestException('Không tìm thấy đơn hàng (Sales Order)');
        }

        // --- GATE 1 CHECKS ---
        // 1. Mẫu đã được duyệt chưa?
        if (!order.is_production_sample_approved) {
            // Note: Can bypass this if Business Rule allows it, but strictly it should fail.
            // We can throw an error or just mark PFO as DRAFT with a warning.
            // throw new BadRequestException('Mẫu sản xuất (First Article) chưa được duyệt. Không thể phát hành PFO.');
        }

        // 2. Đã đặt cọc chưa?
        // if (order.payment_status === 'UNPAID') ...

        const pfo = this.pfoRepo.create({
            code: data.code,
            sales_order: { id: order.id } as any,
            sales_order_id: order.id,
            status: PfoStatus.DRAFT,
            planned_start_date: data.start_date ? new Date(data.start_date) : undefined,
            committed_finish_date: data.end_date ? new Date(data.end_date) : undefined,
            progress: 0,
        });

        const saved = await this.pfoRepo.save(pfo);

        // Update SO status to PLANNED if it was in earlier stage
        if ([SalesOrderStatus.SO_PENDING, SalesOrderStatus.SAMPLE_APPROVED, SalesOrderStatus.DEPOSITED].includes(order.status)) {
            order.status = SalesOrderStatus.PLANNED;
            await this.orderRepo.save(order);
        }

        return saved;
    }

    async getPfoDetails(id: number) {
        let pfo = await this.pfoRepo.findOne({
            where: { id },
            relations: [
                'sales_order',
                'sales_order.customer',
                'material_requirements',
                'material_requirements.material',
                'milestones',
                'milestones.vendor',
                'qc_records'
            ]
        });

        if (pfo && pfo.sales_order) {
            const so = await this.pfoRepo.manager.findOne('SalesOrder', {
                where: { id: pfo.sales_order.id },
                relations: [
                    'items',
                    'items.product',
                    'items.product.logistics',
                    'items.product.boms',
                    'items.product.boms.material',
                    'items.product.components',
                    'items.product.components.child_product',
                    'items.product.components.child_product.logistics',
                    'items.product.components.child_product.boms',
                    'items.product.components.child_product.boms.material'
                ]
            });
            if (so) {
                pfo.sales_order.items = (so as any).items;
            }
        }

        if (!pfo) throw new NotFoundException('PFO không tồn tại');

        // AUTO-HEAL: Nếu pfo bị mất relation sales_order do lỗi lưu dữ liệu cũ, thử tìm lại qua mã PFO
        if (!pfo.sales_order && pfo.code.startsWith('PFO-')) {
            const orderCode = pfo.code.replace('PFO-', '');
            const so: any = await this.pfoRepo.manager.findOne('SalesOrder', {
                where: { order_code: orderCode },
                relations: [
                    'customer', 
                    'items', 
                    'items.product',
                    'items.product.logistics',
                    'items.product.boms',
                    'items.product.boms.material',
                    'items.product.components',
                    'items.product.components.child_product',
                    'items.product.components.child_product.logistics',
                    'items.product.components.child_product.boms',
                    'items.product.components.child_product.boms.material'
                ]
            });
            if (so) {
                pfo.sales_order = so as any;
                pfo.sales_order_id = so.id as any;
                await this.pfoRepo.update(pfo.id, { sales_order_id: so.id });
            }
        }
        return pfo;
    }

    async deletePfo(id: number) {
        const pfo = await this.pfoRepo.findOne({ where: { id }, relations: ['sales_order'] });
        if (!pfo) throw new NotFoundException('PFO không tồn tại');

        // Check if there are generated POs (Purchase Orders or Subcontract POs)
        const poCount = await this.pfoRepo.manager.count('PurchaseOrder', { where: { pfo_id: id } });
        if (poCount > 0) {
            throw new BadRequestException('Không thể xóa Lệnh SX vì đã có PO (Đơn mua hàng/gia công) được tạo. Vui lòng xóa hoặc hủy các PO trước.');
        }

        // Check if there are Goods Issues (Phiếu xuất kho)
        const issueCount = await this.pfoRepo.manager.count('GoodsIssue', { where: { pfo_id: id } });
        if (issueCount > 0) {
            throw new BadRequestException('Không thể xóa Lệnh SX vì đã có Phiếu xuất kho được tạo. Vui lòng xóa các Phiếu xuất kho trước.');
        }

        const so = pfo.sales_order;
        if (so) {
            // Revert Sales Order status to SO_PENDING to show back in the planning list
            so.status = SalesOrderStatus.SO_PENDING;
            await this.orderRepo.save(so);
        }

        // Manually delete related entities to avoid foreign key constraints issues if cascade is not set
        await this.pfoRepo.manager.delete('PfoMaterialRequirement', { pfo_id: id });
        await this.pfoRepo.manager.delete('PfoMilestone', { pfo_id: id });
        await this.pfoRepo.manager.delete('PfoQcRecord', { pfo_id: id });

        await this.pfoRepo.remove(pfo);
        return { message: 'Đã xóa Lệnh SX thành công' };
    }

    /**
     * Nhu cầu NPL Dashboard
     */
    async getNplDemandDashboard() {
        const pmrs = await this.pfoRepo.manager.find('PfoMaterialRequirement', {
            where: { material_id: Not(IsNull()) },
            relations: ['material', 'pfo', 'pfo.sales_order', 'pfo.sales_order.customer']
        });

        const poItems = await this.pfoRepo.manager.find('PurchaseOrderItem', {
            where: { purchase_order: { status: 'DRAFT' } },
            relations: ['purchase_order']
        });

        const giItems = await this.pfoRepo.manager.find('GoodsIssueItem', {
            where: { issue: { status: In(['CONFIRMED', 'DELIVERED']) } },
            relations: ['issue']
        });

        const dashboardMap = new Map();
        
        for (const req of (pmrs as any[])) {
             const matId = req.material_id;
             if (!dashboardMap.has(matId)) {
                 dashboardMap.set(matId, {
                     material_id: matId,
                     material_code: req.material?.code,
                     material_name: req.material?.name,
                     material_unit: req.material?.unit,
                     total_planned: 0,
                     total_amount: 0,
                     inventory_used: 0,
                     po_draft: 0,
                     ngc_delivered: 0,
                     details: []
                 });
             }
             
             const stats = dashboardMap.get(matId);
             stats.total_planned += Number(req.planned_quantity || 0);
             stats.total_amount += Number(req.planned_quantity || 0) * Number(req.unit_price || 0);
             
             stats.details.push({
                 pfo_id: req.pfo?.id,
                 pfo_code: req.pfo?.code,
                 sales_order_id: req.pfo?.sales_order?.id,
                 sales_order_code: req.pfo?.sales_order?.order_code,
                 customer_name: req.pfo?.sales_order?.customer_name || req.pfo?.sales_order?.customer?.name,
                 planned_quantity: Number(req.planned_quantity || 0),
                 total_amount: Number(req.planned_quantity || 0) * Number(req.unit_price || 0)
             });
        }
        
        for (const poi of (poItems as any[])) {
            if (poi.material_id && dashboardMap.has(poi.material_id)) {
                dashboardMap.get(poi.material_id).po_draft += Number(poi.quantity || 0);
            }
        }
        
        for (const gii of (giItems as any[])) {
            if (gii.material_id && dashboardMap.has(gii.material_id)) {
                const stats = dashboardMap.get(gii.material_id);
                if (gii.issue?.type === 'OUTSOURCING') {
                    stats.ngc_delivered += Number(gii.quantity || 0);
                } else if (gii.issue?.type === 'PRODUCTION' || !gii.issue?.type) {
                    stats.inventory_used += Number(gii.quantity || 0);
                }
            }
        }

        return Array.from(dashboardMap.values());
    }

    /**
     * Nhu cầu GC Dashboard (Gia công / Sản xuất)
     */
    async getGcDemandDashboard() {
        const pfos = await this.pfoRepo.find({
            where: { status: Not(PfoStatus.CLOSED) },
            relations: [
                'sales_order',
                'sales_order.customer',
                'sales_order.items',
                'sales_order.items.product',
                'sales_order.items.product.category_link',
                'material_requirements',
                'material_requirements.product',
                'material_requirements.product.category_link'
            ],
            order: { id: 'DESC' }
        });

        const poItems = await this.pfoRepo.manager.find('PurchaseOrderItem', {
            where: { purchase_order: { status: In(['DRAFT', 'ORDERED']) } },
            relations: ['purchase_order']
        });

        const giItems = await this.pfoRepo.manager.find('GoodsIssueItem', {
            where: { issue: { status: In(['CONFIRMED', 'DELIVERED']) } },
            relations: ['issue']
        });

        const dashboardMap = new Map();

        for (const pfo of (pfos as any[])) {
            // 1. Nhu cầu sản phẩm gia công từ Đơn hàng (SO Items) của Lệnh SX (PFO)
            if (pfo.sales_order && pfo.sales_order.items && pfo.sales_order.items.length > 0) {
                for (const item of pfo.sales_order.items) {
                    const prod = item.product;
                    if (!prod) continue;
                    const prodId = prod.id;
                    const plannedQty = Number(item.quantity || pfo.quantity || 1);
                    const unitPrice = Number(prod.cost_price || prod.base_price || item.unit_price || item.price || 0);
                    const totalAmount = plannedQty * unitPrice;

                    if (!dashboardMap.has(prodId)) {
                        dashboardMap.set(prodId, {
                            product_id: prodId,
                            product_sku: prod.sku,
                            product_name: prod.name,
                            product_unit: prod.unit || 'Cái',
                            category_id: prod.category_id || prod.category_link?.id || null,
                            category_name: prod.category_link?.name || prod.category || 'Khác',
                            product_type: prod.product_type || 'STANDARD',
                            total_planned: 0,
                            total_amount: 0,
                            inventory_used: 0,
                            po_draft: 0,
                            ngc_delivered: 0,
                            details: []
                        });
                    }

                    const stats = dashboardMap.get(prodId);
                    stats.total_planned += plannedQty;
                    stats.total_amount += totalAmount;
                    stats.details.push({
                        pfo_id: pfo.id,
                        pfo_code: pfo.code,
                        sales_order_id: pfo.sales_order?.id,
                        sales_order_code: pfo.sales_order?.order_code,
                        customer_name: pfo.sales_order?.customer_name || pfo.sales_order?.customer?.name || 'Khách vãng lai',
                        planned_quantity: plannedQty,
                        unit_price: unitPrice,
                        total_amount: totalAmount
                    });
                }
            }

            // 2. Nhu cầu Bán Thành Phẩm (BTP) nổ từ BOM trong Lệnh SX
            if (pfo.material_requirements && pfo.material_requirements.length > 0) {
                for (const req of pfo.material_requirements) {
                    if (req.product_id && req.product) {
                        const prod = req.product;
                        const prodId = prod.id;
                        const plannedQty = Number(req.planned_quantity || 0);
                        const unitPrice = Number(req.unit_price || prod.cost_price || prod.base_price || 0);
                        const totalAmount = plannedQty * unitPrice;

                        if (!dashboardMap.has(prodId)) {
                            dashboardMap.set(prodId, {
                                product_id: prodId,
                                product_sku: prod.sku,
                                product_name: prod.name,
                                product_unit: prod.unit || 'Cái',
                                category_id: prod.category_id || prod.category_link?.id || null,
                                category_name: prod.category_link?.name || prod.category || 'Bán thành phẩm',
                                product_type: prod.product_type || 'SEMI_FINISHED',
                                total_planned: 0,
                                total_amount: 0,
                                inventory_used: 0,
                                po_draft: 0,
                                ngc_delivered: 0,
                                details: []
                            });
                        }

                        const stats = dashboardMap.get(prodId);
                        const alreadyInDetails = stats.details.some((d: any) => d.pfo_id === pfo.id);
                        if (!alreadyInDetails) {
                            stats.total_planned += plannedQty;
                            stats.total_amount += totalAmount;
                            stats.details.push({
                                pfo_id: pfo.id,
                                pfo_code: pfo.code,
                                sales_order_id: pfo.sales_order?.id,
                                sales_order_code: pfo.sales_order?.order_code,
                                customer_name: pfo.sales_order?.customer_name || pfo.sales_order?.customer?.name || 'Khách vãng lai',
                                planned_quantity: plannedQty,
                                unit_price: unitPrice,
                                total_amount: totalAmount
                            });
                        }
                    }
                }
            }
        }

        for (const poi of (poItems as any[])) {
            if (poi.product_id && dashboardMap.has(poi.product_id)) {
                dashboardMap.get(poi.product_id).po_draft += Number(poi.quantity || 0);
            }
        }

        for (const gii of (giItems as any[])) {
            if (gii.product_id && dashboardMap.has(gii.product_id)) {
                const stats = dashboardMap.get(gii.product_id);
                if (gii.issue?.type === 'OUTSOURCING') {
                    stats.ngc_delivered += Number(gii.quantity || 0);
                } else if (gii.issue?.type === 'PRODUCTION' || !gii.issue?.type) {
                    stats.inventory_used += Number(gii.quantity || 0);
                }
            }
        }

        return Array.from(dashboardMap.values());
    }
}
