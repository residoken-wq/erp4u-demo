import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionOrder } from './entities/production-order.entity';
import { WorkOrder, WorkOrderStatus } from './work-order.entity';
import { WorkOrderStep } from './work-order-step.entity';
import { OutsourcingAssignment, AssignmentStatus } from './entities/outsourcing-assignment.entity';
import { InventoryService } from '../inventory/inventory.service';
import { ProductsService } from '../products/products.service';
import * as dayjs from 'dayjs';

@Injectable()
export class ProductionService {
  constructor(
    @InjectRepository(ProductionOrder) private prodRepo: Repository<ProductionOrder>,
    @InjectRepository(WorkOrder) private woRepo: Repository<WorkOrder>,
    @InjectRepository(WorkOrderStep) private stepRepo: Repository<WorkOrderStep>,
    @InjectRepository(OutsourcingAssignment) private assignRepo: Repository<OutsourcingAssignment>,
    private inventoryService: InventoryService,
    private productsService: ProductsService,
  ) {}

  async createOrder(data: any) {
      const order = this.prodRepo.create({
          code: data.code,
          product_id: data.product_id,
          pfo_id: data.pfo_id || null,
          sales_order_code: data.so_code || null,
          assigned_supplier_id: data.assigned_supplier_id || null,
          quantity: data.quantity,
          start_date: data.start_date,
          due_date: data.due_date,
          status: 'PLANNED'
      });
      const saved = await this.prodRepo.save(order);

      // --- MỚI: Auto-create WorkOrder + Steps từ Product Routing ---
      try {
          const routings = await this.productsService.getRoutings(data.product_id);
          const product = await this.productsService.findOne(data.product_id);

          if (routings && routings.length > 0 && product) {
              const wo = this.woRepo.create({
                  code: `WO-${saved.code}`,
                  product_sku: product.sku,
                  quantity: Number(data.quantity),
                  production_order_id: saved.id,
                  pfo_id: data.pfo_id || null,
                  status: WorkOrderStatus.PENDING,
                  steps: routings.map((r: any, idx: number) => ({
                      step_name: r.step_name || r.process?.name || `Step ${idx + 1}`,
                      order_index: idx + 1,
                      assigned_to: r.supplier?.name || null,
                      supplier_id: r.supplier_id || null,
                      status: 'PENDING'
                  }))
              });
              await this.woRepo.save(wo);
          }
      } catch (e) {
          console.error('Auto-create WorkOrder failed:', e);
          // Không block việc tạo ProductionOrder nếu WO fail
      }

      return saved;
  }

  async getAllOrders() {
      return this.prodRepo.find({ 
          order: { created_at: 'DESC' },
          relations: ['product', 'plan', 'work_orders', 'work_orders.steps'] 
      });
  }

  // --- MỚI: Lấy WorkOrders theo Plan ---
  async getWorkOrdersByPlan(pfoId: number) {
      return this.woRepo.find({
          where: { pfo_id: pfoId },
          relations: ['steps', 'production_order'],
          order: { created_at: 'DESC' }
      });
  }

  // --- MỚI: Lấy chi tiết WorkOrder ---
  async getWorkOrderDetail(id: number) {
      const wo = await this.woRepo.findOne({
          where: { id },
          relations: ['steps', 'production_order', 'production_order.product']
      });
      if (!wo) throw new NotFoundException('WorkOrder not found');
      return wo;
  }

  // --- MỚI: Cập nhật trạng thái step ---
  async updateStepStatus(stepId: number, status: string, data?: any) {
      const step = await this.stepRepo.findOne({ where: { id: stepId }, relations: ['work_order'] });
      if (!step) throw new NotFoundException('Step not found');

      step.status = status;
      if (status === 'IN_PROGRESS' && !step.actual_start) {
          step.actual_start = new Date();
      }
      if (status === 'COMPLETED') {
          step.actual_end = new Date();
      }
      if (data?.note) step.note = data.note;
      if (data?.supplier_id) step.supplier_id = data.supplier_id;

      await this.stepRepo.save(step);

      // Auto-update WorkOrder status
      const wo = await this.woRepo.findOne({ 
          where: { id: step.work_order.id }, 
          relations: ['steps'] 
      });
      if (wo) {
          const allCompleted = wo.steps.every(s => s.status === 'COMPLETED');
          const anyInProgress = wo.steps.some(s => s.status === 'IN_PROGRESS' || s.status === 'COMPLETED');
          
          if (allCompleted) {
              wo.status = WorkOrderStatus.COMPLETED;
          } else if (anyInProgress) {
              wo.status = WorkOrderStatus.IN_PROGRESS;
          }
          await this.woRepo.save(wo);
      }

      return step;
  }

  async deleteStep(stepId: number) {
      const step = await this.stepRepo.findOne({ where: { id: stepId } });
      if (!step) throw new NotFoundException('Step not found');
      await this.stepRepo.delete(stepId);
      return { success: true };
  }

  async startProduction(id: number) {
      const order = await this.prodRepo.findOne({ where: { id }, relations: ['product'] });
      if (!order) throw new NotFoundException('Order not found');
      if (order.status !== 'PLANNED') throw new BadRequestException('Invalid status');

      const boms = await this.productsService.getProductBOM(order.product.sku);
      
      for (const bom of boms) {
          const quantityToDeduct = Number(bom.quantity) * Number(order.quantity);
          await this.inventoryService.adjustStock(
              'EXPORT', 'MATERIAL', bom.material_id, quantityToDeduct, order.code, `Xuất sản xuất lệnh ${order.code}`,
              'KHO_NPL' 
          );
      }

      order.status = 'IN_PROGRESS';
      return this.prodRepo.save(order);
  }

  async finishProduction(id: number) {
      const order = await this.prodRepo.findOne({ where: { id } });
      if (!order) throw new NotFoundException('Order not found');
      
      await this.inventoryService.adjustStock(
          'IMPORT', 'PRODUCT', order.product_id, Number(order.quantity), order.code, `Nhập TP lệnh ${order.code}`,
          'KHO_TP'
      );

      order.status = 'COMPLETED';
      return this.prodRepo.save(order);
  }

  // =============================================
  // --- OUTSOURCING ASSIGNMENT (Multi-Supplier) ---
  // =============================================

  async createAssignment(data: any) {
    const assignment = this.assignRepo.create({
      code: data.code || `GC-${dayjs().format('YYMMDD')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      production_order_id: data.production_order_id || null,
      step_id: data.step_id || null,
      supplier_id: data.supplier_id,
      pfo_id: data.pfo_id || null,
      assigned_quantity: Number(data.assigned_quantity || 0),
      completed_quantity: 0,
      defect_quantity: 0,
      unit_price: Number(data.unit_price || 0),
      status: AssignmentStatus.PLANNED,
      deadline: data.deadline || null,
      note: data.note || null
    });
    return this.assignRepo.save(assignment);
  }

  async getAssignments(query?: { pfo_id?: number; supplier_id?: number; step_id?: number }) {
    const where: any = {};
    if (query?.pfo_id) where.pfo_id = query.pfo_id;
    if (query?.supplier_id) where.supplier_id = query.supplier_id;
    if (query?.step_id) where.step_id = query.step_id;

    return this.assignRepo.find({
      where,
      relations: ['supplier', 'production_order', 'step'],
      order: { created_at: 'DESC' }
    });
  }

  async getAssignmentDetail(id: number) {
    const a = await this.assignRepo.findOne({
      where: { id },
      relations: ['supplier', 'production_order', 'step']
    });
    if (!a) throw new NotFoundException('Phân bổ không tồn tại');
    return a;
  }

  async updateAssignment(id: number, data: any) {
    const a = await this.assignRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException('Phân bổ không tồn tại');

    if (data.status) a.status = data.status;
    if (data.completed_quantity !== undefined) a.completed_quantity = Number(data.completed_quantity);
    if (data.defect_quantity !== undefined) a.defect_quantity = Number(data.defect_quantity);
    if (data.actual_completion_date) a.actual_completion_date = data.actual_completion_date;
    if (data.note !== undefined) a.note = data.note;
    if (data.unit_price !== undefined) a.unit_price = Number(data.unit_price);

    return this.assignRepo.save(a);
  }

  async deleteAssignment(id: number) {
    const a = await this.assignRepo.findOne({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.status !== AssignmentStatus.PLANNED) {
      throw new BadRequestException('Chỉ xóa được phân bổ ở trạng thái PLANNED');
    }
    await this.assignRepo.delete(id);
    return { success: true };
  }
}
