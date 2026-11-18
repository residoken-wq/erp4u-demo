import { Perm } from '../auth/permissions.decorator';
import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ProductionService } from './production.service';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Perm('PRODUCTION', 'create')
  @Post('orders')
  createWorkOrder(@Body() body: any) {
    return this.productionService.createOrder(body);
  }

  @Perm('PRODUCTION', 'view')
  @Get('orders')
  getAllWorkOrders() {
    return this.productionService.getAllOrders();
  }

  @Perm('PRODUCTION', 'create')
  @Post('orders/:id/start')
  startWorkOrder(@Param('id') id: number) {
    return this.productionService.startProduction(id);
  }

  @Perm('PRODUCTION', 'create')
  @Post('orders/:id/complete')
  completeWorkOrder(@Param('id') id: number) {
    return this.productionService.finishProduction(id);
  }

  // --- WorkOrder APIs ---
  @Perm('PRODUCTION', 'view')
  @Get('work-orders/plan/:pfoId')
  getWorkOrdersByPlan(@Param('pfoId') pfoId: number) {
    return this.productionService.getWorkOrdersByPlan(pfoId);
  }

  @Perm('PRODUCTION', 'view')
  @Get('work-orders/:id')
  getWorkOrderDetail(@Param('id') id: number) {
    return this.productionService.getWorkOrderDetail(id);
  }

  @Perm('PRODUCTION', 'update')
  @Put('steps/:stepId/status')
  updateStepStatus(@Param('stepId') stepId: number, @Body() body: any) {
    return this.productionService.updateStepStatus(stepId, body.status, body);
  }

  @Perm('PRODUCTION', 'delete')
  @Delete('steps/:stepId')
  deleteStep(@Param('stepId') stepId: number) {
    return this.productionService.deleteStep(stepId);
  }

  // =============================================
  // --- OUTSOURCING ASSIGNMENT (Multi-Supplier) ---
  // =============================================

  @Perm('PRODUCTION', 'create')
  @Post('assignments')
  createAssignment(@Body() body: any) {
    return this.productionService.createAssignment(body);
  }

  @Perm('PRODUCTION', 'view')
  @Get('assignments')
  getAssignments(
    @Query('pfo_id') pfoId?: string,
    @Query('supplier_id') supplierId?: string,
    @Query('step_id') stepId?: string
  ) {
    const query: any = {};
    if (pfoId) query.pfo_id = Number(pfoId);
    if (supplierId) query.supplier_id = Number(supplierId);
    if (stepId) query.step_id = Number(stepId);
    return this.productionService.getAssignments(query);
  }

  @Perm('PRODUCTION', 'view')
  @Get('assignments/:id')
  getAssignmentDetail(@Param('id') id: string) {
    return this.productionService.getAssignmentDetail(Number(id));
  }

  @Perm('PRODUCTION', 'update')
  @Put('assignments/:id')
  updateAssignment(@Param('id') id: string, @Body() body: any) {
    return this.productionService.updateAssignment(Number(id), body);
  }

  @Perm('PRODUCTION', 'delete')
  @Delete('assignments/:id')
  deleteAssignment(@Param('id') id: string) {
    return this.productionService.deleteAssignment(Number(id));
  }
}
