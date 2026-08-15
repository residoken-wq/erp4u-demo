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
  @Get() findAll() { return this.planningSvc.findAll(); }
  @Get('suggestion') getSuggestion() { return this.planningSvc.getSuggestion(); }
  @Get('booking-stats') getBookingStats(@Query('month') month?: string, @Query('year') year?: string) { return this.planningSvc.getBookingStats(month, year); }
  @Get('bookings') getAllBookings() { return this.planningSvc.getAllBookings(); }
  @Get('bookings/:sku') getBookingsBySku(@Param('sku') sku: string) { return this.planningSvc.getBookingsBySku(sku); }
  @Get('gantt') getGantt() { return this.planningSvc.getGanttData(); }
  @Post('sync-booking-stock') syncBookingStock() { return this.planningSvc.syncBookingStock(); }

  // --- PFO DEMAND APIs (Gate 1) ---
  @Get('demand/npl')
  getNplDemand() {
    return this.demandSvc.getNplDemandDashboard();
  }

  @Get('demand/gc')
  getGcDemand() {
    return this.demandSvc.getGcDemandDashboard();
  }

  @Get('pfo/suggestions')
  getPfoSuggestions() {
    return this.demandSvc.getDemandSuggestions();
  }

  @Post('pfo/generate')
  async generatePfo(@Body() b: any) {
    const pfo = await this.demandSvc.generatePfo(b);
    if (pfo && pfo.id) {
        await this.bomSvc.calculateMaterialRequirements(pfo.id);
    }
    return pfo;
  }

  // --- PFO EXECUTION APIs (Gate 6) - static path ---
  @Post('pfo/material-issue/:reqId')
  updateMaterialIssue(@Param('reqId') reqId: number, @Body('issue_qty') issueQty: number) {
    return this.execSvc.updateMaterialIssue(reqId, issueQty);
  }

  // ============================================================
  // PARAMETERIZED ROUTES (:id) - phải đặt SAU static routes
  // ============================================================

  // --- PFO Detail ---
  @Get('pfo/:id')
  getPfoDetails(@Param('id') id: string) {
    return this.demandSvc.getPfoDetails(Number(id));
  }

  @Delete('pfo/:id')
  deletePfo(@Param('id') id: string) {
    return this.demandSvc.deletePfo(Number(id));
  }

  @Put('pfo/:id/status')
  updatePfoStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.planningSvc.updatePfoStatus(Number(id), status);
  }

  @Put('pfo/:id/quantity')
  updatePfoQuantity(@Param('id') id: string, @Body('quantity') quantity: number) {
    return this.planningSvc.updatePfoQuantity(Number(id), quantity);
  }

  @Put('pfo/:id/custom-quantities')
  updatePfoCustomQuantities(@Param('id') id: string, @Body('custom_quantities') customQuantities: Record<string, number>) {
    return this.planningSvc.updatePfoCustomQuantities(Number(id), customQuantities);
  }

  // --- PFO BOM APIs (Gate 2) ---
  @Get('pfo/:id/preview-btp')
  previewBtpRequirements(@Param('id') id: string, @Query('usePfoQty') usePfoQty?: string) {
    return this.bomSvc.previewBtpRequirements(Number(id), usePfoQty === 'true');
  }

  @Post('pfo/:id/calculate-bom')
  calculateBom(
    @Param('id') id: string, 
    @Body('btpOverrides') btpOverrides?: Record<string, number>,
    @Body('usePfoQty') usePfoQty?: boolean
  ) {
    return this.bomSvc.calculateMaterialRequirements(Number(id), btpOverrides, usePfoQty);
  }

  @Post('pfo/:id/save-requirements')
  saveRequirements(@Param('id') id: string, @Body('requirements') reqs: any[]) {
    return this.bomSvc.saveMaterialRequirements(Number(id), reqs);
  }

  @Post('pfo/:id/request-material')
  requestMaterial(@Param('id') id: string, @Body() data: any) {
    return this.planningSvc.requestAdditionalMaterial(Number(id), data);
  }

  // --- PFO SOURCING APIs (Gate 3, 4, 5) ---
  @Post('pfo/:id/assign-vendor')
  assignVendor(@Param('id') id: string, @Body('vendor_id') vendorId: number) {
    return this.sourcingSvc.assignVendor(Number(id), vendorId);
  }

  @Post('pfo/:id/process-routing')
  updateProcessRouting(@Param('id') id: string, @Body() body: any) {
    const routingData = Array.isArray(body) ? body : (body?.routing || []);
    return this.sourcingSvc.updateProcessRouting(Number(id), routingData);
  }

  @Post('pfo/:id/generate-pos')
  generatePos(@Param('id') id: string) {
    return this.sourcingSvc.generatePos(Number(id));
  }

  @Get('pfo/:id/pos')
  getPos(@Param('id') id: string) {
    return this.sourcingSvc.getPos(Number(id));
  }

  @Get('pfo/:id/pxks')
  getPxks(@Param('id') id: string) {
    return this.sourcingSvc.getPxks(Number(id));
  }

  // --- PFO EXECUTION APIs (Gate 7-10) ---
  @Post('pfo/:id/milestone')
  updateMilestone(@Param('id') id: number, @Body() b: any) {
    return this.execSvc.updateMilestone(id, b.milestone_type, b.data);
  }

  @Post('pfo/:id/qc')
  submitQcRecord(@Param('id') id: number, @Body() b: any) {
    return this.execSvc.submitQcRecord(id, b);
  }

  // --- LEGACY: Booking APIs (cần :id param) ---
  @Get(':id/booking-items') getBookingItemsWithStock(@Param('id') id: number) { return this.planningSvc.getBookingItemsWithStock(Number(id)); }
  @Post(':id/confirm-bookings') confirmBookings(@Param('id') id: number, @Body('itemIds') itemIds?: number[]) { return this.planningSvc.confirmBookings(id, itemIds); }
  @Post('bookings/:itemId/revert') revertBooking(@Param('itemId') itemId: number) { return this.planningSvc.revertBooking(Number(itemId)); }
}
