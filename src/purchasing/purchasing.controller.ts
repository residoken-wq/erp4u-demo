import { Controller, Post, Get, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { PurchasingService } from './purchasing.service';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly s: PurchasingService) { }

  @Post()
  create(@Body() b: any) { return this.s.createPO(b); }

  @Get()
  findAll() { return this.s.getAllPOs(); }

  @Get('requirements') getRequirements() { return this.s.getPendingRequirements(); }

  // --- MỚI: Pooled PO APIs ---
  // --- MỚI: Pooled PO APIs ---
  @Get('available-for-pooling') getAvailableForPooling(@Query('type') type: any) { return this.s.getAvailableForPooling(type); }
  @Delete('pooled/all') clearPooled() { return this.s.clearPooledPOs(); }
  @Post('create-pooled') createPooled(@Body() b: any) { return this.s.createPooledPO(b); }
  @Get('pooled/:id/aggregate') getPooledAggregate(@Param('id') id: number) { return this.s.getPooledAggregate(id); }
  // ----------------------------

  @Get(':id')
  findOne(@Param('id') id: number) { return this.s.getPODetail(id); }

  @Get(':id/payment-history')
  getPaymentHistory(@Param('id') id: number) { return this.s.getPOPaymentHistory(id); }

  @Put(':id')
  update(@Param('id') id: number, @Body() b: any) { return this.s.updatePO(id, b); }

  // --- FIX: THÊM DELETE ---
  @Post('batch-delete')
  batchDelete(@Body('ids') ids: number[]) {
    return this.s.batchDelete(ids);
  }

  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.s.remove(id);
  }
  // ------------------------

  // --- MỚI: API THEO DÕI NPL GIA CÔNG ---
  @Get(':id/outsourcing-materials')
  getOutsourcingMaterials(@Param('id') id: number) {
    return this.s.getOutsourcingMaterials(id);
  }
  // -------------------------------------

  @Post(':id/receive')
  receive(@Param('id') id: number, @Body() b: any) { return this.s.createGoodsReceipt(id, b); }

  @Get('portal/:uuid')
  getPortal(@Param('uuid') uuid: string) { return this.s.getByUuid(uuid); }

  @Post('portal/:uuid/action')
  portalAction(@Param('uuid') uuid: string, @Body() b: any) { return this.s.supplierAction(uuid, b.action, b); }

  // --- SUPPLIER PORTAL ---
  @Get('supplier-portal/:uuid')
  getSupplierPortal(@Param('uuid') uuid: string) { return this.s.getSupplierPortalData(uuid); }


}