import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ProductionFulfillmentOrder, PfoStatus } from './pfo.entity';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { WorkOrder } from '../production/work-order.entity';
import { WorkOrderStep } from '../production/work-order-step.entity';

@Injectable()
export class GanttService {
    constructor(
        @InjectRepository(ProductionFulfillmentOrder) private planRepo: Repository<ProductionFulfillmentOrder>,
        @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
        @InjectRepository(WorkOrder) private woRepo: Repository<WorkOrder>,
        @InjectRepository(WorkOrderStep) private stepRepo: Repository<WorkOrderStep>,
    ) { }

    // --- Gantt Chart: Lấy các kế hoạch chưa hoàn thiện kèm công đoạn sản phẩm ---
    async getGanttData() {
        const plans = await this.planRepo.find({
            where: { status: In([PfoStatus.DRAFT, PfoStatus.DRAFT, PfoStatus.IN_PRODUCTION]) },
            relations: [
                'sales_orders',
                'sales_orders.items',
                'sales_orders.items.product',
                'sales_orders.items.product.routings',
                'sales_orders.items.product.routings.process'
            ],
            order: { id: 'DESC' }
        });

        // Batch load POs for all plans
        const pfoIds = plans.map(p => p.id);
        let allPos: any[] = [];
        if (pfoIds.length > 0) {
            allPos = await this.poRepo.find({
                where: { pfo_id: In(pfoIds) },
                relations: ['items'],
                select: ['id', 'pfo_id', 'status', 'type']
            });
        }

        const now = new Date();

        return Promise.all(plans.map(async plan => {
            // --- NPL Status ---
            const planPos = allPos.filter(po => po.pfo_id === plan.id);
            const materialPos = planPos.filter(po => po.type === 'MATERIAL');
            const mrpItems = Array.isArray(plan.mrp_data) ? plan.mrp_data : [];
            const totalMaterials = mrpItems.filter((m: any) => (m.net_requirement || 0) > 0).length;

            const orderedMaterialIds = new Set<number>();
            for (const po of materialPos) {
                if (['ORDERED', 'CONFIRMED', 'DELIVERED', 'COMPLETED'].includes(po.status)) {
                    for (const item of (po.items || [])) {
                        if (item.material_id) orderedMaterialIds.add(item.material_id);
                    }
                }
            }
            const purchasedCount = mrpItems.filter((m: any) =>
                (m.net_requirement || 0) > 0 && orderedMaterialIds.has(m.material_id)
            ).length;

            let nplStatus: 'FULL' | 'PARTIAL' | 'NONE' = 'NONE';
            if (totalMaterials > 0 && purchasedCount >= totalMaterials) nplStatus = 'FULL';
            else if (purchasedCount > 0) nplStatus = 'PARTIAL';

            // --- Delivery Warnings ---
            const deliveryWarnings: any[] = [];
            for (const so of (plan.sales_order ? [plan.sales_order] : [])) {
                if (so.delivery_date) {
                    const deliveryDate = new Date(so.delivery_date);
                    const diffMs = deliveryDate.getTime() - now.getTime();
                    const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    if (daysLeft <= 7) {
                        deliveryWarnings.push({
                            order_code: so.order_code,
                            delivery_date: so.delivery_date,
                            days_left: daysLeft,
                            level: daysLeft <= 0 ? 'OVERDUE' : 'URGENT'
                        });
                    }
                }
            }

            // --- Products & Steps ---
            const productMap = new Map<string, { sku: string; product_name: string; steps: any[] }>();
            for (const so of (plan.sales_order ? [plan.sales_order] : [])) {
                for (const item of (so.items || [])) {
                    if (!item.product) continue;
                    const sku = item.sku || item.product.sku;
                    if (productMap.has(sku)) continue;

                    const config = plan.gantt_config?.[sku];

                    const steps = (item.product.routings || [])
                        .sort((a, b) => (a.step_order || 0) - (b.step_order || 0))
                        .map((r, idx) => {
                            const configStep = config?.steps?.find((cs: any) => cs.step_name === (r.step_name || r.process?.name));
                            return {
                                step_name: r.step_name || r.process?.name || 'N/A',
                                step_order: config?.step_order?.[idx] ?? r.step_order ?? idx,
                                process_code: r.process?.code || '',
                                supplier_name: r.supplier?.name || null,
                                start_date: configStep?.start_date || null,
                                end_date: configStep?.end_date || null
                            };
                        });

                    if (config?.step_order) {
                        steps.sort((a, b) => a.step_order - b.step_order);
                    }

                    productMap.set(sku, {
                        sku,
                        product_name: item.product.name || sku,
                        steps
                    });
                }
            }

            return {
                pfo_id: plan.id,
                plan_code: plan.code,
                plan_name: plan.name,
                start_date: plan.start_date,
                end_date: plan.end_date,
                status: plan.status,
                products: await this.enrichProductsWithProgress(Array.from(productMap.values()), plan.id),
                npl_status: { total: totalMaterials, purchased: purchasedCount, status: nplStatus },
                delivery_warnings: deliveryWarnings
            };
        }));
    }

    // --- Lưu cấu hình Gantt (step order + timing) ---
    async saveGanttConfig(pfoId: number, config: any) {
        const plan = await this.planRepo.findOneBy({ id: pfoId });
        if (!plan) throw new NotFoundException('Kế hoạch không tồn tại');
        plan.gantt_config = config;
        await this.planRepo.save(plan);
        return { message: 'Đã lưu cấu hình Gantt' };
    }

    // --- MỚI: Enrich products với live progress từ WorkOrder ---
    private async enrichProductsWithProgress(products: any[], pfoId: number) {
        try {
            // Load tất cả WO của plan này
            const workOrders = await this.woRepo.find({
                where: { pfo_id: pfoId },
                relations: ['steps']
            });

            for (const prod of products) {
                // Tìm WO matching product SKU
                const wo = workOrders.find(w => w.product_sku === prod.sku);
                if (wo && wo.steps && wo.steps.length > 0) {
                    const total = wo.steps.length;
                    const completed = wo.steps.filter(s => s.status === 'COMPLETED').length;
                    const inProgress = wo.steps.filter(s => s.status === 'IN_PROGRESS').length;
                    prod.progress = total > 0 ? Math.round(((completed + inProgress * 0.5) / total) * 100) : 0;
                    prod.wo_status = wo.status;

                    // Merge live step status vào steps
                    for (const step of prod.steps) {
                        const woStep = wo.steps.find(s => s.step_name === step.step_name);
                        if (woStep) {
                            step.live_status = woStep.status;
                            step.actual_start = woStep.actual_start;
                            step.actual_end = woStep.actual_end;
                            step.supplier_id = woStep.supplier_id;
                            step.step_note = woStep.note;
                        }
                    }
                } else {
                    prod.progress = 0;
                    prod.wo_status = null;
                }
            }
        } catch (e) {
            console.error('Enrich progress failed:', e);
        }
        return products;
    }
}
