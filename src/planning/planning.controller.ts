import { Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Param, Body, Delete, Query } from '@nestjs/common';
import { PlanningService } from './planning.service';
import { PfoDemandService } from './pfo-demand.service';
import { PfoBomEngineService } from './pfo-bom-engine.service';
import { PfoSourcingService } from './pfo-sourcing.service';
import { PfoExecutionService } from './pfo-execution.service';

@Controller('planning')
export class PlanningController {
  constructor(
    private readonly planningSvc: PlanningService,
    private readonly demandSvc: PfoDemandService,
    private readonly bomSvc: PfoBomEngineService,
    private readonly sourcingSvc: PfoSourcingService,
    private readonly execSvc: PfoExecutionService
  ) { }

  // ============================================================
  // STATIC ROUTES FIRST (phải đặt trước :id để tránh route conflict)
  // ============================================================

  // --- GENERAL PLANNING / BOOKING APIs ---
  @Perm('PRODUCTION', 'view')
  @Get() findAll() { return this.planningSvc.findAll(); }
  @Perm('PRODUCTION', 'view')
  @Get('suggestion') getSuggestion() { return this.planningSvc.getSuggestion(); }
  @Perm('PRODUCTION', 'view')
  @Get('booking-stats') getBookingStats(@Query('month') month?: string, @Query('year') year?: string) { return this.planningSvc.getBookingStats(month, year); }
  @Perm('PRODUCTION', 'view')
  @Get('bookings') getAllBookings() { return this.planningSvc.getAllBookings(); }
  @Perm('PRODUCTION', 'view')
  @Get('bookings/:sku') getBookingsBySku(@Param('sku') sku: string) { return this.planningSvc.getBookingsBySku(sku); }
  @Perm('PRODUCTION', 'view')
  @Get('gantt') getGantt() { return this.planningSvc.getGanttData(); }
  @Perm('PRODUCTION', 'create')
  @Post('sync-booking-stock') syncBookingStock() { return this.planningSvc.syncBookingStock(); }

  // --- PFO DEMAND APIs (Gate 1) ---
  @Perm('PRODUCTION', 'view')
  @Get('demand/npl')
  getNplDemand() {
    return this.demandSvc.getNplDemandDashboard();
  }

  @Perm('PRODUCTION', 'view')
  @Get('demand/gc')
  getGcDemand() {
    return this.demandSvc.getGcDemandDashboard();
  }

  @Perm('PRODUCTION', 'view')
  @Get('pfo/suggestions')
  getPfoSuggestions() {
    return this.demandSvc.getDemandSuggestions();
  }

  @Perm('PRODUCTION', 'create')
  @Post('pfo/generate')
  async generatePfo(@Body() b: any) {
    const pfo = await this.demandSvc.generatePfo(b);
    if (pfo && pfo.id) {
        await this.bomSvc.calculateMaterialRequirements(pfo.id);
    }
    return pfo;
  }

  // --- PFO EXECUTION APIs (Gate 6) - static path ---
  @Perm('PRODUCTION', 'create')
  @Post('pfo/material-issue/:reqId')
  updateMaterialIssue(@Param('reqId') reqId: number, @Body('issue_qty') issueQty: number) {
    return this.execSvc.updateMaterialIssue(reqId, issueQty);
  }

  // ============================================================
  // PARAMETERIZED ROUTES (:id) - phải đặt SAU static routes
  // ============================================================

  // --- PFO Detail ---
  @Perm('PRODUCTION', 'view')
  @Get('pfo/:id')
  getPfoDetails(@Param('id') id: string) {
    return this.demandSvc.getPfoDetails(Number(id));
  }

  @Perm('PRODUCTION', 'delete')
  @Delete('pfo/:id')
  deletePfo(@Param('id') id: string) {
    return this.demandSvc.deletePfo(Number(id));
  }

  @Perm('PRODUCTION', 'update')
  @Put('pfo/:id/status')
  updatePfoStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.planningSvc.updatePfoStatus(Number(id), status);
  }

  @Perm('PRODUCTION', 'update')
  @Put('pfo/:id/quantity')
  updatePfoQuantity(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.planningSvc.updatePfoQuantity(Number(id), quantity);
  }

  @Perm('PRODUCTION', 'update')
  @Put('pfo/:id/custom-quantities')
  updatePfoCustomQuantities(@Param('id') id: string, @Body('custom_quantities') customQuantities: Record<string, number>) {
    return this.planningSvc.updatePfoCustomQuantities(Number(id), customQuantities);
  }

  // --- PFO BOM APIs (Gate 2) ---
  @Perm('PRODUCTION', 'view')
  @Get('pfo/:id/preview-btp')
  previewBtpRequirements(@Param('id') id: string, @Query('usePfoQty') usePfoQty?: string) {
    return this.bomSvc.previewBtpRequirements(Number(id), usePfoQty === 'true');
  }

  @Perm('PRODUCTION', 'view')
  @Post('pfo/:id/calculate-bom')
  calculateBom(
    @Param('id') id: string, 
    @Body('btpOverrides') btpOverrides?: Record<string, number>,
    @Body('usePfoQty') usePfoQty?: boolean
  ) {
    return this.bomSvc.calculateMaterialRequirements(Number(id), btpOverrides, usePfoQty);
  }

  @Perm('PRODUCTION', 'create')
  @Post('pfo/:id/save-requirements')
  saveRequirements(@Param('id') id: string, @Body('requirements') reqs: any[]) {
    return this.bomSvc.saveMaterialRequirements(Number(id), reqs);
  }

  @Perm('PRODUCTION', 'create')
  @Post('pfo/:id/request-material')
  requestMaterial(@Param('id') id: string, @Body() data: any) {
    return this.planningSvc.requestAdditionalMaterial(Number(id), data);
  }

  // --- PFO SOURCING APIs (Gate 3, 4, 5) ---
  @Perm('PRODUCTION', 'create')
  @Post('pfo/:id/assign-vendor')
  assignVendor(@Param('id') id: string, @Body('vendor_id') vendorId: number) {
    return this.sourcingSvc.assignVendor(Number(id), vendorId);
  }

  @Perm('PRODUCTION', 'create')
  @Post('pfo/:id/process-routing')
  updateProcessRouting(@Param('id') id: string, @Body() body: any) {
    const routingData = Array.isArray(body) ? body : (body?.routing || []);
    return this.sourcingSvc.updateProcessRouting(Number(id), routingData);
  }

  @Perm('PRODUCTION', 'create')
  @Post('pfo/:id/generate-pos')
  generatePos(@Param('id') id: string) {
    return this.sourcingSvc.generatePos(Number(id));
  }

  @Perm('PRODUCTION', 'view')
  @Get('pfo/:id/pos')
  getPos(@Param('id') id: string) {
    return this.sourcingSvc.getPos(Number(id));
  }

  @Perm('PRODUCTION', 'view')
  @Get('pfo/:id/pxks')
  getPxks(@Param('id') id: string) {
    return this.sourcingSvc.getPxks(Number(id));
  }

  // --- PFO EXECUTION APIs (Gate 7-10) ---
  @Perm('PRODUCTION', 'create')
  @Post('pfo/:id/milestone')
  updateMilestone(@Param('id') id: number, @Body() b: any) {
    return this.execSvc.updateMilestone(id, b.milestone_type, b.data);
  }

  @Perm('PRODUCTION', 'create')
  @Post('pfo/:id/qc')
  submitQcRecord(@Param('id') id: number, @Body() b: any) {
    return this.execSvc.submitQcRecord(id, b);
  }

  // --- LEGACY: Booking APIs (cần :id param) ---
  @Perm('PRODUCTION', 'view')
  @Get(':id/booking-items') getBookingItemsWithStock(@Param('id') id: number) { return this.planningSvc.getBookingItemsWithStock(Number(id)); }
  @Perm('PRODUCTION', 'update')
  @Post(':id/confirm-bookings') confirmBookings(@Param('id') id: number, @Body('itemIds') itemIds?: number[]) { return this.planningSvc.confirmBookings(id, itemIds); }
  @Perm('PRODUCTION', 'update')
  @Post('bookings/:itemId/revert') revertBooking(@Param('itemId') itemId: number) { return this.planningSvc.revertBooking(Number(itemId)); }
}
