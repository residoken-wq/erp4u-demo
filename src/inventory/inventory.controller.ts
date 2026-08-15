import { Controller, Post, Get, Body, Param, Put, Delete, Query, UsePipes, ValidationPipe, UseGuards, Req } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './create-inventory.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/permissions.decorator';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) { }

  @Get('history')
  @RequirePermission('INVENTORY', 'can_view')
  async getHistory() { return this.inventoryService.getHistory(); }

  // API lấy chi tiết tồn kho (để Frontend map vào bảng)
  @Get('stocks')
  @RequirePermission('INVENTORY', 'can_view')
  async getStocks() { return this.inventoryService.getAllStocks(); }

  @Post('adjust')
  @RequirePermission('INVENTORY', 'can_create')
  @UsePipes(new ValidationPipe())
  async adjust(@Body() dto: CreateInventoryDto, @Req() req: any) {
    return this.inventoryService.adjustStock(
      dto.type,
      dto.itemType,
      dto.itemId,
      dto.quantity,
      dto.ref,
      dto.note,
      dto.warehouse,
      req.user?.full_name || req.user?.username || 'System'
    );
  }

  // API Reset tồn kho (Dành cho Dev/Admin)
  @Post('reset')
  @RequirePermission('INVENTORY', 'can_delete')
  async reset() {
    return this.inventoryService.resetAllStocks();
  }

  // API Chuyển kho
  @Post('transfer')
  async transfer(@Body() body: any, @Req() req: any) {
    return this.inventoryService.transferStock(
      body.itemType, body.itemId, body.quantity,
      body.fromWh, body.toWh, body.note,
      req.user?.full_name || req.user?.username || 'System'
    );
  }

  // API Chuyển đổi BTP
  @Post('convert-btp')
  async convertBtp(@Body() body: { sourceSku: string, targetSku: string, quantity: number }, @Req() req: any) {
    return this.inventoryService.convertBtp(
      body.sourceSku, body.targetSku, body.quantity,
      req.user?.full_name || req.user?.username || 'System'
    );
  }

  // --- GOODS RECEIPT API ---
  @Post('goods-receipt/draft')
  async createDraft(@Body() body: any) {
    return this.inventoryService.createDraftReceipt(body);
  }

  @Get('goods-receipt/pending')
  getPendingGoodsReceipts() { return this.inventoryService.getPendingReceipts(); }

  @Get('goods-receipt/po/:poId')
  getReceiptsByPo(@Param('poId') poId: number) { return this.inventoryService.getReceiptsByPo(poId); }

  @Post('goods-receipt/:id/confirm')
  async confirm(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.inventoryService.confirmReceipt(Number(id), body, 'KHO_NPL', req.user?.full_name || req.user?.username || 'System');
  }

  @Delete('goods-receipt/:id')
  async deleteReceipt(@Param('id') id: string) {
    return this.inventoryService.deleteDraftReceipt(Number(id));
  }

  // --- EXPORT CONFIRMATION API ---
  @Get('deliveries/pending')
  async getPendingDeliveries() {
    return this.inventoryService.getPendingDeliveries();
  }

  @Get('deliveries/completed')
  async getCompletedDeliveries() {
    return this.inventoryService.getCompletedDeliveries();
  }

  @Post('deliveries/:id/confirm')
  async confirmDelivery(
    @Param('id') id: string,
    @Body('warehouse') warehouse: string,
    @Req() req: any
  ) {
    return this.inventoryService.confirmStockExport(Number(id), warehouse, req.user?.full_name || req.user?.username || 'System');
  }

  // --- SHIPPING CARRIERS API ---
  @Get('shipping-carriers')
  async getShippingCarriers() {
    return this.inventoryService.getAllShippingCarriers();
  }

  @Post('shipping-carriers')
  async createShippingCarrier(@Body() body: any) {
    return this.inventoryService.createShippingCarrier(body);
  }

  @Put('shipping-carriers/:id')
  async updateShippingCarrier(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateShippingCarrier(Number(id), body);
  }

  @Delete('shipping-carriers/:id')
  async deleteShippingCarrier(@Param('id') id: string) {
    return this.inventoryService.deleteShippingCarrier(Number(id));
  }

  // ===========================================
  // --- GOODS ISSUE (PHIẾU XUẤT KHO) API ---
  // ===========================================

  @Post('goods-issue')
  @RequirePermission('INVENTORY', 'can_create')
  async createGoodsIssue(@Body() body: any) {
    return this.inventoryService.createGoodsIssue(body);
  }

  @Put('goods-issue/:id')
  @RequirePermission('INVENTORY', 'can_create')
  async updateGoodsIssue(@Param('id') id: string, @Body() body: any) {
    return this.inventoryService.updateGoodsIssue(Number(id), body);
  }

  @Get('goods-issue/unlinked/:pfoId')
  async getUnlinkedIssues(@Param('pfoId') pfoId: string) {
    return this.inventoryService.getUnlinkedIssues(Number(pfoId));
  }

  @Post('goods-issue/:id/link-po')
  async linkGoodsIssueToPo(@Param('id') id: string, @Body('po_id') poId: number) {
    return this.inventoryService.linkGoodsIssueToPo(Number(id), poId);
  }

  @Get('goods-issue')
  async getGoodsIssues(@Query('po_id') poId?: string, @Query('supplier_id') supplierId?: string) {
    const query: any = {};
    if (poId) query.po_id = Number(poId);
    if (supplierId) query.supplier_id = Number(supplierId);
    return this.inventoryService.getGoodsIssues(query);
  }

  @Get('goods-issue/:id')
  async getGoodsIssueDetail(@Param('id') id: string) {
    return this.inventoryService.getGoodsIssueDetail(Number(id));
  }

  @Post('goods-issue/:id/confirm')
  async confirmGoodsIssue(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.inventoryService.confirmGoodsIssue(Number(id), req.user?.full_name || req.user?.username || 'System', body);
  }

  @Post('goods-issue/:id/delivered')
  async markGoodsIssueDelivered(@Param('id') id: string) {
    return this.inventoryService.markGoodsIssueDelivered(Number(id));
  }

  @Delete('goods-issue/:id')
  @RequirePermission('INVENTORY', 'can_delete')
  async deleteGoodsIssue(@Param('id') id: string) {
    return this.inventoryService.deleteGoodsIssue(Number(id));
  }

  // ===========================================
  // --- SUPPLIER STOCKS ---
  // ===========================================

  @Get('supplier-stocks/all')
  async getAllSupplierStocks() {
    return this.inventoryService.getAllSupplierStocks();
  }

  @Get('supplier-stocks/:supplierId')
  async getSupplierStocks(
    @Param('supplierId') supplierId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.inventoryService.getSupplierStocks(Number(supplierId), startDate, endDate);
  }
}