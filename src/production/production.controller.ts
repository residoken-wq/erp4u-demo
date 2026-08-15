import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ProductionService } from './production.service';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post('orders')
  createWorkOrder(@Body() body: any) {
    return this.productionService.createOrder(body);
  }

  @Get('orders')
  getAllWorkOrders() {
    return this.productionService.getAllOrders();
  }

  @Post('orders/:id/start')
  startWorkOrder(@Param('id') id: number) {
    return this.productionService.startProduction(id);
  }

  @Post('orders/:id/complete')
  completeWorkOrder(@Param('id') id: number) {
    return this.productionService.finishProduction(id);
  }

  // --- WorkOrder APIs ---
  @Get('work-orders/plan/:pfoId')
  getWorkOrdersByPlan(@Param('pfoId') pfoId: number) {
    return this.productionService.getWorkOrdersByPlan(pfoId);
  }

  @Get('work-orders/:id')
  getWorkOrderDetail(@Param('id') id: number) {
    return this.productionService.getWorkOrderDetail(id);
  }

  @Put('steps/:stepId/status')
  updateStepStatus(@Param('stepId') stepId: number, @Body() body: any) {
    return this.productionService.updateStepStatus(stepId, body.status, body);
  }

  @Delete('steps/:stepId')
  deleteStep(@Param('stepId') stepId: number) {
    return this.productionService.deleteStep(stepId);
  }

  // =============================================
  // --- OUTSOURCING ASSIGNMENT (Multi-Supplier) ---
  // =============================================

  @Post('assignments')
  createAssignment(@Body() body: any) {
    return this.productionService.createAssignment(body);
  }

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

  @Get('assignments/:id')
  getAssignmentDetail(@Param('id') id: string) {
    return this.productionService.getAssignmentDetail(Number(id));
  }

  @Put('assignments/:id')
  updateAssignment(@Param('id') id: string, @Body() body: any) {
    return this.productionService.updateAssignment(Number(id), body);
  }

  @Delete('assignments/:id')
  deleteAssignment(@Param('id') id: string) {
    return this.productionService.deleteAssignment(Number(id));
  }
}
