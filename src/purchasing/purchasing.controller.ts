import { Perm } from '../auth/permissions.decorator';
import { Public } from '../auth/public.decorator';
import { Controller, Post, Get, Put, Delete, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { PurchasingService } from './purchasing.service';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly s: PurchasingService) { }

  @Perm('PURCHASE', 'create')
  @Post()
  create(@Body() b: any) { return this.s.createPO(b); }

  @Perm('PURCHASE', 'view')
  @Get()
  findAll() { return this.s.getAllPOs(); }

  @Perm('PURCHASE', 'view')
  @Get('requirements') getRequirements() { return this.s.getPendingRequirements(); }

  // --- MỚI: Pooled PO APIs ---
  // --- MỚI: Pooled PO APIs ---
  @Perm('PURCHASE', 'view')
  @Get('available-for-pooling') getAvailableForPooling(@Query('type') type: any) { return this.s.getAvailableForPooling(type); }
  @Perm('PURCHASE', 'delete')
  @Delete('pooled/all') clearPooled() { return this.s.clearPooledPOs(); }
  @Perm('PURCHASE', 'create')
  @Post('create-pooled') createPooled(@Body() b: any) { return this.s.createPooledPO(b); }
  @Perm('PURCHASE', 'view')
  @Get('pooled/:id/aggregate') getPooledAggregate(@Param('id') id: number) { return this.s.getPooledAggregate(id); }
  // ----------------------------

  @Perm('PURCHASE', 'view')
  @Get(':id')
  findOne(@Param('id') id: number) { return this.s.getPODetail(id); }

  @Perm('PURCHASE', 'view')
  @Get(':id/payment-history')
  getPaymentHistory(@Param('id') id: number) { return this.s.getPOPaymentHistory(id); }

  @Perm('PURCHASE', 'update')
  @Put(':id')
  update(@Param('id') id: number, @Body() b: any) { return this.s.updatePO(id, b); }

  // --- FIX: THÊM DELETE ---
  @Perm('PURCHASE', 'create')
  @Post('batch-delete')
  batchDelete(@Body('ids') ids: number[]) {
    return this.s.batchDelete(ids);
  }

  @Perm('PURCHASE', 'delete')
  @Delete(':id')
  remove(@Param('id') id: number) {
    return this.s.remove(id);
  }
  // ------------------------

  // --- MỚI: API THEO DÕI NPL GIA CÔNG ---
  @Perm('PURCHASE', 'view')
  @Get(':id/outsourcing-materials')
  getOutsourcingMaterials(@Param('id') id: number) {
    return this.s.getOutsourcingMaterials(id);
  }
  // -------------------------------------

  @Perm('PURCHASE', 'create')
  @Post(':id/receive')
  receive(@Param('id') id: number, @Body() b: any) { return this.s.createGoodsReceipt(id, b); }

  @Public()
  @Get('portal/:uuid')
  getPortal(@Param('uuid') uuid: string) { return this.s.getByUuid(uuid); }

  @Public()
  @Post('portal/:uuid/action')
  portalAction(@Param('uuid') uuid: string, @Body() b: any) { return this.s.supplierAction(uuid, b.action, b); }

  // --- SUPPLIER PORTAL ---
  @Public()
  @Get('supplier-portal/:uuid')
  getSupplierPortal(@Param('uuid') uuid: string) { return this.s.getSupplierPortalData(uuid); }

  @Public()
  @Get('supplier-portal/:uuid/outsourcing-materials/:poId')
  getSupplierPortalOutsourcingMaterials(
    @Param('uuid') uuid: string,
    @Param('poId', ParseIntPipe) poId: number,
  ) {
    return this.s.getSupplierPortalOutsourcingMaterials(uuid, poId);
  }


}