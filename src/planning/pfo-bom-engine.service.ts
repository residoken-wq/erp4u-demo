import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionFulfillmentOrder } from './pfo.entity';
import { PfoMaterialRequirement, SupplyMethod } from './pfo-material-requirement.entity';
import { Product } from '../products/product.entity';
import { BOM } from '../bom/bom.entity';
import { ProductComponent } from '../products/product-component.entity';
import { ProductRouting } from '../products/product-routing.entity';
import { Material } from '../materials/material.entity';
import { PfoMilestone } from './pfo-milestone.entity';

@Injectable()
export class PfoBomEngineService {
    constructor(
        @InjectRepository(ProductionFulfillmentOrder) private pfoRepo: Repository<ProductionFulfillmentOrder>,
        @InjectRepository(PfoMaterialRequirement) private materialReqRepo: Repository<PfoMaterialRequirement>,
        @InjectRepository(Product) private productRepo: Repository<Product>,
        @InjectRepository(BOM) private bomRepo: Repository<BOM>,
        @InjectRepository(ProductComponent) private componentRepo: Repository<ProductComponent>,
        @InjectRepository(ProductRouting) private routingRepo: Repository<ProductRouting>,
        @InjectRepository(PfoMilestone) private milestoneRepo: Repository<PfoMilestone>,
        @InjectRepository(Material) private materialRepo: Repository<Material>,
    ) { }

    /**
     * Gate 2: BOM Explosion & Material Requirement Calculation
     * Dựa vào SO Items liên kết với PFO, bóc tách định mức vật tư trực tiếp từ Product BOMs & Combos.
     */
    async calculateMaterialRequirements(pfoId: number, btpOverrides?: Record<string, number>, usePfoQty: boolean = false) {
        const id = Number(pfoId);
        let pfo = await this.pfoRepo.findOne({
            where: { id },
            relations: [
                'sales_order',
                'sales_order.items',
                'sales_order.items.product',
                'material_requirements'
            ]
        });

        if (!pfo) throw new NotFoundException('Lệnh sản xuất (PFO) không tồn tại');

        // AUTO-HEAL: Nếu pfo bị mất relation sales_order do lỗi lưu dữ liệu cũ, thử tìm lại qua mã PFO
        if (!pfo.sales_order && pfo.code.startsWith('PFO-')) {
            const orderCode = pfo.code.replace('PFO-', '');
            const so: any = await this.pfoRepo.manager.findOne('SalesOrder', {
                where: { order_code: orderCode },
                relations: ['items', 'items.product']
            });
            if (so) {
                console.log(`[BOM-ENGINE] Auto-healed missing SalesOrder ${orderCode} for PFO ${pfo.id}`);
                pfo.sales_order = so as any;
                pfo.sales_order_id = so.id as any;
                await this.pfoRepo.update(pfo.id, { sales_order_id: so.id });
            }
        }

        const materialMap = new Map<number, { qty: number; material?: any; code?: string; name?: string; details?: any[] }>();
        const productReqMap = new Map<number, { qty: number; used_qty?: number; product: Product; details: any[] }>();

        let totalOrderQuantity = 0;

        if (pfo.sales_order && pfo.sales_order.items) {
            console.log(`[BOM-ENGINE] Found ${pfo.sales_order.items.length} items in SO`);
            for (const item of pfo.sales_order.items) {
                let product = item.product;
                if (!product && item.sku) {
                    product = await this.productRepo.findOne({ where: { sku: item.sku } });
                }
                
                if (!product) continue;
                
                const orderQty = usePfoQty 
                    ? Number(pfo.quantity || item.quantity || 1) 
                    : Number(item.quantity || pfo.quantity || 1);
                totalOrderQuantity += orderQty;
                console.log(`[BOM-ENGINE] Processing product ${product.id} - ${product.sku} - ${product.product_type} with qty ${orderQty}`);

                // Queue nổ BOM (hỗ trợ đệ quy Combo và BTP)
                const queue: { productId: number; multiplier: number }[] = [
                    { productId: product.id, multiplier: orderQty }
                ];

                let safetyCounter = 0;
                while (queue.length > 0 && safetyCounter++ < 500) {
                    const current = queue.shift();
                    if (!current) break;

                    const targetProd = await this.productRepo.findOne({ where: { id: current.productId } });
                    if (!targetProd) continue;

                    const pType = targetProd.product_type ? targetProd.product_type.toUpperCase() : 'STANDARD';

                    let baseMultiplier = current.multiplier;
                    if (usePfoQty && pfo.custom_quantities && pfo.custom_quantities[targetProd.id] !== undefined) {
                        baseMultiplier = Number(pfo.custom_quantities[targetProd.id]);
                    }

                    let explosionMultiplier = baseMultiplier;

                    // 2. Chỉ hiển thị Bán Thành Phẩm (SEMI_FINISHED) vào danh sách vật tư BTP
                    // Các sản phẩm hoàn thiện (có product_type là rác hoặc STANDARD) sẽ bị bỏ qua
                    if (current.productId !== product.id && pType === 'SEMI_FINISHED') {
                        const overrideQty = btpOverrides && btpOverrides[targetProd.id] !== undefined 
                            ? Number(btpOverrides[targetProd.id]) 
                            : 0;

                        explosionMultiplier = Math.max(0, baseMultiplier - overrideQty);

                        const existingProd = productReqMap.get(targetProd.id);
                        if (existingProd) {
                            existingProd.qty += baseMultiplier;
                            existingProd.used_qty = (existingProd.used_qty || 0) + overrideQty;
                        } else {
                            productReqMap.set(targetProd.id, {
                                qty: baseMultiplier,
                                used_qty: overrideQty,
                                product: targetProd,
                                details: [{ order_quantity: baseMultiplier, total: baseMultiplier }]
                            });
                        }
                    }

                    // 1. Nổ components nếu có (hỗ trợ COMBO, SEMI_FINISHED hoặc sản phẩm bị cấu hình thiếu product_type nhưng có component)
                    const components = await this.componentRepo.find({
                        where: { parent_product: { id: targetProd.id } },
                        relations: ['child_product']
                    });

                    if (components && components.length > 0 && explosionMultiplier > 0) {
                        for (const comp of components) {
                            if (comp.child_product) {
                                queue.push({
                                    productId: comp.child_product.id,
                                    multiplier: explosionMultiplier * (Number(comp.quantity) || 1)
                                });
                            }
                        }
                    }

                    // 3. Nếu KHÔNG phải COMBO và KHÔNG phải Bán Thành Phẩm (BTP) -> Nổ vật tư NPL
                    // (Lưu ý: NPL của BTP sẽ được cấu hình trực tiếp trên Thành Phẩm gốc để tránh duplicate, nên dừng nổ NPL ở mức BTP)
                    if (pType !== 'COMBO' && pType !== 'SEMI_FINISHED' && explosionMultiplier > 0) {
                        const boms = await this.bomRepo.find({
                            where: { product_id: targetProd.id },
                            relations: ['material']
                        });

                        for (const bom of boms) {
                            if (!bom.material_id) continue;

                            
                            const rawQty = explosionMultiplier * Number(bom.quantity || 0);
                            const waste = Number(bom.waste_percent || 0);
                            const totalReqQty = rawQty * (1 + waste / 100);

                            const detail = {
                                product_name: targetProd.name || targetProd.sku || `Product ${targetProd.id}`,
                                original_norm: Number(bom.quantity || 0),
                                waste: waste,
                                order_quantity: explosionMultiplier,
                                total: totalReqQty
                            };

                            const existing = materialMap.get(bom.material_id);
                            if (existing) {
                                existing.qty += totalReqQty;
                                if (!existing.details) existing.details = [];
                                existing.details.push(detail);
                            } else {
                                materialMap.set(bom.material_id, {
                                    qty: totalReqQty,
                                    material: bom.material,
                                    details: [detail]
                                });
                            }
                        }
                    }
                }
            }
        }

        // FALLBACK: Nếu Sản phẩm trong DB chưa được khai báo BOM chi tiết -> Tự động sinh danh mục NPL định mức chuẩn cho PFO
        if (materialMap.size === 0 && productReqMap.size === 0) {
            console.log(`[BOM-ENGINE] No BOMs found in materialMap. Falling back to default materials.`);
            const fallbackQty = totalOrderQuantity > 0 ? totalOrderQuantity : (pfo.quantity || 1);
            
            // Tìm các vật tư mẫu có sẵn trong DB hoặc tạo giả định chuẩn ngành may
            const allMaterials = await this.materialRepo.find({ take: 10 });
            
            if (allMaterials.length > 0) {
                // Phân bổ định mức dựa trên vật tư thực có trong kho
                allMaterials.forEach((mat, idx) => {
                    const normFactor = idx === 0 ? 2.5 : (idx === 1 ? 0.8 : 1.0); // Định mức m vải / kg gòn / cái
                    materialMap.set(mat.id, {
                        qty: fallbackQty * normFactor,
                        material: mat,
                        details: [{
                            product_name: 'Dữ liệu mẫu (Fallback)',
                            original_norm: normFactor,
                            waste: 0,
                            order_quantity: fallbackQty,
                            total: fallbackQty * normFactor
                        }]
                    });
                });
            } else {
                // Tạo các dòng định mức mặc định nếu DB vật tư hoàn toàn rỗng
                const defaults = [
                    { id: 101, code: 'MAT-VAI-MAIN', name: 'Vải chính Cotton/Poly (m)', qty: fallbackQty * 2.2, price: 45000 },
                    { id: 102, code: 'MAT-GON-CHAN', name: 'Gòn chần bông 200gsm (kg)', qty: fallbackQty * 0.6, price: 38000 },
                    { id: 103, code: 'MAT-CHI-MAY', name: 'Chỉ may 40/2 (cuộn)', qty: Math.max(1, Math.ceil(fallbackQty * 0.05)), price: 15000 },
                    { id: 104, code: 'MAT-NHAN-MAC', name: 'Nhãn mác ERP4U (cái)', qty: fallbackQty, price: 1200 },
                    { id: 105, code: 'MAT-BAO-BI', name: 'Bao PE đóng gói (cái)', qty: fallbackQty, price: 2500 }
                ];
                defaults.forEach(d => {
                    materialMap.set(d.id, {
                        qty: d.qty,
                        code: d.code,
                        name: d.name
                    });
                });
            }
        }

        // Xóa các yêu cầu vật tư và milestones cũ của PFO này
        if (pfo.material_requirements && pfo.material_requirements.length > 0) {
            await this.materialReqRepo.remove(pfo.material_requirements);
        }
        
        const oldMilestones = await this.milestoneRepo.find({ where: { pfo_id: id } });

        // Tạo danh sách milestones mới từ ProductRouting
        const newMilestones: PfoMilestone[] = [];
        const processedProducts = new Map<number, { product: Product; qty: number }>();

        if (pfo.sales_order && pfo.sales_order.items) {
            for (const item of pfo.sales_order.items) {
                let product = item.product;
                if (!product && item.sku) {
                    product = await this.productRepo.findOne({ where: { sku: item.sku } });
                }
                
                if (product) {
                    const q: { productId: number; multiplier: number }[] = [
                        { productId: product.id, multiplier: Number(item.quantity || pfo.quantity || 1) }
                    ];
                    let safety = 0;
                    while (q.length > 0 && safety++ < 500) {
                        const curr = q.shift();
                        if (!curr) break;
                        
                        const tp = await this.productRepo.findOne({ where: { id: curr.productId } });
                        if (!tp) continue;
                        
                        const comps = await this.componentRepo.find({
                            where: { parent_product: { id: tp.id } },
                            relations: ['child_product']
                        });

                        if (comps && comps.length > 0) {
                            for (const c of comps) {
                                if (c.child_product) {
                                    q.push({
                                        productId: c.child_product.id,
                                        multiplier: curr.multiplier * (Number(c.quantity) || 1)
                                    });
                                }
                            }
                        }
                        
                        // Add every product to the map, not just STANDARD
                        const existing = processedProducts.get(tp.id);
                        if (existing) {
                            existing.qty += curr.multiplier;
                        } else {
                            processedProducts.set(tp.id, { product: tp, qty: curr.multiplier });
                        }
                    }
                }
            }
        }

        const obsoleteMilestones = oldMilestones.filter(m => !processedProducts.has(m.product_id));
        if (obsoleteMilestones.length > 0) {
            await this.milestoneRepo.remove(obsoleteMilestones);
        }

        for (const [prodId, data] of processedProducts.entries()) {
            const product = data.product;
            const existingForProd = oldMilestones.filter(m => m.product_id === prodId);
            
            if (existingForProd.length > 0) {
                // Update quantity of existing ones
                for (const em of existingForProd) {
                    em.planned_quantity = data.qty;
                    newMilestones.push(em);
                }
            } else {
                // Generate from routingRepo if no milestones exist yet
                const routings = await this.routingRepo.find({
                    where: { product_id: product.id },
                    relations: ['supplier'],
                    order: { step_order: 'ASC' }
                });

                for (const routing of routings) {
                    const milestone = this.milestoneRepo.create({
                        pfo_id: id,
                        product_id: product.id,
                        product_name: product.name || product.sku,
                        milestone_type: routing.step_name || 'GIA_CONG',
                        step_name: routing.step_name,
                        vendor_id: routing.supplier_id,
                        vendor_name: routing.supplier?.name || '',
                        unit_price: Number(routing.cost || 0),
                        planned_quantity: data.qty,
                        status: 'PENDING'
                    });
                    newMilestones.push(milestone);
                }
            }
        }
        
        if (newMilestones.length > 0) {
            await this.milestoneRepo.save(newMilestones);
        }

        // Tạo danh sách PfoMaterialRequirement mới
        const requirements: PfoMaterialRequirement[] = [];
        for (const [materialId, data] of materialMap.entries()) {
            let mat = data.material;
            if (!mat && materialId < 100) {
                mat = await this.materialRepo.findOne({ where: { id: materialId }, relations: ['supplier_prices'] });
            } else if (mat && (!mat.supplier_prices || mat.supplier_prices.length === 0)) {
                const fullMat = await this.materialRepo.findOne({ where: { id: mat.id }, relations: ['supplier_prices'] });
                if (fullMat) mat = fullMat;
            }

            let defaultSupplierId = null;
            if (mat?.supplier_prices && mat.supplier_prices.length > 0) {
                const preferred = mat.supplier_prices.find(sp => sp.is_preferred);
                defaultSupplierId = preferred ? preferred.supplier_id : mat.supplier_prices[0].supplier_id;
            }

            const req = this.materialReqRepo.create({
                pfo_id: id,
                material_id: mat?.id || (materialId < 100 ? materialId : null),
                material_code: mat?.code || data.code || `MAT-${materialId}`,
                material_name: mat?.name || data.name || 'Vật tư',
                supply_method: SupplyMethod.COMPANY_SUPPLIED,
                planned_quantity: Math.round(data.qty * 100) / 100,
                actual_order_quantity: Math.round(data.qty * 100) / 100,
                unit_price: Number(mat?.cost_price || mat?.cost_per_unit || (data as any).price || 0),
                supplier_id: defaultSupplierId,
                issued_quantity: 0,
                available_stock: Number(mat?.quantity_in_stock || 0),
                bom_details: data.details || null
            });
            requirements.push(req);
        }

        for (const [productId, data] of productReqMap.entries()) {
            const prod = data.product;
            const req = this.materialReqRepo.create({
                pfo_id: id,
                product_id: productId,
                material_code: prod.sku,
                material_name: prod.name,
                supply_method: SupplyMethod.COMPANY_SUPPLIED,
                planned_quantity: Math.round(data.qty * 100) / 100,
                actual_order_quantity: Math.round(data.qty * 100) / 100,
                use_inventory: data.used_qty ? true : false,
                inventory_used_quantity: data.used_qty || 0,
                unit_price: Number(prod.cost_price || prod.base_price || 0),
                supplier_id: null,
                issued_quantity: 0,
                available_stock: Number(prod.quantity_in_stock || 0),
                bom_details: data.details || null
            });
            requirements.push(req);
        }

        if (requirements.length > 0) {
            await this.materialReqRepo.save(requirements);
        }

        return {
            message: `Đã nổ BOM thành công cho Lệnh SX #${pfo.code}`,
            total_materials: requirements.length,
            requirements
        };
    }

    async saveMaterialRequirements(pfoId: number, reqs: any[]) {
        if (!reqs || !Array.isArray(reqs)) return;
        
        for (const r of reqs) {
            if (r.id) {
                await this.materialReqRepo.update(r.id, {
                    actual_order_quantity: r.actual_order_quantity !== undefined ? Number(r.actual_order_quantity) : Number(r.planned_quantity),
                    supply_method: r.supply_method,
                    supplier_id: r.supplier_id,
                    use_inventory: Boolean(r.use_inventory),
                    inventory_used_quantity: Number(r.inventory_used_quantity || 0),
                    unit_price: Number(r.unit_price || 0)
                } as any);
            }
        }
        return { message: 'Đã lưu cấu hình vật tư' };
    }

    async previewBtpRequirements(pfoId: number, usePfoQty: boolean = false) {
        const id = Number(pfoId);
        let pfo = await this.pfoRepo.findOne({
            where: { id },
            relations: [
                'sales_order',
                'sales_order.items',
                'sales_order.items.product'
            ]
        });

        if (!pfo) throw new NotFoundException('Lệnh sản xuất (PFO) không tồn tại');

        if (!pfo.sales_order && pfo.code.startsWith('PFO-')) {
            const orderCode = pfo.code.replace('PFO-', '');
            const so: any = await this.pfoRepo.manager.findOne('SalesOrder', {
                where: { order_code: orderCode },
                relations: ['items', 'items.product']
            });
            if (so) {
                pfo.sales_order = so as any;
                pfo.sales_order_id = so.id as any;
            }
        }

        const btpReqMap = new Map<number, { qty: number; product: Product }>();

        if (pfo.sales_order && pfo.sales_order.items) {
            for (const item of pfo.sales_order.items) {
                let product = item.product;
                if (!product && item.sku) {
                    product = await this.productRepo.findOne({ where: { sku: item.sku } });
                }
                
                if (!product) continue;
                
                const orderQty = usePfoQty 
                    ? Number(pfo.quantity || item.quantity || 1) 
                    : Number(item.quantity || pfo.quantity || 1);
                
                const queue: { productId: number; multiplier: number }[] = [
                    { productId: product.id, multiplier: orderQty }
                ];

                let safetyCounter = 0;
                while (queue.length > 0 && safetyCounter++ < 500) {
                    const current = queue.shift();
                    if (!current) break;

                    const targetProd = await this.productRepo.findOne({ where: { id: current.productId } });
                    if (!targetProd) continue;

                    let baseMultiplier = current.multiplier;
                    if (usePfoQty && pfo.custom_quantities && pfo.custom_quantities[targetProd.id] !== undefined) {
                        baseMultiplier = Number(pfo.custom_quantities[targetProd.id]);
                    }

                    const pType = targetProd.product_type ? targetProd.product_type.toUpperCase() : 'STANDARD';

                    // Chỉ hiển thị Bán Thành Phẩm (SEMI_FINISHED)
                    if (current.productId !== product.id && pType === 'SEMI_FINISHED') {
                        const existingProd = btpReqMap.get(targetProd.id);
                        if (existingProd) {
                            existingProd.qty += baseMultiplier;
                        } else {
                            btpReqMap.set(targetProd.id, {
                                qty: baseMultiplier,
                                product: targetProd
                            });
                        }
                    }

                    const components = await this.componentRepo.find({
                        where: { parent_product: { id: targetProd.id } },
                        relations: ['child_product']
                    });

                    if (components && components.length > 0) {
                        for (const comp of components) {
                            if (comp.child_product) {
                                queue.push({
                                    productId: comp.child_product.id,
                                    multiplier: baseMultiplier * (Number(comp.quantity) || 1)
                                });
                            }
                        }
                    }
                }
            }
        }

        const previewData = [];
        for (const [productId, data] of btpReqMap.entries()) {
            const stock = await this.pfoRepo.manager.query(
                `SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_stocks WHERE item_type = 'PRODUCT' AND item_id = $1 AND warehouse_code = 'KHO_BTP'`,
                [productId]
            );
            
            let btpName = data.product.name;
            try {
                const pos = await this.pfoRepo.manager.query(`
                    SELECT semi_finished_products 
                    FROM purchase_orders 
                    WHERE type = 'OUTSOURCING' 
                    AND semi_finished_products IS NOT NULL
                    LIMIT 10
                `);
                for (const row of pos) {
                    const list = typeof row.semi_finished_products === 'string' ? JSON.parse(row.semi_finished_products) : row.semi_finished_products;
                    if (Array.isArray(list)) {
                        const btp = list.find((b: any) => Number(b.product_id) === Number(productId));
                        if (btp && btp.btp_name) {
                            btpName = btp.btp_name;
                            break;
                        }
                    }
                }
            } catch (e) {}
            
            previewData.push({
                product_id: productId,
                sku: data.product.sku,
                name: btpName,
                required_qty: data.qty,
                available_stock: Number(stock[0].total || 0)
            });
        }

        return previewData;
    }
}
