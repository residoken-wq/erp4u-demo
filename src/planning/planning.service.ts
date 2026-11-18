import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull } from 'typeorm';
import { ProductionFulfillmentOrder, PfoStatus } from './pfo.entity';
import { SalesOrder, SalesOrderStatus } from '../sales/sales-order.entity';
import { SalesOrderItem, BookingStatus } from '../sales/sales-order-item.entity';
import { ProductsService } from '../products/products.service';
import { MaterialsService } from '../materials/materials.service';
import { PurchaseOrder, POType, POStatus } from '../purchasing/entities/purchase-order.entity';
import { PurchaseOrderItem } from '../purchasing/entities/purchase-order-item.entity';
import { InventoryService } from '../inventory/inventory.service';
// import { MrpCalculationService } from './mrp-calculation.service';
import { GanttService } from './gantt.service';
import { WorkOrder, WorkOrderStatus } from '../production/work-order.entity';

import { PfoQcRecord } from './pfo-qc-record.entity';

@Injectable()
export class PlanningService {
    constructor(
        @InjectRepository(ProductionFulfillmentOrder) private planRepo: Repository<ProductionFulfillmentOrder>,
        @InjectRepository(PfoQcRecord) private historyRepo: Repository<PfoQcRecord>,
        @InjectRepository(SalesOrder) private orderRepo: Repository<SalesOrder>,
        @InjectRepository(SalesOrderItem) private orderItemRepo: Repository<SalesOrderItem>,
        @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
        @InjectRepository(PurchaseOrderItem) private poItemRepo: Repository<PurchaseOrderItem>,
        @InjectRepository(WorkOrder) private woRepo: Repository<WorkOrder>,
        private productsService: ProductsService,
        private materialsService: MaterialsService,
        @Inject(forwardRef(() => InventoryService)) private inventoryService: InventoryService,
        private ganttService: GanttService,
    ) { }

    async getSuggestion() {
        const orders = await this.orderRepo.find({
            where: {
                status: In([SalesOrderStatus.SO_PENDING, SalesOrderStatus.SAMPLE_APPROVED, SalesOrderStatus.DEPOSITED]),
                pfo_id: IsNull()
            },
            relations: ['customer', 'items', 'items.product', 'deliveries'],
            order: { delivery_date: 'ASC' }
        });

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
        for (const o of orders) {
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

    async createPlan(data: any) {
        const orders = await this.orderRepo.find({ where: { order_code: In(data.orderCodes) } });
        if (!orders.length) throw new BadRequestException('Không tìm thấy đơn hàng');

        const plan = this.planRepo.create({
            code: data.code, name: data.name, start_date: data.start_date, end_date: data.end_date, status: PfoStatus.DRAFT
        });
        const saved = await this.planRepo.save(plan);
        await this.orderRepo.update({ id: In(orders.map(o => o.id)) }, { status: SalesOrderStatus.PLANNED as any });
        return saved;
    }

    async findOne(id: number) {
        return this.planRepo.findOne({
            where: { id },
            relations: [
                'sales_order',
                'sales_order.items',
                'sales_order.items.product',
                'sales_order.items.product.components',
                'sales_order.items.product.components.child_product',
                'sales_order.items.product.components.child_product.boms',
                'sales_order.items.product.components.child_product.boms.material',
                'sales_order.items.product.boms',
                'sales_order.items.product.boms.material'
            ]
        });
    }

    // --- Delegate to MrpCalculationService ---
    async calculateMaterialNeeds(planId: number, force: boolean = false) {
        // return this.mrpCalculationService.calculateMaterialNeeds(planId, force);
        throw new Error("Obsolete method");
    }

    async saveAnalysis(id: number, mrpData: any, outsourcingData: any, logisticsData: any) {
        const plan = await this.planRepo.findOneBy({ id });
        if (!plan) throw new NotFoundException();

        // 1. Tạo bản ghi history trước khi lưu
        const lastVersion = await this.historyRepo.findOne({
            where: { pfo_id: id },
            order: { version: 'DESC' }
        });
        const currentVersion = lastVersion ? lastVersion.version + 1 : 1;
        
        const history = this.historyRepo.create({
            pfo_id: id,
            version: currentVersion,
            changes_summary: { type: 'MRP_SAVE', description: 'Lưu kết quả MRP / Phân bổ thủ công' },
            snapshot_data: {
                mrp_data: mrpData,
                outsourcing_data: outsourcingData,
                logistics_data: logisticsData,
                gantt_config: plan.gantt_config
            },
            created_by: 'User' // Ideally from req.user
        });
        await this.historyRepo.save(history);

        // 2. Cập nhật Kế hoạch
        plan.mrp_data = mrpData;
        plan.outsourcing_data = outsourcingData;
        if (logisticsData) plan.logistics_data = logisticsData;
        await this.planRepo.save(plan);

        // 3. Cập nhật tồn kho (reserved stock)
        if (Array.isArray(mrpData)) {
            const materialIds = mrpData.map(item => item.material_id).filter(Boolean);
            if (materialIds.length > 0) {
                await this.updateMaterialReservedStock(materialIds);
            }
        }

        return { message: 'Đã lưu kết quả phân tích', version: currentVersion };
    }

    async updateMaterialReservedStock(materialIds: number[]) {
        if (!materialIds.length) return;
        const activePlans = await this.planRepo.find({
            where: { status: In([PfoStatus.DRAFT, PfoStatus.DRAFT, PfoStatus.MATERIAL_PREP, PfoStatus.WAITING_VENDOR, PfoStatus.IN_PRODUCTION]) }
        });
        
        const reservedMap = new Map<number, number>();
        materialIds.forEach(id => reservedMap.set(id, 0));

        for (const p of activePlans) {
            if (Array.isArray(p.mrp_data)) {
                for (const item of p.mrp_data) {
                    if (item.material_id && materialIds.includes(item.material_id)) {
                        const useStock = item.use_stock !== false;
                        if (useStock) {
                            const gross = Number(item.gross_requirement) || 0;
                            const net = Number(item.net_requirement) || 0;
                            const reserved = Math.max(0, gross - net);
                            const actualReserved = Math.min(reserved, Number(item.available_stock || 0));
                            reservedMap.set(item.material_id, (reservedMap.get(item.material_id) || 0) + actualReserved);
                        }
                    }
                }
            }
        }

        for (const [matId, reserved] of reservedMap.entries()) {
            await this.materialsService.materialRepo.update(matId, { reserved_stock: reserved });
        }
    }

    async requestAdditionalMaterial(planId: number, data: { material_id: number; requested_qty: number; note?: string }) {
        const plan = await this.planRepo.findOne({ where: { id: planId } });
        if (!plan) throw new NotFoundException('Lệnh SX không tồn tại');

        let mrpData: any[] = [];
        if (typeof plan.mrp_data === 'string') {
            try { mrpData = JSON.parse(plan.mrp_data); } catch (e) { }
        } else if (Array.isArray(plan.mrp_data)) {
            mrpData = plan.mrp_data;
        }

        const existingItem = mrpData.find(m => Number(m.material_id) === Number(data.material_id));
        if (existingItem) {
            // Tăng net_requirement để đẩy sang PO
            existingItem.net_requirement = Number(existingItem.net_requirement || 0) + Number(data.requested_qty);
            existingItem.gross_requirement = Number(existingItem.gross_requirement || 0) + Number(data.requested_qty);
            if (data.note) {
                existingItem.note = (existingItem.note ? existingItem.note + ' | ' : '') + `Bổ sung: ${data.requested_qty} - ${data.note}`;
            }
        } else {
            throw new BadRequestException('NPL này không nằm trong định mức, không thể bổ sung theo cách này.');
        }

        plan.mrp_data = mrpData;
        await this.planRepo.save(plan);
        return { message: 'Đã cập nhật yêu cầu bổ sung NPL vào Lệnh SX', mrp_data: mrpData };
    }

    async invalidateAnalysisCache(planId: number) {
        await this.planRepo.update(planId, {
            mrp_data: null,
            outsourcing_data: null,
            logistics_data: null
        });
    }

    // --- HÀM TẠO PO (Dùng chung cho NPL và Gia Công) ---
    async generatePos(planId: number, data: any[]) {
        const supplierGroups = {};

        for (const item of data) {
            const qty = item.net_requirement !== undefined ? item.net_requirement : item.quantity;
            if (qty > 0) {
                const suppName = item.supplier_name || 'Unknown';
                if (!supplierGroups[suppName]) supplierGroups[suppName] = [];
                supplierGroups[suppName].push({ ...item, qtyToBuy: qty });
            }
        }

        const createdPos = [];
        for (const [suppName, items] of Object.entries(supplierGroups)) {
            if (!items || (items as any[]).length === 0) continue;
            const isMaterial = (items as any)[0].material_id !== undefined;

            const po = this.poRepo.create({
                po_code: `PO-${isMaterial ? 'NPL' : 'GC'}-${planId}-${Math.floor(Math.random() * 1000)}`,
                type: isMaterial ? POType.MATERIAL : 'OUTSOURCING' as any,
                pfo_id: planId,
                status: POStatus.DRAFT,
                note: `Tự động từ Kế hoạch ${planId}. NCC: ${suppName}`
            });

            await this.poRepo.save(po);

            const poItems = (items as any[]).map(i => {
                const price = isMaterial ? (i.reference_price || 0) : (i.unit_price || 0);
                const sub = i.qtyToBuy * price;
                const desc = isMaterial ? i.material_name : `${i.step_name} (${i.product_sku})`;

                const poItem = this.poItemRepo.create({
                    purchase_order: po,
                    description: desc,
                    quantity: i.qtyToBuy,
                    unit_price: price,
                    subtotal: sub,
                    pfo_id: planId,
                    material_id: isMaterial ? i.material_id : null,
                    product_id: !isMaterial ? i.product_id : null,
                    raw_quantity: i.gross_raw || 0,
                    wastage_rate: i.wastage_percent || 0,
                    total_quantity: i.gross_requirement || 0
                });

                if (isMaterial) poItem.material_id = i.material_id;
                return poItem;
            });

            await this.poItemRepo.save(poItems);

            const totalAmount = poItems.reduce((acc, item) => acc + item.subtotal, 0);
            po.total_amount = totalAmount;
            await this.poRepo.save(po);
            createdPos.push(po.po_code);
        }

        if (createdPos.length > 0) {
            const plan = await this.planRepo.findOne({ where: { id: planId } });
            if (plan) {
                const hasOutsourcing = createdPos.some(c => c.includes('PO-GC'));
                const hasMaterial = createdPos.some(c => c.includes('PO-NPL'));
                if (hasOutsourcing && plan.status !== PfoStatus.WAITING_VENDOR) {
                    plan.status = PfoStatus.WAITING_VENDOR;
                } else if (hasMaterial && plan.status !== PfoStatus.WAITING_VENDOR && plan.status !== PfoStatus.MATERIAL_PREP) {
                    plan.status = PfoStatus.MATERIAL_PREP;
                }
                await this.planRepo.save(plan);
            }
        }

        return { message: `Đã tạo ${createdPos.length} Đơn đặt hàng`, pos: createdPos };
    }

    async findAll() { 
        const pfos = await this.planRepo.find({ 
            order: { id: 'DESC' }, 
            relations: ['sales_order', 'sales_order.customer', 'milestones', 'material_requirements'] 
        }); 

        return pfos.map(pfo => {
            if (!pfo.vendor_name && pfo.milestones && pfo.milestones.length > 0) {
                const vendorNames = Array.from(new Set(pfo.milestones.map(m => m.vendor_name).filter(Boolean)));
                if (vendorNames.length > 0) {
                    pfo.vendor_name = vendorNames.join(', ');
                }
            }
            return pfo;
        });
    }

    async deletePlan(id: number) {
        const plan = await this.planRepo.findOne({ where: { id }, relations: ['sales_order'] });
        if (!plan) throw new NotFoundException('Kế hoạch không tồn tại');

        const existingPos = await this.poRepo.count({ where: { pfo_id: id } });
        if (existingPos > 0) {
            throw new BadRequestException('Không thể xóa kế hoạch đã tạo Đơn mua hàng (PO)');
        }

        if (plan.sales_order) {
            await this.orderRepo.update({ pfos: { id } }, { pfos: null });
        }

        await this.planRepo.remove(plan);
        return { message: 'Đã xóa kế hoạch sản xuất' };
    }

    // --- Delegate to MrpCalculationService ---
    async syncPoPrices(planId: number) {
        // return this.mrpCalculationService.syncPoPrices(planId);
        throw new Error("Obsolete method");
    }

    // --- Delegate to GanttService ---
    async getGanttData() {
        return this.ganttService.getGanttData();
    }

    async saveGanttConfig(planId: number, config: any) {
        return this.ganttService.saveGanttConfig(planId, config);
    }

    // =============================================
    // --- MỚI: PLAN LIFECYCLE MANAGEMENT ---
    // =============================================

    // Cập nhật status plan thủ công
    async updatePfoStatus(planId: number, status: string) {
        const plan = await this.planRepo.findOne({ 
            where: { id: planId },
            relations: ['sales_order', 'sales_order.customer', 'milestones', 'material_requirements']
        });
        if (!plan) throw new NotFoundException('Kế hoạch không tồn tại');

        plan.status = status as PfoStatus;
        return this.planRepo.save(plan);
    }

    async updatePfoQuantity(id: number, quantity: number) {
        const pfo = await this.planRepo.findOne({ where: { id } });
        if (!pfo) throw new NotFoundException('PFO không tồn tại');
        
        pfo.quantity = quantity;
        await this.planRepo.save(pfo);

        return { message: 'Cập nhật số lượng KHSX thành công', pfo };
    }

    async updatePfoCustomQuantities(id: number, customQuantities: Record<string, number>) {
        const pfo = await this.planRepo.findOne({ where: { id } });
        if (!pfo) throw new NotFoundException('PFO không tồn tại');
        
        pfo.custom_quantities = { ...pfo.custom_quantities, ...customQuantities };
        await this.planRepo.save(pfo);

        return { message: 'Cập nhật số lượng KHSX thành công', pfo };
    }

    // Auto-detect plan status từ PO statuses
    async checkAndUpdatePfoStatus(planId: number) {
        try {
            const plan = await this.planRepo.findOne({ where: { id: planId } });
            if (!plan) return;

            // Lấy tất cả PO thuộc plan này
            const pos = await this.poRepo.find({ where: { pfo_id: planId } });
            if (pos.length === 0) return;

            const allPosDelivered = pos.every(
                po => ['DELIVERED', 'COMPLETED'].includes(po.status)
            );
            const anyPoOrdered = pos.some(
                po => ['ORDERED', 'PARTIAL_DELIVERED', 'DELIVERED', 'COMPLETED', 'CONFIRMED'].includes(po.status)
            );

            // Auto-transition logic
            if (allPosDelivered && plan.status !== PfoStatus.READY_TO_SHIP) {
                // Tất cả PO đã giao đủ → Có thể chuyển Plan sang READY_TO_SHIP
                // Nhưng cần kiểm tra thêm ProductionOrder nếu có
                plan.status = PfoStatus.READY_TO_SHIP;
                await this.planRepo.save(plan);
            } else if (anyPoOrdered && plan.status === PfoStatus.DRAFT) {
                // Có ít nhất 1 PO đã order → Plan chuyển sang IN_PRODUCTION
                plan.status = PfoStatus.IN_PRODUCTION;
                await this.planRepo.save(plan);
            }
        } catch (e) {
            console.error('Auto-update plan status failed:', e);
        }
    }

    async confirmBookings(planId: number, itemIds?: number[]) {
        const plan = await this.planRepo.findOne({
            where: { id: planId },
            relations: ['sales_order', 'sales_order.items', 'sales_order.items.product']
        });
        if (!plan) throw new NotFoundException('Kế hoạch không tồn tại');

        // Fetch real stock for partial booking calculation
        const allStocks = await this.inventoryService.getAllStocks();
        const stockMap = new Map<number, number>();
        for (const s of allStocks) {
            if (s.item_type === 'PRODUCT' && s.warehouse_code !== 'KHO_MAU') {
                const key = Number(s.item_id);
                stockMap.set(key, (stockMap.get(key) || 0) + Number(s.quantity));
            }
        }

        let confirmedCount = 0;
        for (const order of (plan.sales_order ? [plan.sales_order] : [])) {
            for (const item of order.items) {
                if ((item as any).booking_status === 'TEMPORARY') {
                    // Nếu có truyền itemIds thì kiểm tra xem item.id có trong mảng không
                    if (!itemIds || itemIds.includes(item.id)) {
                        
                        // --- MỚI: Tính toán số lượng có thể book một phần ---
                        const product = item.product;
                        let actualBookedQty = 0;
                        const requestedQty = Number(item.quantity);

                        if (product) {
                            let availableStock = 0;
                            if (product.product_type === 'COMBO') {
                                const components = await this.productsService.getComboComponents(product.sku);
                                let minAvailable = Infinity;
                                for (const c of components) {
                                    if (c.child_product) {
                                        const childStock = stockMap.get(c.child_product.id) || 0;
                                        const childApproved = Number(c.child_product.approved_booking_stock || 0);
                                        const childAvailable = Math.max(0, childStock - childApproved);
                                        const possible = Math.floor(childAvailable / Number(c.quantity));
                                        if (possible < minAvailable) minAvailable = possible;
                                    }
                                }
                                availableStock = minAvailable === Infinity ? 0 : minAvailable;
                            } else {
                                const realStock = stockMap.get(product.id) || 0;
                                const approvedBooking = Number(product.approved_booking_stock || 0);
                                availableStock = Math.max(0, realStock - approvedBooking);
                            }

                            // Book số lượng nhỏ hơn hoặc bằng tồn kho khả dụng
                            actualBookedQty = Math.min(requestedQty, availableStock);

                            if (product.product_type === 'COMBO') {
                                const components = await this.productsService.getComboComponents(product.sku);
                                for (const comp of components) {
                                    if (comp.child_product) {
                                        const approvedQty = actualBookedQty * Number(comp.quantity);
                                        comp.child_product.approved_booking_stock = Number(comp.child_product.approved_booking_stock || 0) + approvedQty;
                                        await this.productsService.update(comp.child_product.id, { approved_booking_stock: comp.child_product.approved_booking_stock } as any);
                                        // Update memory stock for next item
                                        const curStock = stockMap.get(comp.child_product.id) || 0;
                                        stockMap.set(comp.child_product.id, curStock - approvedQty);
                                    }
                                }
                            } else {
                                product.approved_booking_stock = Number(product.approved_booking_stock || 0) + actualBookedQty;
                                await this.productsService.update(product.id, { approved_booking_stock: product.approved_booking_stock } as any);
                                // Update memory stock for next item
                                const curStock = stockMap.get(product.id) || 0;
                                stockMap.set(product.id, curStock - actualBookedQty);
                            }
                        }

                        await this.orderItemRepo.manager.update('SalesOrderItem', item.id, {
                            booking_status: 'CONFIRMED',
                            booking_expires_at: null,
                            booked_quantity: actualBookedQty // Lưu số lượng thực tế book được
                        });

                        confirmedCount++;
                    }
                }
            }
        }

        if (confirmedCount > 0) {
            await this.invalidateAnalysisCache(planId);
        }

        return { message: `Đã xác nhận ${confirmedCount} mục giữ chỗ.` };
    }

    // --- Lấy booking items kèm thông tin tồn kho cho BookingApprovalModal ---
    async getBookingItemsWithStock(planId: number) {
        const plan = await this.planRepo.findOne({
            where: { id: planId },
            relations: [
                'sales_order', 'sales_order.items', 'sales_order.items.product',
                'sales_order.items.product.components', 'sales_order.items.product.components.child_product',
                'sales_order.customer'
            ]
        });
        if (!plan) throw new NotFoundException('Kế hoạch không tồn tại');

        // Fetch real stock
        const allStocks = await this.inventoryService.getAllStocks();
        const stockMap = new Map<number, number>();
        for (const s of allStocks) {
            if (s.item_type === 'PRODUCT' && s.warehouse_code !== 'KHO_MAU') {
                const key = Number(s.item_id);
                stockMap.set(key, (stockMap.get(key) || 0) + Number(s.quantity));
            }
        }

        const extractedItems: any[] = [];
        for (const order of (plan.sales_order ? [plan.sales_order] : [])) {
            const customerName = order.customer_name || order.customer?.name || '';
            for (const item of order.items) {
                const product = item.product;
                const productType = product?.product_type || 'STANDARD';
                const realStock = product ? (stockMap.get(product.id) || 0) : 0;
                const approvedBooking = Number(product?.approved_booking_stock || 0);
                const bookingStockVal = Number(product?.booking_stock || 0);
                const availableStock = Math.max(0, realStock - approvedBooking);

                let comboComponents: any[] = [];
                let minRealStock = Infinity;
                let minApprovedBooking = Infinity;
                let minAvailableStock = Infinity;
                let minBookingStock = Infinity;

                if (productType === 'COMBO' && product?.components?.length > 0) {
                    comboComponents = product.components.map((c: any) => {
                        const childStock = c.child_product ? (stockMap.get(c.child_product.id) || 0) : 0;
                        const childApproved = Number(c.child_product?.approved_booking_stock || 0);
                        const childAvailable = Math.max(0, childStock - childApproved);
                        const childBooking = Number(c.child_product?.booking_stock || 0);
                        const reqQty = Number(c.quantity) || 1;

                        const possibleStock = Math.floor(childStock / reqQty);
                        const possibleApproved = Math.floor(childApproved / reqQty);
                        const possibleAvailable = Math.floor(childAvailable / reqQty);
                        const possibleBooking = Math.floor(childBooking / reqQty);

                        if (possibleStock < minRealStock) minRealStock = possibleStock;
                        if (possibleApproved < minApprovedBooking) minApprovedBooking = possibleApproved;
                        if (possibleAvailable < minAvailableStock) minAvailableStock = possibleAvailable;
                        if (possibleBooking < minBookingStock) minBookingStock = possibleBooking;

                        return {
                            sku: c.child_product?.sku || '',
                            name: c.child_product?.name || '',
                            quantity_per_combo: Number(c.quantity),
                            total_needed: Number(item.booked_quantity || item.quantity || 0) * Number(c.quantity),
                            real_stock: childStock,
                            approved_booking_stock: childApproved,
                            available_stock: childAvailable,
                        };
                    });
                }

                const finalRealStock = productType === 'COMBO' ? (minRealStock === Infinity ? 0 : minRealStock) : realStock;
                const finalApprovedBooking = productType === 'COMBO' ? (minApprovedBooking === Infinity ? 0 : minApprovedBooking) : approvedBooking;
                const finalAvailableStock = productType === 'COMBO' ? (minAvailableStock === Infinity ? 0 : minAvailableStock) : availableStock;
                const finalBookingStock = productType === 'COMBO' ? (minBookingStock === Infinity ? 0 : minBookingStock) : bookingStockVal;

                extractedItems.push({
                    ...item,
                    order_code: order.order_code,
                    customer_name: customerName,
                    sku: product?.sku || item.sku,
                    product_name: product?.name || '',
                    product_type: productType,
                    real_stock: finalRealStock,
                    approved_booking_stock: finalApprovedBooking,
                    booking_stock: finalBookingStock,
                    available_stock: finalAvailableStock,
                    combo_components: comboComponents.length > 0 ? comboComponents : undefined,
                });
            }
        }
        return { items: extractedItems, plan: { id: plan.id, name: plan.name || plan.code } };
    }

    // --- MỚI: Revert Booking (CONFIRMED → TEMPORARY) ---
    async revertBooking(itemId: number) {
        const item = await this.orderItemRepo.findOne({
            where: { id: itemId },
            relations: ['product', 'order', 'order.deliveries', 'order.deliveries.items', 'order.production_plan']
        });
        if (!item) throw new NotFoundException('Booking item không tồn tại');
        if (item.booking_status !== BookingStatus.CONFIRMED) {
            throw new BadRequestException('Chỉ có thể revert booking đã duyệt (CONFIRMED)');
        }

        // Kiểm tra đã xuất kho chưa
        const deliveries = item.order?.deliveries || [];
        for (const delivery of deliveries) {
            if (delivery.status === 'SHIPPED') {
                const deliveredItem = delivery.items?.find((di: any) => di.sku === item.sku);
                if (deliveredItem && Number(deliveredItem.quantity) > 0) {
                    throw new BadRequestException(`Sản phẩm ${item.sku} đã xuất kho, không thể revert booking`);
                }
            }
        }

        // Trừ approved_booking_stock
        const product = item.product;
        if (product) {
            const bookedQty = Number(item.booked_quantity || 0);
            if (product.product_type === 'COMBO') {
                const components = await this.productsService.getComboComponents(product.sku);
                for (const comp of components) {
                    if (comp.child_product) {
                        const revertQty = bookedQty * Number(comp.quantity);
                        comp.child_product.approved_booking_stock = Math.max(0, Number(comp.child_product.approved_booking_stock || 0) - revertQty);
                        await this.productsService.update(comp.child_product.id, { approved_booking_stock: comp.child_product.approved_booking_stock } as any);
                    }
                }
            } else {
                product.approved_booking_stock = Math.max(0, Number(product.approved_booking_stock || 0) - bookedQty);
                await this.productsService.update(product.id, { approved_booking_stock: product.approved_booking_stock } as any);
            }
        }

        // Chuyển trạng thái về TEMPORARY với thời hạn 5 ngày mới
        const expires = new Date();
        expires.setDate(expires.getDate() + 5);
        item.booking_status = BookingStatus.TEMPORARY;
        item.booking_expires_at = expires;
        await this.orderItemRepo.save(item);

        if (item.order && item.order.production_plan) {
            await this.invalidateAnalysisCache(item.order.production_plan.id);
        }

        return { message: `Đã chuyển booking ${item.sku} về trạng thái chờ duyệt` };
    }

    // --- MỚI: Thống kê bookings theo tháng/năm ---
    async getBookingStats(month?: string, year?: string) {
        const query = this.orderItemRepo.createQueryBuilder('item')
            .leftJoin('item.order', 'order')
            .leftJoin('item.product', 'product')
            .where('item.booking_status IN (:...statuses)', { statuses: [BookingStatus.TEMPORARY, BookingStatus.CONFIRMED] })
            .select([
                'product.sku AS sku',
                'item.booking_status AS status',
                'SUM(item.booked_quantity) AS total_quantity'
            ])
            .groupBy('product.sku, item.booking_status');

        if (month && year) {
            // Lọc theo delivery_date của order
            // MySQL/PostgreSQL support EXTRACT(MONTH FROM date) hoặc YEAR/MONTH function.
            // Để tương thích cao, truyền param dạng string YYYY-MM
            const monthStr = month.padStart(2, '0');
            const startDate = `${year}-${monthStr}-01`;
            const endDate = `${year}-${monthStr}-31`; // Simplified, PostgreSQL handles it if we use >= and <= 
            
            // Cách chuẩn: >= startDate AND < nextMonth
            const nextMonth = Number(month) === 12 ? 1 : Number(month) + 1;
            const nextYear = Number(month) === 12 ? Number(year) + 1 : Number(year);
            const nextMonthStr = String(nextMonth).padStart(2, '0');
            const nextMonthDate = `${nextYear}-${nextMonthStr}-01`;

            query.andWhere('order.delivery_date >= :startDate', { startDate })
                 .andWhere('order.delivery_date < :nextMonthDate', { nextMonthDate });
        } else if (year) {
            const startDate = `${year}-01-01`;
            const nextYearDate = `${Number(year) + 1}-01-01`;
            query.andWhere('order.delivery_date >= :startDate', { startDate })
                 .andWhere('order.delivery_date < :nextYearDate', { nextYearDate });
        }

        const rawData = await query.getRawMany();
        
        // Cần tính gộp cho Combo components
        const statsMap = new Map<string, { booked: number, approved: number }>();

        for (const row of rawData) {
            const sku = row.sku;
            if (!sku) continue;
            
            const qty = Number(row.total_quantity) || 0;
            const isApproved = row.status === BookingStatus.CONFIRMED;

            // Kiểm tra xem SKU này là STANDARD hay COMBO
            const product = await this.productsService.findOneBySku(sku);
            if (!product) continue;

            if (product.product_type === 'COMBO') {
                const components = await this.productsService.getComboComponents(sku);
                for (const comp of components) {
                    if (comp.child_product && comp.child_product.sku) {
                        const childSku = comp.child_product.sku;
                        const childQty = qty * Number(comp.quantity);
                        
                        const current = statsMap.get(childSku) || { booked: 0, approved: 0 };
                        if (isApproved) {
                            current.approved += childQty;
                        } else {
                            current.booked += childQty;
                        }
                        statsMap.set(childSku, current);
                    }
                }
            } else {
                const current = statsMap.get(sku) || { booked: 0, approved: 0 };
                if (isApproved) {
                    current.approved += qty;
                } else {
                    current.booked += qty;
                }
                statsMap.set(sku, current);
            }
        }

        const result = {};
        statsMap.forEach((value, key) => {
            result[key] = {
                booking_stock: value.booked,
                approved_booking_stock: value.approved
            };
        });
        return result;
    }

    // --- MỚI: Đồng bộ lại toàn bộ số lượng booking cho sản phẩm ---
    async syncBookingStock() {
        const stats = await this.getBookingStats();
        // Since productRepo is private in productsService, we use any to access it
        const productRepo = (this.productsService as any).productRepo;
        const allProducts = await productRepo.find();
        
        let updated = 0;
        for (const p of allProducts) {
            const stat = stats[p.sku] || { booking_stock: 0, approved_booking_stock: 0 };
            const bs = Number(stat.booking_stock) || 0;
            const abs = Number(stat.approved_booking_stock) || 0;
            
            if (p.booking_stock !== bs || p.approved_booking_stock !== abs) {
                p.booking_stock = bs;
                p.approved_booking_stock = abs;
                await productRepo.save(p);
                updated++;
            }
        }

        // [MỚI] Tự động Fix các Booking tạm thời bị kẹt khi KHSX đã xuất NPL (dành cho các dữ liệu cũ trước khi có bản vá)
        try {
            await this.planRepo.manager.query(`
                UPDATE sales_order_items i
                SET booking_status = 'CONFIRMED'
                FROM production_fulfillment_orders p
                JOIN goods_issues gi ON gi.pfo_id = p.id
                WHERE i.order_id = p.sales_order_id
                  AND gi.status IN ('CONFIRMED', 'DELIVERED')
                  AND i.booking_status = 'TEMPORARY'
            `);
            await this.planRepo.manager.query(`
                UPDATE production_fulfillment_orders p
                SET status = 'IN_PRODUCTION'
                FROM goods_issues gi
                WHERE gi.pfo_id = p.id 
                  AND gi.status IN ('CONFIRMED', 'DELIVERED')
                  AND p.status IN ('DRAFT', 'PENDING_APPROVAL', 'WAITING_VENDOR', 'MATERIAL_PREP')
            `);
        } catch (e) {
            console.error('Error auto-fixing stuck bookings:', e);
        }

        return { message: `Đã đồng bộ lại tồn kho booking cho ${updated} sản phẩm`, updated };
    }

    // --- MỚI: Lấy tất cả bookings ---
    async getAllBookings() {
        const items = await this.orderItemRepo.find({
            where: {
                booking_status: In([BookingStatus.TEMPORARY, BookingStatus.CONFIRMED])
            },
            relations: ['order', 'order.assigned_to', 'order.customer', 'order.production_plan', 'product']
        });

        // Fetch real stock
        const allStocks = await this.inventoryService.getAllStocks();
        const stockMap = new Map<number, number>();
        for (const s of allStocks) {
            if (s.item_type === 'PRODUCT' && s.warehouse_code !== 'KHO_MAU') {
                const key = Number(s.item_id);
                stockMap.set(key, (stockMap.get(key) || 0) + Number(s.quantity));
            }
        }

        const results = [];
        for (const item of items) {
            const product = item.product;
            let comboComponents: any[] = [];
            let minRealStock = Infinity;
            let minApprovedBooking = Infinity;
            let minAvailableStock = Infinity;
            let minBookingStock = Infinity;
            const realStock = product ? (stockMap.get(product.id) || 0) : 0;
            const approvedBooking = Number(product?.approved_booking_stock || 0);
            const bookingStockTotal = Number(product?.booking_stock || 0);
            const availableStock = Math.max(0, realStock - approvedBooking);

            if (product?.product_type === 'COMBO') {
                const components = await this.productsService.getComboComponents(product.sku);
                comboComponents = components.map(c => {
                    const childStock = c.child_product ? (stockMap.get(c.child_product.id) || 0) : 0;
                    const childApproved = Number(c.child_product?.approved_booking_stock || 0);
                    const childAvailable = Math.max(0, childStock - childApproved);
                    const childBooking = Number(c.child_product?.booking_stock || 0);
                    const reqQty = Number(c.quantity) || 1;

                    const possibleStock = Math.floor(childStock / reqQty);
                    const possibleApproved = Math.floor(childApproved / reqQty);
                    const possibleAvailable = Math.floor(childAvailable / reqQty);
                    const possibleBooking = Math.floor(childBooking / reqQty);

                    if (possibleStock < minRealStock) minRealStock = possibleStock;
                    if (possibleApproved < minApprovedBooking) minApprovedBooking = possibleApproved;
                    if (possibleAvailable < minAvailableStock) minAvailableStock = possibleAvailable;
                    if (possibleBooking < minBookingStock) minBookingStock = possibleBooking;

                    return {
                        sku: c.child_product?.sku || '',
                        name: c.child_product?.name || '',
                        quantity_per_combo: Number(c.quantity),
                        total_needed: Number(item.booked_quantity || 0) * Number(c.quantity),
                        real_stock: childStock,
                        approved_booking_stock: childApproved,
                        available_stock: childAvailable,
                    };
                });
            }

            const finalRealStock = product?.product_type === 'COMBO' ? (minRealStock === Infinity ? 0 : minRealStock) : realStock;
            const finalApprovedBooking = product?.product_type === 'COMBO' ? (minApprovedBooking === Infinity ? 0 : minApprovedBooking) : approvedBooking;
            const finalAvailableStock = product?.product_type === 'COMBO' ? (minAvailableStock === Infinity ? 0 : minAvailableStock) : availableStock;
            const finalBookingStock = product?.product_type === 'COMBO' ? (minBookingStock === Infinity ? 0 : minBookingStock) : bookingStockTotal;

            results.push({
                id: item.id,
                sku: item.sku,
                product_name: product?.name || '',
                product_type: product?.product_type || 'STANDARD',
                quantity: Number(item.quantity),
                booked_quantity: Number(item.booked_quantity || 0),
                booking_status: item.booking_status,
                booking_expires_at: item.booking_expires_at,
                order_code: item.order?.order_code || '',
                customer_name: item.order?.customer_name || item.order?.customer?.name || '',
                delivery_date: item.order?.delivery_date,
                assigned_to_name: item.order?.assigned_to?.full_name || '',
                plan_code: item.order?.production_plan?.code || '',
                order_id: item.order?.id,
                real_stock: finalRealStock,
                approved_booking_stock: finalApprovedBooking,
                booking_stock: finalBookingStock,
                available_stock: finalAvailableStock,
                combo_components: comboComponents.length > 0 ? comboComponents : undefined,
            });
        }
        return results;
    }

    // --- MỚI: Lấy bookings theo SKU ---
    async getBookingsBySku(sku: string) {
        const allBookings = await this.getAllBookings();
        const filtered = [];

        for (const item of allBookings) {
            if (item.sku === sku) {
                filtered.push(item);
            } else if (item.combo_components && item.combo_components.length > 0) {
                const comp = item.combo_components.find((c: any) => c.sku === sku);
                if (comp) {
                    filtered.push({
                        ...item,
                        sku: comp.sku, // Override SKU to show the child SKU
                        booked_quantity: (item.booked_quantity || 0) * comp.quantity_per_combo,
                        quantity: (item.quantity || 0) * comp.quantity_per_combo,
                    });
                }
            }
        }
        return filtered;
    }

    // --- MỚI: Dashboard Tổng hợp Nhu cầu NPL & Gia Công ---
    async getSummaryDashboard(query: any) {
        let { from_date, to_date, customers } = query;

        const qb = this.planRepo.createQueryBuilder('p')
            .leftJoinAndSelect('p.sales_order', 'so')
            .leftJoinAndSelect('so.customer', 'c');

        if (from_date) {
            qb.andWhere('p.start_date >= :fromDate', { fromDate: from_date });
        }
        if (to_date) {
            qb.andWhere('p.start_date <= :toDate', { toDate: to_date });
        }
        
        // Cần lấy tất cả plan thỏa điều kiện thời gian trước, để lấy list KH
        const allPlansInRange = await qb.getMany();

        // Lấy danh sách khách hàng unique có trong khoảng thời gian này
        const customerSet = new Set<string>();
        for (const p of allPlansInRange) {
            if (p.sales_order) {
                const cName = p.sales_order.customer_name || p.sales_order.customer?.name;
                if (cName) customerSet.add(cName);
            }
        }
        const customer_list = Array.from(customerSet).sort();

        // Lọc theo khách hàng nếu có truyền lên
        let plansToProcess = allPlansInRange;
        if (customers) {
            const customerArr = customers.split(',').map((c: string) => c.trim());
            plansToProcess = allPlansInRange.filter(p => {
                if (!p.sales_order) return false;
                const cName = p.sales_order.customer_name || p.sales_order.customer?.name;
                return cName && customerArr.includes(cName);
            });
        }

        const plan_codes = plansToProcess.map(p => p.code);

        // Map để gộp dữ liệu MRP
        const mrpMap = new Map<number, any>();
        
        // Fetch tồn kho real-time cho NPL
        // Để không fetch n+1, ta sẽ thu thập tất cả material_ids trước
        const matIds = new Set<number>();
        plansToProcess.forEach(p => {
            if (p.mrp_data && Array.isArray(p.mrp_data)) {
                p.mrp_data.forEach(item => {
                    if (item.material_id) matIds.add(item.material_id);
                });
            }
        });

        const stockMap = new Map<number, number>();
        if (matIds.size > 0) {
            const mats = await this.materialsService.materialRepo.find({
                where: { id: In(Array.from(matIds)) },
                select: ['id', 'quantity_in_stock']
            });
            mats.forEach(m => stockMap.set(m.id, Number(m.quantity_in_stock || 0)));
        }

        // Gộp dữ liệu MRP
        for (const p of plansToProcess) {
            if (p.mrp_data && Array.isArray(p.mrp_data)) {
                for (const item of p.mrp_data) {
                    const matId = item.material_id;
                    if (!matId) continue;

                    if (!mrpMap.has(matId)) {
                        mrpMap.set(matId, {
                            material_id: item.material_id,
                            material_code: item.material_code,
                            material_name: item.material_name,
                            unit: item.unit,
                            supplier_name: item.supplier_name,
                            reference_price: Number(item.reference_price || 0),
                            wastage_percent: Number(item.wastage_percent || 0),
                            gross_requirement: 0,
                            gross_raw: 0,
                            supplier_stock: 0,
                            details: []
                        });
                    }

                    const existing = mrpMap.get(matId);
                    existing.gross_requirement += Number(item.gross_requirement || 0);
                    existing.gross_raw += Number(item.gross_raw || 0);
                    existing.supplier_stock = Math.max(existing.supplier_stock, Number(item.supplier_stock || 0)); // Tồn kho NCC không cộng dồn theo plan, mà lấy theo thực tế
                    // Cập nhật wastage_percent lớn nhất nếu khác nhau
                    if (Number(item.wastage_percent || 0) > existing.wastage_percent) {
                        existing.wastage_percent = Number(item.wastage_percent || 0);
                    }
                    if (item.details && Array.isArray(item.details)) {
                        existing.details.push(...item.details);
                    }
                }
            }
        }

        const mrp_summary = Array.from(mrpMap.values()).map(item => {
            const currentStock = stockMap.get(item.material_id) || 0;
            const totalAvailableStock = currentStock + item.supplier_stock;
            const net = Math.max(0, Math.ceil(item.gross_requirement - totalAvailableStock));
            
            // Gộp trùng sản phẩm trong details
            const detailMap = new Map<string, any>();
            item.details.forEach((d: any) => {
                const key = d.product_name;
                if (!detailMap.has(key)) {
                    detailMap.set(key, { ...d });
                } else {
                    const ed = detailMap.get(key);
                    ed.qty_needed += Number(d.qty_needed || 0);
                    ed.gross_req += Number(d.gross_req || 0);
                }
            });

            return {
                ...item,
                available_stock: currentStock,
                net_requirement: net,
                details: Array.from(detailMap.values())
            };
        });

        // Gộp dữ liệu Outsourcing
        const outsourcingMap = new Map<string, any>();
        for (const p of plansToProcess) {
            if (p.outsourcing_data && Array.isArray(p.outsourcing_data)) {
                for (const item of p.outsourcing_data) {
                    const key = `${item.product_sku}_${item.step_name}`;
                    if (!outsourcingMap.has(key)) {
                        outsourcingMap.set(key, {
                            product_sku: item.product_sku,
                            step_name: item.step_name,
                            supplier_name: item.supplier_name,
                            unit_price: Number(item.unit_price || 0),
                            quantity: 0,
                            total_cost: 0
                        });
                    }
                    const existing = outsourcingMap.get(key);
                    existing.quantity += Number(item.quantity || 0);
                    existing.total_cost += Number(item.total_cost || 0);
                }
            }
        }
        const outsourcing_summary = Array.from(outsourcingMap.values());

        return {
            customer_list,
            plan_codes,
            mrp_summary,
            outsourcing_summary
        };
    }

    // --- MỚI: Version History, Production Status, Sync BOD ---
    async getHistory(planId: number) {
        return this.historyRepo.find({
            where: { pfo_id: planId },
            order: { version: 'DESC' }
        });
    }

    async getProductionStatus(planId: number) {
        // Lấy WorkOrders của plan
        const workOrders = await this.woRepo.find({
            where: { pfo_id: planId },
            relations: ['steps', 'production_order']
        });
        
        // Lấy POs
        const pos = await this.poRepo.find({
            where: { pfo_id: planId },
            relations: ['items']
        });

        const plan = await this.planRepo.findOne({
            where: { id: planId },
            relations: ['sales_order']
        });

        return {
            workOrders,
            purchaseOrders: pos,
            salesOrders: plan?.sales_order ? [plan.sales_order] : []
        };
    }

    async initProduction(planId: number) {
        const plan = await this.planRepo.findOne({
            where: { id: planId },
            relations: ['sales_order', 'sales_order.items', 'sales_order.items.product']
        });
        if (!plan) throw new NotFoundException('Plan not found');

        // Check if any WorkOrder already exists for this plan
        const existingWos = await this.woRepo.find({ where: { pfo_id: planId } });
        if (existingWos.length > 0) {
            return { message: 'Đã khởi tạo Lệnh sản xuất rồi' };
        }

        const defaultSteps = [
            'Mua NPL', 'Nối vải', 'Chần gòn', 'Thêu', 'In ấn', 'Gia công May', 'Đóng gói', 'Giao hàng'
        ];

        let createdCount = 0;
        for (const so of (plan.sales_order ? [plan.sales_order] : [])) {
            for (const item of so.items) {
                if (!item.product) continue;
                
                const routings = await this.productsService.getRoutings(item.product.id);
                
                let stepsToCreate = [];
                if (routings && routings.length > 0) {
                    stepsToCreate = routings.map((r: any, idx: number) => ({
                        step_name: r.step_name || r.process?.name || `Step ${idx + 1}`,
                        order_index: idx + 1,
                        assigned_to: r.supplier?.name || null,
                        supplier_id: r.supplier_id || null,
                        status: 'PENDING'
                    }));
                } else {
                    stepsToCreate = defaultSteps.map((name, idx) => ({
                        step_name: name,
                        order_index: idx + 1,
                        status: 'PENDING'
                    }));
                }

                const wo = this.woRepo.create({
                    code: `WO-${plan.code}-${item.product.sku}`,
                    product_sku: item.product.sku,
                    quantity: Number(item.quantity),
                    pfo_id: planId,
                    status: WorkOrderStatus.PENDING,
                    steps: stepsToCreate
                });
                await this.woRepo.save(wo);
                createdCount++;
            }
        }
        
        return { message: `Đã khởi tạo ${createdCount} Lệnh sản xuất`, planId };
    }

    async syncBodFollowUp(planId: number) {
        const plan = await this.planRepo.findOne({
            where: { id: planId },
            relations: ['sales_order']
        });
        if (!plan) throw new NotFoundException('Plan not found');

        const { workOrders, purchaseOrders } = await this.getProductionStatus(planId);

        let nplCheckboxes = [];
        let prodCheckboxes = [];
        let nplNote = '';
        
        const hasDeliveredMaterial = purchaseOrders.some(po => po.type === POType.MATERIAL && [POStatus.DELIVERED, POStatus.COMPLETED].includes(po.status));
        if (hasDeliveredMaterial) {
            nplCheckboxes.push('fabric');
            nplCheckboxes.push('quilt'); // Giả sử vải và gòn chung
            nplNote += ` Đã giao nguyên liệu (PO cập nhật: ${new Date().toLocaleDateString()}).`;
        }

        const hasCompletedWo = workOrders.some(wo => wo.status === WorkOrderStatus.COMPLETED);
        const hasInProgressWo = workOrders.some(wo => wo.status === WorkOrderStatus.IN_PROGRESS);
        
        if (hasDeliveredMaterial) prodCheckboxes.push('fabric');
        if (hasInProgressWo || hasCompletedWo) {
            prodCheckboxes.push('process');
        }

        // Cập nhật lại vào các SalesOrder của KHSX này
        for (const so of (plan.sales_order ? [plan.sales_order] : [])) {
            const currentBod = so.bod_follow_up || {};
            
            // Lấy existing checkboxes và merge
            const extNpl = currentBod.npl_checkboxes || [];
            const extProd = currentBod.prod_checkboxes || [];
            
            const newNpl = Array.from(new Set([...extNpl, ...nplCheckboxes]));
            const newProd = Array.from(new Set([...extProd, ...prodCheckboxes]));
            
            so.bod_follow_up = {
                ...currentBod,
                npl_checkboxes: newNpl,
                prod_checkboxes: newProd,
                npl_note: currentBod.npl_note ? currentBod.npl_note + nplNote : nplNote
            };
            
            await this.orderRepo.save(so);
        }

        return { message: 'Đồng bộ BOD FollowUp thành công', planId };
    }
}
