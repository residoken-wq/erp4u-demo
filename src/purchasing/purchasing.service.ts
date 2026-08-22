import { Injectable, BadRequestException, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PurchaseOrder, POType, POStatus } from './entities/purchase-order.entity';
import { PurchaseOrderItem } from './entities/purchase-order-item.entity';
import { GoodsReceipt } from '../inventory/entities/goods-receipt.entity';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PlanningService } from '../planning/planning.service'; // --- MỚI ---
import { v4 as uuidv4 } from 'uuid';
import { ProductionFulfillmentOrder, PfoStatus } from '../planning/pfo.entity';
import { Transaction } from '../finance/transaction.entity';

@Injectable()
export class PurchasingService {
    constructor(
        @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
        @InjectRepository(PurchaseOrderItem) private poItemRepo: Repository<PurchaseOrderItem>,
        @InjectRepository(GoodsReceipt) private grRepo: Repository<GoodsReceipt>,
        @Inject(forwardRef(() => InventoryService)) private inventoryService: InventoryService,
        private productsService: ProductsService,
        private suppliersService: SuppliersService,
        private planningService: PlanningService,
        @InjectRepository(ProductionFulfillmentOrder) private planRepo: Repository<ProductionFulfillmentOrder>,
    ) { }

    async createPO(data: any) {
        const po = this.poRepo.create({
            po_code: data.po_code,
            uuid: uuidv4(),
            supplier_id: data.supplier_id,
            note: data.note,
            status: 'DRAFT' as any,
            total_amount: 0,
            paid_amount: 0
        });

        let total = 0;
        po.items = [];
        if (data.items) {
            for (const i of data.items) {
                const item = new PurchaseOrderItem();
                item.pfo_id = i.pfo_id; // --- FIX: Lưu pfo_id ---
                item.material_id = i.material_id;
                item.product_id = i.product_id;
                item.description = i.description || '';
                item.note = i.note || ''; // --- FIX: Save note ---
                item.front_color = i.front_color || ''; // --- MỚI: Màu NPL ---
                item.back_color = i.back_color || ''; // --- MỚI: Màu NPL ---
                item.quantity = Number(i.quantity);
                item.unit_price = Number(i.unit_price);
                item.subtotal = item.quantity * item.unit_price;
                total += item.subtotal;
                po.items.push(item);
            }
        }
        po.total_amount = total;
        return this.poRepo.save(po);
    }

    async getAllPOs() {
        return this.poRepo.find({ relations: ['supplier', 'items', 'items.material', 'items.product', 'items.print_design', 'pfo', 'pfo.sales_order', 'pfo.sales_order.customer'], order: { created_at: 'DESC' } });
    }

    async getPOByCode(code: string) {
        return this.poRepo.findOne({ where: { po_code: code }, relations: ['supplier'] });
    }

    async getPODetail(id: number) {
        const po = await this.poRepo.findOne({ 
            where: { id }, 
            relations: ['supplier', 'parent_po', 'child_pos', 'child_pos.pfo', 'child_pos.pfo.sales_order', 'child_pos.pfo.sales_order.customer', 'pfo', 'pfo.sales_order', 'pfo.sales_order.customer', 'items', 'items.material', 'items.product', 'items.product.routings', 'items.product.routings.process', 'items.print_design'] 
        });
        if (!po || !po.items) return po;

        // --- MỚI: Recover Missing Product (Legacy Data Fix) ---
        // Some Outsourcing POs created before 02/01/2026 might miss product_id
        // HOẶC product_id có nhưng ko load được relation (trường hợp hiếm)
        const missingProductItems = po.items.filter(i => (!i.product || !i.product.processing_description) && !i.material_id && i.description);

        if (missingProductItems.length > 0) {
            const skuMap = new Map<string, any>();

            // Helper to extract SKU: Taken from the last (...) group
            const extractSku = (desc: string) => {
                const matches = desc.match(/\(([^)]+)\)/g);
                if (matches && matches.length > 0) {
                    // Take the last match, remove parens
                    const last = matches[matches.length - 1];
                    return last.replace(/^\(/, '').replace(/\)$/, '').trim();
                }
                return null;
            };

            for (const item of missingProductItems) {
                const sku = extractSku(item.description);
                if (sku) skuMap.set(sku, null);
            }

            if (skuMap.size > 0) {
                for (const sku of Array.from(skuMap.keys())) {
                    const p = await this.productsService.findOneBySku(sku);
                    if (p) {
                        skuMap.set(sku, p);
                    }
                }
                for (const item of missingProductItems) {
                    const sku = extractSku(item.description);
                    if (sku) {
                        const p = skuMap.get(sku);
                        if (p) {
                            item.product = p;
                            item.product_id = p.id;
                        }
                    }
                }
            }
        }
        // -----------------------------------------------------


        // --- MỚI: Enrich Item Data from Plan if missing ---
        const pfoIds = new Set(po.items.map(i => i.pfo_id).filter(Boolean));
        if (pfoIds.size > 0) {
            const plans = await this.planRepo.find({ where: { id: In(Array.from(pfoIds)) } });
            const planMap = new Map(plans.map(p => [p.id, p]));

            for (const item of po.items) {
                // Chỉ điền nếu dữ liệu đang bằng 0
                if (item.pfo_id && planMap.has(item.pfo_id)) {
                    const plan = planMap.get(item.pfo_id);

                    // A. Material Logic
                    if (item.material_id) {
                        let mrpResult = [];
                        if (typeof plan.mrp_data === 'string') { try { mrpResult = JSON.parse(plan.mrp_data); } catch (e) { } }
                        else { mrpResult = plan.mrp_data || []; }

                        // Match by Material ID (Make sure to compare as numbers)
                        const match = mrpResult.find((m: any) => Number(m.material_id) === Number(item.material_id));

                        if (match) {
                            // Always enrich if data exists in Plan (Overwrite DB 0 values)
                            item.raw_quantity = match.gross_raw || 0;
                            item.wastage_rate = match.wastage_percent || 0;
                            item.total_quantity = match.gross_requirement || 0;
                        }
                    }
                    // B. Outsourcing Logic
                    else {
                        let outResult = [];
                        if (typeof plan.outsourcing_data === 'string') { try { outResult = JSON.parse(plan.outsourcing_data); } catch (e) { } }
                        else { outResult = plan.outsourcing_data || []; }

                        // Match by Description approx
                        const match = outResult.find((m: any) => item.description?.includes(m.product_sku));
                        if (match) {
                            item.raw_quantity = match.quantity || 0; // Gross
                            item.total_quantity = match.quantity || 0;
                        }
                    }
                }
            }
        }
        // ------------------------------------------------
        return po;
    }

    async getPOPaymentHistory(poId: number) {
        const po = await this.poRepo.findOne({
            where: { id: poId },
            relations: ['parent_po', 'child_pos']
        });
        if (!po) throw new NotFoundException('Không tìm thấy đơn hàng (PO)');

        // 1. Giao dịch trực tiếp liên quan đến PO này
        const directTrans = await this.poRepo.manager.createQueryBuilder(Transaction, 't')
            .where('t.reference_code = :poCode', { poCode: po.po_code })
            .orWhere(`t.allocations::text LIKE :poCodeLike`, { poCodeLike: `%"${po.po_code}"%` })
            .orWhere(`t.allocations::text LIKE :poIdLike`, { poIdLike: `%"po_id":${po.id}%` })
            .orderBy('t.date', 'DESC')
            .addOrderBy('t.id', 'DESC')
            .getMany();

        const results: any[] = directTrans.map(t => {
            let allocAmount = Number(t.amount || 0);
            if (t.allocations && Array.isArray(t.allocations)) {
                const matchAlloc = t.allocations.find((a: any) => a.poCode === po.po_code || a.po_id === po.id);
                if (matchAlloc) allocAmount = Number(matchAlloc.amount || 0);
            }
            return {
                ...t,
                source: 'DIRECT',
                source_label: 'Trực tiếp',
                allocated_amount: allocAmount
            };
        });

        // 2. Nếu PO này là con của PO Gộp (POOLED PO)
        if (po.parent_po_id || po.parent_po) {
            const parentPo = po.parent_po || await this.poRepo.findOne({ where: { id: po.parent_po_id } });
            if (parentPo) {
                const parentTrans = await this.poRepo.manager.createQueryBuilder(Transaction, 't')
                    .where('t.reference_code = :parentCode', { parentCode: parentPo.po_code })
                    .orWhere(`t.allocations::text LIKE :parentCodeLike`, { parentCodeLike: `%"${parentPo.po_code}"%` })
                    .orderBy('t.date', 'DESC')
                    .addOrderBy('t.id', 'DESC')
                    .getMany();

                const parentTotal = Number(parentPo.total_amount || 0);
                const poTotal = Number(po.total_amount || 0);
                const ratio = parentTotal > 0 ? (poTotal / parentTotal) : 0;

                for (const pt of parentTrans) {
                    if (!results.some(r => r.id === pt.id)) {
                        let allocatedForThis = Math.round(Number(pt.amount || 0) * ratio);
                        if (pt.allocations && Array.isArray(pt.allocations)) {
                            const matchAlloc = pt.allocations.find((a: any) => a.poCode === po.po_code || a.po_id === po.id);
                            if (matchAlloc) {
                                allocatedForThis = Number(matchAlloc.amount || 0);
                            }
                        }
                        results.push({
                            ...pt,
                            source: 'POOLED',
                            source_label: `Từ PO Gộp [${parentPo.po_code}]`,
                            parent_po_code: parentPo.po_code,
                            parent_total_amount: parentTotal,
                            child_total_amount: poTotal,
                            allocated_amount: allocatedForThis
                        });
                    }
                }
            }
        }

        // 3. Nếu PO này LÀ một PO Gộp
        if (po.type === POType.POOLED && po.child_pos && po.child_pos.length > 0) {
            for (const child of po.child_pos) {
                const childTrans = await this.poRepo.manager.createQueryBuilder(Transaction, 't')
                    .where('t.reference_code = :childCode', { childCode: child.po_code })
                    .orderBy('t.date', 'DESC')
                    .getMany();

                for (const ct of childTrans) {
                    if (!results.some(r => r.id === ct.id)) {
                        results.push({
                            ...ct,
                            source: 'CHILD_PO',
                            source_label: `Từ PO con [${child.po_code}]`,
                            child_po_code: child.po_code,
                            allocated_amount: Number(ct.amount || 0)
                        });
                    }
                }
            }
        }

        // Sắp xếp lại theo ngày
        results.sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime());

        return {
            po_id: po.id,
            po_code: po.po_code,
            type: po.type,
            total_amount: Number(po.total_amount || 0),
            paid_amount: Number(po.paid_amount || 0),
            parent_po: po.parent_po ? { id: po.parent_po.id, po_code: po.parent_po.po_code, total_amount: Number(po.parent_po.total_amount || 0), paid_amount: Number(po.parent_po.paid_amount || 0) } : null,
            child_pos: po.child_pos?.map((c: any) => ({ id: c.id, po_code: c.po_code, total_amount: Number(c.total_amount || 0), paid_amount: Number(c.paid_amount || 0) })) || [],
            history: results
        };
    }

    async updatePO(id: number, data: any) {
        const po = await this.poRepo.findOne({ where: { id }, relations: ['items'] });
        if (!po) throw new NotFoundException();

        if (data.outsourcing_delivery_info) po.outsourcing_delivery_info = data.outsourcing_delivery_info;
        if (data.delivery_info) po.delivery_info = data.delivery_info;
        if (data.packing_list_details) po.packing_list_details = data.packing_list_details;
        if (data.semi_finished_products !== undefined) po.semi_finished_products = data.semi_finished_products;
        if (data.excluded_outsourcing_materials !== undefined) po.excluded_outsourcing_materials = data.excluded_outsourcing_materials;
        if (data.status) po.status = data.status;
        if (data.note !== undefined) po.note = data.note; // Update General Note
        if (data.supplier_id) po.supplier = { id: data.supplier_id } as any; // Update Supplier relation
        if (data.vat_rate !== undefined) po.vat_rate = data.vat_rate;
        
        if (data.project_id !== undefined) po.project_id = data.project_id;
        if (data.task_id !== undefined) po.task_id = data.task_id;

        // --- MỚI: Update Items logic ---
        if (data.items && Array.isArray(data.items)) {
            for (const itemDTO of data.items) {
                const poItem = po.items.find(i => i.id === itemDTO.id);
                if (poItem) {
                    // Update Item fields
                    if (itemDTO.product_id !== undefined) {
                        poItem.product = { id: itemDTO.product_id } as any;
                        poItem.product_id = itemDTO.product_id; // Explicitly set ID
                    }
                    if (itemDTO.quantity !== undefined) poItem.quantity = Number(itemDTO.quantity);
                    if (itemDTO.unit_price !== undefined) poItem.unit_price = Number(itemDTO.unit_price);
                    if (itemDTO.note !== undefined) poItem.note = itemDTO.note; // Update Item Note
                    if (itemDTO.front_color !== undefined) poItem.front_color = itemDTO.front_color;
                    if (itemDTO.back_color !== undefined) poItem.back_color = itemDTO.back_color;
                    if (itemDTO.print_design_id !== undefined) {
                        poItem.print_design_id = itemDTO.print_design_id;
                        poItem.print_design = { id: itemDTO.print_design_id } as any;
                    }

                    // Recalculate Subtotal
                    poItem.subtotal = Number(poItem.quantity) * Number(poItem.unit_price);
                }
            }
            // Save updated items
            await this.poItemRepo.save(po.items);


            // Recalculate PO Total
            po.total_amount = po.items.reduce((sum, i) => sum + Number(i.subtotal), 0);
        }
        // -------------------------------


        const savedPO = await this.poRepo.save(po);

        // --- Sync Price to Planning if Ordered ---
        if (data.status === 'ORDERED' && savedPO.pfo_id) {
            await this.planningService.syncPoPrices(savedPO.pfo_id);
        }

        // --- MỚI: Auto-check Plan Status khi PO status thay đổi ---
        if (data.status && savedPO.pfo_id) {
            await this.planningService.checkAndUpdatePfoStatus(savedPO.pfo_id);
        }

        // --- MỚI: Cập nhật lại tổng tiền của PO Gộp nếu PO này là PO con ---
        if (savedPO.parent_po_id) {
            const parentPo = await this.poRepo.findOne({ 
                where: { id: savedPO.parent_po_id },
                relations: ['child_pos'] 
            });
            if (parentPo && parentPo.child_pos) {
                parentPo.total_amount = parentPo.child_pos.reduce((sum, child) => sum + Number(child.total_amount || 0), 0);
                await this.poRepo.save(parentPo);
            }
        }

        return savedPO;
    }

    async updatePayment(poCode: string, amount: number) {
        const po = await this.poRepo.findOne({ where: { po_code: poCode }, relations: ['child_pos', 'parent_po'] });
        if (po) {
            po.paid_amount = Math.max(0, Number(po.paid_amount || 0) + Number(amount));
            await this.poRepo.save(po);

            // Nếu đây là PO Gộp, tự động phân bổ tỷ lệ cho các PO con
            if (po.type === POType.POOLED && po.child_pos && po.child_pos.length > 0) {
                const totalAmount = Number(po.total_amount || 0);
                for (const child of po.child_pos) {
                    const ratio = totalAmount > 0 ? (Number(child.total_amount || 0) / totalAmount) : (1 / po.child_pos.length);
                    const childAdd = Math.round(Number(amount) * ratio);
                    child.paid_amount = Math.max(0, Number(child.paid_amount || 0) + childAdd);
                    await this.poRepo.save(child);
                }
            }
        }
    }

    async updatePaymentById(id: number, amount: number) {
        const po = await this.poRepo.findOne({ where: { id }, relations: ['child_pos', 'parent_po'] });
        if (po) {
            po.paid_amount = Math.max(0, Number(po.paid_amount || 0) + Number(amount));
            await this.poRepo.save(po);

            // Nếu đây là PO Gộp, tự động phân bổ tỷ lệ cho các PO con
            if (po.type === POType.POOLED && po.child_pos && po.child_pos.length > 0) {
                const totalAmount = Number(po.total_amount || 0);
                for (const child of po.child_pos) {
                    const ratio = totalAmount > 0 ? (Number(child.total_amount || 0) / totalAmount) : (1 / po.child_pos.length);
                    const childAdd = Math.round(Number(amount) * ratio);
                    child.paid_amount = Math.max(0, Number(child.paid_amount || 0) + childAdd);
                    await this.poRepo.save(child);
                }
            }
        }
    }

    // --- TÍNH TOÁN NPL VÀ BTP CẦN THIẾT CHO ĐƠN GIA CÔNG ---
    async getOutsourcingMaterials(poId: number) {
        const po = await this.poRepo.findOne({ where: { id: poId }, relations: ['items', 'items.product'] });
        if (!po || po.type !== POType.OUTSOURCING) return [];

        let mrpData: any[] = [];
        if (po.pfo_id) {
            const plan = await this.planRepo.findOne({ where: { id: po.pfo_id } });
            if (plan && Array.isArray(plan.mrp_data)) {
                mrpData = plan.mrp_data;
            }
        }

        const materialNeeds = new Map<string, any>();

        for (const item of po.items) {
            if (item.product_id && item.product?.sku) {
                // 1. Lấy Vật tư NPL (từ BOM)
                const boms = await this.productsService.getBomByProductSku(item.product.sku);
                for (const bom of boms) {
                    if (bom.material) {
                        const matId = bom.material.id;
                        const needQty = Number(bom.quantity) * Number(item.quantity) * (1 + Number(bom.waste_percent) / 100);

                        let reserved_for_plan = false;
                        const mrpItem = mrpData.find(m => m.material_id === matId);
                        if (mrpItem && mrpItem.use_stock !== false) {
                            reserved_for_plan = true;
                        }

                        const key = `MAT_${matId}`;
                        if (materialNeeds.has(key)) {
                            const exist = materialNeeds.get(key);
                            exist.quantity += needQty;
                            if (reserved_for_plan) exist.reserved_for_plan = true;
                        } else {
                            materialNeeds.set(key, {
                                type: 'MATERIAL',
                                material_id: matId,
                                code: bom.material.code,
                                name: bom.material.name,
                                unit: bom.material.unit,
                                quantity: needQty,
                                stock: Number(bom.material.quantity_in_stock || 0),
                                reserved_for_plan: reserved_for_plan
                            });
                        }
                    }
                }

                // 2. Lấy Bán Thành Phẩm (từ Components)
                const components = await this.poRepo.manager.find('ProductComponent', {
                    where: { parent_product: { id: item.product_id } },
                    relations: ['child_product']
                }) as any[];
                
                for (const comp of components) {
                    if (comp.child_product && comp.child_product.product_type === 'SEMI_FINISHED') {
                        const prodId = comp.child_product.id;
                        const needQty = Number(comp.quantity) * Number(item.quantity);
                        
                        const key = `PROD_${prodId}`;
                        if (materialNeeds.has(key)) {
                            const exist = materialNeeds.get(key);
                            exist.quantity += needQty;
                        } else {
                            materialNeeds.set(key, {
                                type: 'SEMI_FINISHED',
                                product_id: prodId,
                                code: comp.child_product.sku,
                                name: comp.child_product.name,
                                unit: comp.child_product.unit,
                                quantity: needQty,
                                stock: Number(comp.child_product.quantity_in_stock || 0),
                                reserved_for_plan: false
                            });
                        }
                    }
                }
            }
        }

        // 3. Lấy Bán Thành Phẩm được phối trộn & tạo ra từ các PO Gia công khác của cùng Lệnh SX (PFO)
        const btpMaterialMap = new Map<number | string, string[]>();

        if (po.pfo_id) {
            const siblingPos = await this.poRepo.find({
                where: { pfo_id: po.pfo_id, type: POType.OUTSOURCING }
            });
            for (const sib of siblingPos) {
                if (Array.isArray(sib.semi_finished_products)) {
                    for (const btp of sib.semi_finished_products) {
                        // Track components mixed into BTP
                        if (Array.isArray(btp.components)) {
                            for (const comp of btp.components) {
                                const cKey = comp.material_id || comp.material_code || comp.material_name;
                                if (cKey) {
                                    const existing = btpMaterialMap.get(cKey) || [];
                                    existing.push(btp.btp_name || btp.btp_code || 'BTP');
                                    btpMaterialMap.set(cKey, existing);
                                }
                            }
                        }

                        // Nếu BTP này được tạo từ PO khác và chuyển sang PO này (hoặc NCC này)
                        if (sib.id !== po.id) {
                            const isMatch = (!btp.target_po_id && !btp.target_vendor_id) ||
                                            (btp.target_po_id && Number(btp.target_po_id) === Number(po.id)) ||
                                            (btp.target_vendor_id && Number(btp.target_vendor_id) === Number(po.supplier_id));

                            if (isMatch) {
                                const btpKey = `BTP_RECIPE_${sib.id}_${btp.id || btp.btp_name}`;
                                materialNeeds.set(btpKey, {
                                    key: btpKey,
                                    type: 'SEMI_FINISHED',
                                    product_id: btp.product_id || null,
                                    code: btp.btp_code || `BTP-GC-${sib.id}`,
                                    name: btp.btp_name || btp.name || 'Bán thành phẩm gia công',
                                    unit: btp.unit || 'm',
                                    quantity: Number(btp.output_quantity || btp.quantity || 0),
                                    stock: Number(btp.output_quantity || btp.quantity || 0),
                                    reserved_for_plan: true,
                                    from_po_id: sib.id,
                                    from_po_code: sib.po_code,
                                    from_stage: sib.note,
                                    formula_desc: Array.isArray(btp.components) ? btp.components.map((c: any) => `${c.quantity} ${c.unit || ''} ${c.material_name || ''}`).join(' + ') : ''
                                });
                            }
                        }
                    }
                }
            }
        }

        // Đánh dấu NPL nào đã được phối trộn trong BTP và gắn key định danh
        const result: any[] = [];
        const excludedList = Array.isArray(po.excluded_outsourcing_materials) ? po.excluded_outsourcing_materials : [];
        const savedCategories = po.outsourcing_delivery_info?.material_categories || {};

        for (const [key, item] of materialNeeds.entries()) {
            item.key = key;
            const matId = item.material_id;

            // Áp dụng Loại NPL đã lưu (nếu có)
            if (savedCategories[key]) {
                item.material_category = savedCategories[key];
            } else if (matId && savedCategories[`MAT_${matId}`]) {
                item.material_category = savedCategories[`MAT_${matId}`];
            } else if (item.product_id && savedCategories[`PROD_${item.product_id}`]) {
                item.material_category = savedCategories[`PROD_${item.product_id}`];
            }

            if (matId && btpMaterialMap.has(matId)) {
                item.mixed_in_btp = true;
                item.used_in_btp_names = btpMaterialMap.get(matId);
            } else if (item.code && btpMaterialMap.has(item.code)) {
                item.mixed_in_btp = true;
                item.used_in_btp_names = btpMaterialMap.get(item.code);
            }

            // Kiểm tra danh sách loại bỏ của PO này
            if (!excludedList.includes(key) && !(matId && excludedList.includes(`MAT_${matId}`)) && !(item.product_id && excludedList.includes(`PROD_${item.product_id}`))) {
                result.push(item);
            }
        }

        return result;
    }
    // ------------------------------------------------------

    async remove(id: number) {
        const po = await this.poRepo.findOne({ where: { id } });
        if (!po) throw new NotFoundException('PO không tồn tại');

        // MỚI: Nếu PO thuộc một plan, ta có thể cập nhật trạng thái plan nếu cần thiết
        // Nhưng KHÔNG invalidate mrp_data để tránh mất kết quả tính toán và use_stock
        if (po.pfo_id) {
            // (Tuỳ chọn: downgrade trạng thái plan)
        }

        // Unlink children if this is a Pooled PO
        const children = await this.poRepo.find({ where: { parent_po_id: id } });
        if (children.length > 0) {
            for (const child of children) {
                child.parent_po_id = null;
                child.parent_po = null;
                await this.poRepo.save(child);
            }
        }
        return this.poRepo.delete(id);
    }

    async batchDelete(ids: number[]) {
        let deletedCount = 0;
        for (const id of ids) {
            const po = await this.poRepo.findOne({ where: { id } });
            if (po && po.status === POStatus.DRAFT) {
                await this.remove(id);
                deletedCount++;
            }
        }
        return { deletedCount };
    }

    async createGoodsReceipt(poId: number, data: any) {
        const po = await this.poRepo.findOne({ where: { id: poId }, relations: ['items'] });
        if (!po) throw new NotFoundException('PO not found');

        const gr = this.grRepo.create({
            code: data.code, purchase_order: po, delivery_date: data.date, note: data.note
        });
        await this.grRepo.save(gr);

        for (const item of data.items) {
            const poItem = po.items.find(pi => pi.id === item.po_item_id);
            if (!poItem) continue;
            if (poItem.material_id) {
                await this.inventoryService.adjustStock('IMPORT', 'MATERIAL', poItem.material_id, Number(item.quantity), data.code, 'Nhập từ PO ' + po.po_code, 'KHO_NPL');
            } else if (poItem.product_id) {
                await this.inventoryService.adjustStock('IMPORT', 'PRODUCT', poItem.product_id, Number(item.quantity), data.code, 'Nhập từ PO ' + po.po_code, 'KHO_TP');
            }
        }
        po.status = 'COMPLETED' as any;
        return this.poRepo.save(po);
    }

    async getByUuid(uuid: string) {
        const po = await this.poRepo.findOne({
            where: { uuid },
            relations: ['supplier', 'items', 'items.product', 'items.material', 'items.print_design']
        });
        if (!po) throw new NotFoundException('Đơn hàng không tồn tại hoặc link đã hết hạn');
        return po;
    }

    async supplierAction(uuid: string, action: string, data?: any) {
        const po = await this.poRepo.findOne({ where: { uuid }, relations: ['items'] });
        if (!po) throw new NotFoundException('Đơn hàng không tồn tại');

        // Initialize outsourcing_delivery_info if null
        if (!po.outsourcing_delivery_info) po.outsourcing_delivery_info = {};
        if (!po.outsourcing_delivery_info.progress_updates) po.outsourcing_delivery_info.progress_updates = [];

        switch (action) {
            case 'CONFIRM':
                if (!['DRAFT', 'SENT'].includes(po.status)) {
                    throw new BadRequestException('Đơn hàng đã được xác nhận trước đó');
                }
                po.status = POStatus.CONFIRMED;
                po.outsourcing_delivery_info.confirmed_at = new Date().toISOString();
                po.outsourcing_delivery_info.confirmed_note = data?.note || null;
                break;

            case 'UPDATE_PROGRESS':
                // data: { completed_qty, note, photos }
                po.outsourcing_delivery_info.progress_updates.push({
                    completed_qty: Number(data?.completed_qty || 0),
                    note: data?.note || '',
                    photos: data?.photos || [],
                    timestamp: new Date().toISOString()
                });
                // Auto-update status to ORDERED nếu chưa
                if (['CONFIRMED', 'DRAFT', 'SENT'].includes(po.status)) {
                    po.status = POStatus.ORDERED;
                }
                break;

            case 'MARK_COMPLETED':
                po.outsourcing_delivery_info.completed_at = new Date().toISOString();
                po.outsourcing_delivery_info.completion_note = data?.note || '';
                po.outsourcing_delivery_info.completion_photos = data?.photos || [];
                // Chuyển sang DELIVERED (chờ nội bộ confirm nhập kho)
                po.status = POStatus.DELIVERED;
                break;

            case 'SUBMIT_QC':
                // Supplier submits self-QC, create a QualityInspection record
                const qcCode = `QC-SUP-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 1000)}`;
                const qcRepo = this.poRepo.manager.getRepository('QualityInspection');
                
                let total_qty = 0;
                if (data?.item_id) {
                    const item = po.items.find((i: any) => i.id === data.item_id);
                    if (item) total_qty = Number(item.quantity);
                } else {
                    total_qty = po.items.reduce((sum: number, i: any) => sum + Number(i.quantity), 0);
                }

                const newQc = qcRepo.create({
                    code: qcCode,
                    type: 'OUTSOURCING',
                    status: 'PENDING',
                    po_id: po.id,
                    supplier_id: po.supplier_id,
                    pfo_id: po.pfo_id,
                    total_quantity: total_qty,
                    inspected_quantity: Number(data?.inspected_quantity || 0),
                    passed_quantity: Number(data?.passed_quantity || 0),
                    defect_quantity: Number(data?.defect_quantity || 0),
                    inspection_date: new Date().toISOString().split('T')[0],
                    note: data?.note ? `[NGC tự kiểm] ${data.note}` : '[NGC tự kiểm]',
                    inspector: po.supplier?.name || 'Nhà gia công',
                    created_at: new Date()
                } as any);

                await qcRepo.save(newQc);
                break;

            case 'REJECT':
                po.outsourcing_delivery_info.rejection = {
                    reason: data?.reason || 'Không có lý do',
                    rejected_at: new Date().toISOString(),
                    note: data?.note || ''
                };
                po.status = POStatus.CANCELLED;
                break;

            default:
                throw new BadRequestException(`Action không hợp lệ: ${action}`);
        }

        const saved = await this.poRepo.save(po);

        // Auto-check plan status
        if (saved.pfo_id) {
            await this.planningService.checkAndUpdatePfoStatus(saved.pfo_id);
        }

        return saved;
    }

    // --- MỚI: TỔNG HỢP NHU CẦU MUA HÀNG (PO GỘP) ---
    async getPendingRequirements() {
        console.log('Start getPendingRequirements');
        try {
            // 1. Load tất cả Plan đang ở trạng thái CALCULATED
            const plans = await this.planningService.findAll();
            console.log('Found plans:', plans.length);
            const calcPlans = plans.filter(p => p.status === PfoStatus.DRAFT);
            console.log('Calc plans:', calcPlans.length);

            // 2. Load tất cả Item đã đặt hàng (Active)
            const allPoItems = await this.poItemRepo.find({ relations: ['purchase_order'] });
            console.log('Found PO items:', allPoItems.length);
            const activePoItems = allPoItems.filter(i => i.purchase_order && i.purchase_order.status !== 'CANCELLED');
            console.log('Active PO items:', activePoItems.length);

            const orderedQtyMap = new Map<string, number>(); // key: pfoId_type_idOrRef

            for (const item of activePoItems) {
                if (item.pfo_id) { // Chỉ quan tâm item có link đến Plan
                    // Nếu là Material
                    if (item.material_id) {
                        const key = `${item.pfo_id}_MAT_${item.material_id}`;
                        orderedQtyMap.set(key, (orderedQtyMap.get(key) || 0) + Number(item.quantity));
                    } else {
                        // Nếu là Outsourcing (Dựa vào Description match)
                        // Format: "StepName (SKU)"
                        const key = `${item.pfo_id}_OUT_${item.description}`;
                        orderedQtyMap.set(key, (orderedQtyMap.get(key) || 0) + Number(item.quantity));
                    }
                }
            }

            const pendingItems = [];

            for (const plan of calcPlans) {
                // A. Parse mrp_data (Material)
                let mrpResult = [];
                if (typeof plan.mrp_data === 'string') { try { mrpResult = JSON.parse(plan.mrp_data); } catch (e) { } }
                else { mrpResult = plan.mrp_data || []; }

                if (Array.isArray(mrpResult)) {
                    for (const item of mrpResult) {
                        const key = `${plan.id}_MAT_${item.material_id}`;
                        const ordered = orderedQtyMap.get(key) || 0;
                        const needed = Number(item.net_requirement || 0);
                        const remaining = needed - ordered;

                        if (remaining > 0) {
                            pendingItems.push({
                                type: 'MATERIAL',
                                pfo_id: plan.id,
                                plan_code: plan.code,
                                material_id: item.material_id, // Quan trọng
                                material_code: item.material_code,
                                material_name: item.material_name,
                                supplier_name: item.supplier_name,
                                unit: item.unit,
                                reference_price: item.reference_price,
                                needed_qty: needed,
                                ordered_qty: ordered,
                                remaining_qty: remaining,

                                description: item.material_name,
                                // --- MỚI: Truyền dữ liệu gốc/hao hụt ---
                                raw_quantity: item.gross_raw || 0,
                                wastage_rate: item.wastage_percent || 0,
                                total_quantity: item.gross_requirement || 0
                                // ---------------------------------------
                            });
                        }
                    }
                }

                // B. Parse outsourcing_data (Gia Công)
                let outResult = [];
                if (typeof plan.outsourcing_data === 'string') { try { outResult = JSON.parse(plan.outsourcing_data); } catch (e) { } }
                else { outResult = plan.outsourcing_data || []; }

                if (Array.isArray(outResult)) {
                    for (const item of outResult) {
                        const desc = `${item.step_name} (${item.product_sku})`;
                        const key = `${plan.id}_OUT_${desc}`;
                        const ordered = orderedQtyMap.get(key) || 0;
                        const needed = Number(item.quantity || 0);
                        const remaining = needed - ordered;

                        if (remaining > 0) {
                            pendingItems.push({
                                type: 'OUTSOURCING',
                                pfo_id: plan.id,
                                plan_code: plan.code,
                                material_id: null,
                                material_code: item.product_sku,
                                material_name: item.step_name, // Display as Name
                                supplier_name: item.supplier_name,
                                supplier_id: item.supplier_id, // Outsourcing often has Supplier ID
                                unit: 'Unit',
                                reference_price: item.unit_price,
                                needed_qty: needed,
                                ordered_qty: ordered,
                                remaining_qty: remaining,
                                description: desc // Quan trong để link PO
                            });
                        }
                    }
                }
            }

            return pendingItems;
        } catch (err) {
            console.error('Error in getPendingRequirements:', err);
            throw err;
        }
    }

    // --- MỚI: POOLED PO LOGIC ---

    async clearPooledPOs() {
        // Unlink all
        await this.poRepo.update({ type: POType.MATERIAL }, { parent_po_id: null });
        await this.poRepo.update({ type: POType.OUTSOURCING }, { parent_po_id: null });
        return this.poRepo.delete({ type: POType.POOLED });
    }

    // Lấy danh sách PO_NPL có thể gộp (chưa có parent_po_id)
    async getAvailableForPooling(type: POType = POType.MATERIAL) {
        const qb = this.poRepo.createQueryBuilder('po')
            .leftJoinAndSelect('po.supplier', 'supplier')
            .leftJoinAndSelect('po.items', 'items')
            .leftJoinAndSelect('items.material', 'material')
            .leftJoinAndSelect('po.pfo', 'pfo')
            .leftJoinAndSelect('pfo.sales_order', 'so')
            .leftJoinAndSelect('so.customer', 'customer')
            .where('po.type = :type', { type })
            .andWhere('po.status = :status', { status: POStatus.DRAFT })
            .andWhere('po.parent_po_id IS NULL')
            .orderBy('po.created_at', 'DESC');

        if (type === POType.OUTSOURCING) {
            // Không gộp các PO đã xuất kho NPL
            qb.andWhere('NOT EXISTS (SELECT 1 FROM goods_issues gi WHERE gi.po_id = po.id)');
        } else if (type === POType.MATERIAL) {
            // Không gộp các PO đã nhập kho (đáng lẽ chuyển status nhưng filter cho chắc)
            qb.andWhere('NOT EXISTS (SELECT 1 FROM goods_receipts gr WHERE gr.po_id = po.id)');
        }

        return qb.getMany();
    }

    // Tạo Pooled PO từ danh sách child PO IDs
    async createPooledPO(dto: { supplier_id: number, child_po_ids: number[] }) {
        if (!dto.child_po_ids || dto.child_po_ids.length === 0) {
            throw new BadRequestException('Vui lòng chọn ít nhất 1 PO');
        }

        const childPos = await this.poRepo.find({
            where: { id: In(dto.child_po_ids) },
            relations: ['items']
        });

        if (childPos.length === 0) {
            throw new NotFoundException('Không tìm thấy PO');
        }

        // Tính tổng tiền từ các child POs
        const totalAmount = childPos.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);

        // --- MỚI: Merge các tab data từ child POs ---
        const mergedPackingMap = new Map<string, any>();
        let formCodeCounter = 1;
        for (const child of childPos) {
            if (Array.isArray(child.packing_list_details)) {
                for (const p of child.packing_list_details) {
                    const nameKey = (p.material_name || '').trim().toLowerCase();
                    const idKey = p.material_id ? `id-${p.material_id}` : null;
                    const primaryKey = idKey || nameKey;
                    if (!primaryKey) continue;

                    let existing = (idKey && mergedPackingMap.get(idKey)) || (nameKey && mergedPackingMap.get(nameKey));
                    if (!existing) {
                        existing = {
                            id: Date.now() + Math.random(),
                            po_form_code: formCodeCounter++,
                            material_name: p.material_name,
                            material_id: p.material_id || null,
                            quantity: Number(p.quantity || 0),
                            n1: p.n1 ? String(p.n1) : '',
                            n2: p.n2 ? String(p.n2) : '',
                            c1: p.c1 ? String(p.c1) : '',
                            c2: p.c2 ? String(p.c2) : '',
                            g1: p.g1 ? String(p.g1) : '',
                            g2: p.g2 ? String(p.g2) : '',
                            odd: p.odd ? String(p.odd) : '',
                            border: p.border ? String(p.border) : '',
                            note: p.note || ''
                        };
                        if (idKey) mergedPackingMap.set(idKey, existing);
                        if (nameKey) mergedPackingMap.set(nameKey, existing);
                    } else {
                        existing.quantity = Number(existing.quantity || 0) + Number(p.quantity || 0);
                        if (p.n1) existing.n1 = String((Number(existing.n1) || 0) + Number(p.n1));
                        if (p.n2) existing.n2 = String((Number(existing.n2) || 0) + Number(p.n2));
                        if (p.c1) existing.c1 = String((Number(existing.c1) || 0) + Number(p.c1));
                        if (p.c2) existing.c2 = String((Number(existing.c2) || 0) + Number(p.c2));
                        if (p.g1) existing.g1 = String((Number(existing.g1) || 0) + Number(p.g1));
                        if (p.g2) existing.g2 = String((Number(existing.g2) || 0) + Number(p.g2));
                        if (p.odd) existing.odd = String((Number(existing.odd) || 0) + Number(p.odd));
                        if (p.border) existing.border = String((Number(existing.border) || 0) + Number(p.border));
                        if (p.note && (!existing.note || !existing.note.includes(p.note))) {
                            existing.note = existing.note ? `${existing.note}; ${p.note}` : p.note;
                        }
                    }
                }
            }
        }
        const mergedPackingList = Array.from(new Set(mergedPackingMap.values()));

        // Lấy thông tin giao hàng từ PO con đầu tiên có dữ liệu
        const firstDeliveryInfo = childPos.find(p => p.delivery_info)?.delivery_info;
        const firstOutsourcingDeliveryInfo = childPos.find(p => p.outsourcing_delivery_info)?.outsourcing_delivery_info;

        const pooledPO = this.poRepo.create({
            po_code: `POOLED-${Date.now()}`,
            uuid: uuidv4(),
            type: POType.POOLED,
            supplier_id: dto.supplier_id,
            status: 'DRAFT' as any,
            total_amount: totalAmount,
            packing_list_details: mergedPackingList.length > 0 ? mergedPackingList : null,
            delivery_info: firstDeliveryInfo || null,
            outsourcing_delivery_info: firstOutsourcingDeliveryInfo || null,
            note: `Gộp ${childPos.length} PO: ${childPos.map(p => p.po_code).join(', ')}`
        });

        await this.poRepo.save(pooledPO);

        // Link child POs to this Pooled PO
        await this.poRepo.update({ id: In(dto.child_po_ids) }, { parent_po_id: pooledPO.id });

        return pooledPO;
    }

    // Lấy aggregate view của Pooled PO
    async getPooledAggregate(pooledId: number) {
        const po = await this.poRepo.findOne({
            where: { id: pooledId },
            relations: ['child_pos', 'child_pos.items', 'child_pos.items.material', 'child_pos.items.product', 'child_pos.pfo', 'child_pos.pfo.sales_order', 'child_pos.pfo.sales_order.customer', 'supplier']
        });

        if (!po) throw new NotFoundException('Không tìm thấy PO');
        if (po.type !== POType.POOLED) throw new BadRequestException('PO này không phải Pooled PO');

        // Aggregate by material OR by product/description
        const itemMap = new Map<string, any>();

        for (const childPO of (po.child_pos || [])) {
            for (const item of (childPO.items || [])) {
                // Tạo key: ưu tiên material_id, sau đó product_id, cuối cùng dùng description
                const key = item.material_id
                    ? `mat-${item.material_id}`
                    : item.product_id
                        ? `prod-${item.product_id}`
                        : `desc-${(item.description || 'unknown').trim()}`;

                if (!itemMap.has(key)) {
                    itemMap.set(key, {
                        material_id: item.material_id || null,
                        material_name: item.material?.name || item.description || '-',
                        material_code: item.material?.code || null,
                        material_unit: item.material?.unit || '',
                        product_id: item.product_id || null,
                        product: item.product || null,
                        unit: item.material?.unit || '',
                        conversion_factor: item.material?.conversion_factor || 1,
                        purchase_unit: item.material?.purchase_unit || '',
                        unit_price: Number(item.unit_price || 0),
                        total_ordered: 0,
                        total_subtotal: 0,
                        total_delivered: 0,
                        remaining: 0,
                        po_sources: [],
                        po_details: [] // Chi tiết từng PO con
                    });
                }

                const agg = itemMap.get(key);
                agg.total_ordered += Number(item.quantity || 0);
                agg.total_subtotal += Number(item.subtotal || 0);
                
                // Dùng đơn giá cao nhất (hoặc trung bình)
                if (Number(item.unit_price || 0) > agg.unit_price) {
                    agg.unit_price = Number(item.unit_price || 0);
                }
                
                if (!agg.po_sources.includes(childPO.po_code)) {
                    agg.po_sources.push(childPO.po_code);
                }
                
                // Thêm chi tiết PO con cho expand UI
                agg.po_details.push({
                    po_code: childPO.po_code,
                    quantity: Number(item.quantity || 0),
                    unit_price: Number(item.unit_price || 0),
                    subtotal: Number(item.subtotal || 0)
                });
            }
        }

        // Calculate remaining
        for (const agg of itemMap.values()) {
            agg.remaining = agg.total_ordered - agg.total_delivered;
        }

        // Tự động tổng hợp chi tiết đóng gói (packing_list_details) từ các PO con
        const childPackingMap = new Map<string, any>();
        let packIdx = 1;
        for (const childPO of (po.child_pos || [])) {
            if (Array.isArray(childPO.packing_list_details)) {
                for (const p of childPO.packing_list_details) {
                    const nameKey = (p.material_name || '').trim().toLowerCase();
                    const idKey = p.material_id ? `id-${p.material_id}` : null;
                    const primaryKey = idKey || nameKey;
                    if (!primaryKey) continue;

                    let cp = (idKey && childPackingMap.get(idKey)) || (nameKey && childPackingMap.get(nameKey));
                    if (!cp) {
                        cp = {
                            id: Date.now() + Math.random(),
                            po_form_code: packIdx++,
                            material_name: p.material_name,
                            material_id: p.material_id || null,
                            quantity: Number(p.quantity || 0),
                            n1: p.n1 ? String(p.n1) : '',
                            n2: p.n2 ? String(p.n2) : '',
                            c1: p.c1 ? String(p.c1) : '',
                            c2: p.c2 ? String(p.c2) : '',
                            g1: p.g1 ? String(p.g1) : '',
                            g2: p.g2 ? String(p.g2) : '',
                            odd: p.odd ? String(p.odd) : '',
                            border: p.border ? String(p.border) : '',
                            note: p.note || ''
                        };
                        if (idKey) childPackingMap.set(idKey, cp);
                        if (nameKey) childPackingMap.set(nameKey, cp);
                    } else {
                        cp.quantity = Number(cp.quantity || 0) + Number(p.quantity || 0);
                        if (p.n1) cp.n1 = String((Number(cp.n1) || 0) + Number(p.n1));
                        if (p.n2) cp.n2 = String((Number(cp.n2) || 0) + Number(p.n2));
                        if (p.c1) cp.c1 = String((Number(cp.c1) || 0) + Number(p.c1));
                        if (p.c2) cp.c2 = String((Number(cp.c2) || 0) + Number(p.c2));
                        if (p.g1) cp.g1 = String((Number(cp.g1) || 0) + Number(p.g1));
                        if (p.g2) cp.g2 = String((Number(cp.g2) || 0) + Number(p.g2));
                        if (p.odd) cp.odd = String((Number(cp.odd) || 0) + Number(p.odd));
                        if (p.border) cp.border = String((Number(cp.border) || 0) + Number(p.border));
                        if (p.note && (!cp.note || !cp.note.includes(p.note))) {
                            cp.note = cp.note ? `${cp.note}; ${p.note}` : p.note;
                        }
                    }
                }
            }
        }
        const aggregatedPackingList = Array.from(new Set(childPackingMap.values()));

        return {
            pooled_po: {
                id: po.id,
                po_code: po.po_code,
                supplier: po.supplier,
                total_amount: po.total_amount,
                child_count: po.child_pos?.length || 0,
                child_pos: po.child_pos,
                packing_list_details: po.packing_list_details
            },
            aggregated_items: Array.from(itemMap.values()),
            aggregated_packing_list: aggregatedPackingList
        };
    }
    // ----------------------------

    // --- SUPPLIER PORTAL ---
    async getSupplierPortalData(uuid: string) {
        const supplier = await this.poRepo.manager.findOne('Supplier', { where: { uuid } }) as any;
        if (!supplier) throw new NotFoundException('Không tìm thấy Supplier hoặc link đã hết hạn');

        // Lấy tất cả PO của supplier này
        const pos = await this.poRepo.find({
            where: { supplier_id: supplier.id },
            relations: ['items', 'items.product', 'items.material'],
            order: { created_at: 'DESC' }
        });

        // Lấy thông tin QC (Module Kiểm tra chất lượng) liên quan đến Supplier này
        const qcLogs = await this.poRepo.manager.find('QualityInspection', {
            where: { supplier_id: supplier.id },
            relations: ['defect_items'],
            order: { created_at: 'DESC' } as any
        });

        return {
            supplier,
            pos,
            qcLogs
        };
    }
}
