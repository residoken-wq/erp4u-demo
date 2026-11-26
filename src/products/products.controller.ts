import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateVariantDto } from './dto/create-variant.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission, RequireAnyPermission, AuthOnly, Perm, AnyPerm } from '../auth/permissions.decorator';
import { CorePackage, RequiresPackage } from '../common/packages/requires-package.decorator';
import { PackageKey } from '../common/packages/package.registry';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { stripCostPrice } from './cost-filter.helper';
import { CostVisible } from '../auth/cost-visibility';

@Controller('products')
@CorePackage()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@CostVisible({
  modules: ['PRODUCT', 'PURCHASE', 'PRODUCTION', 'SALES', 'INVENTORY', 'FINANCE'],
  purchaseKeys: ['cost_per_unit'],
})
export class ProductsController {
  constructor(
    private readonly service: ProductsService,
    private readonly permCacheService: PermissionCacheService,
  ) { }

  // --- API PACKING SPECS (QUY CÁCH ĐÓNG GÓI) ---
  @RequirePermission('PRODUCT', 'can_view')
  @Perm('PRODUCT', 'view')
  @Get('packing-specs')
  getPackingSpecs(@Query('category_id') categoryId?: string, @Query('product_id') productId?: string) {
    return this.service.getPackingSpecs({
      category_id: categoryId ? Number(categoryId) : undefined,
      product_id: productId ? Number(productId) : undefined,
    });
  }

  @Perm('PRODUCT', 'create')
  @Post('packing-specs')
  @RequirePermission('PRODUCT', 'can_create')
  createPackingSpec(@Body() b: any) {
    return this.service.createPackingSpec(b);
  }

  @Perm('PRODUCT', 'update')
  @Put('packing-specs/:id')
  @RequirePermission('PRODUCT', 'can_update')
  updatePackingSpec(@Param('id') id: number, @Body() b: any) {
    return this.service.updatePackingSpec(Number(id), b);
  }

  @Perm('PRODUCT', 'delete')
  @Delete('packing-specs/:id')
  @RequirePermission('PRODUCT', 'can_delete')
  deletePackingSpec(@Param('id') id: number) {
    return this.service.deletePackingSpec(Number(id));
  }
  // ---------------------------------------------

  @RequireAnyPermission(
    ['PRODUCT', 'can_view'],
    ['PURCHASE', 'can_view'],
    ['PRODUCTION', 'can_view'],
    ['SALES', 'can_view'],
    ['INVENTORY', 'can_view'],
  )
  @AnyPerm(
    ['PRODUCT', 'view'],
    ['PURCHASE', 'view'],
    ['PRODUCTION', 'view'],
    ['SALES', 'view'],
    ['INVENTORY', 'view'],
  )
  @Get()
  async findAll(@Req() req?: any) {
    const products = await this.service.findAll();
    const canViewCost = await this.permCacheService.canViewCostPrice(req?.user, [
      'PRODUCT',
      'PURCHASE',
      'PRODUCTION',
      'SALES',
      'INVENTORY',
      'FINANCE',
    ]);
    if (!canViewCost) {
      return stripCostPrice(products);
    }
    return products;
  }

  @RequireAnyPermission(
    ['PRODUCT', 'can_view'],
    ['PURCHASE', 'can_view'],
    ['PRODUCTION', 'can_view'],
    ['SALES', 'can_view'],
    ['INVENTORY', 'can_view'],
  )
  @AnyPerm(
    ['PRODUCT', 'view'],
    ['PURCHASE', 'view'],
    ['PRODUCTION', 'view'],
    ['SALES', 'view'],
    ['INVENTORY', 'view'],
  )
  @Get(':id')
  async findOne(@Param('id') id: number, @Req() req?: any) {
    const product = await this.service.findOne(Number(id));
    if (!product) return product;
    const canViewCost = await this.permCacheService.canViewCostPrice(req?.user, [
      'PRODUCT',
      'PURCHASE',
      'PRODUCTION',
      'SALES',
      'INVENTORY',
      'FINANCE',
    ]);
    if (!canViewCost) {
      return stripCostPrice(product);
    }
    return product;
  }

  @Perm('PRODUCT', 'create')
  @Post()
  @RequirePermission('PRODUCT', 'can_create')
  async create(@Body() b: any, @Req() req?: any) {
    const canViewCost = await this.permCacheService.canViewCostPrice(req?.user, [
      'PRODUCT',
      'PURCHASE',
      'PRODUCTION',
      'SALES',
      'INVENTORY',
      'FINANCE',
    ]);
    if (!canViewCost && b) {
      delete b.cost_price;
      delete b.profit_margin;
    }
    return this.service.create(b);
  }

  @Perm('PRODUCT', 'update')
  @Put(':id')
  @RequirePermission('PRODUCT', 'can_update')
  async update(@Param('id') id: number, @Body() b: any, @Req() req?: any) {
    const canViewCost = await this.permCacheService.canViewCostPrice(req?.user, [
      'PRODUCT',
      'PURCHASE',
      'PRODUCTION',
      'SALES',
      'INVENTORY',
      'FINANCE',
    ]);
    if (!canViewCost && b) {
      delete b.cost_price;
      delete b.profit_margin;
    }
    return this.service.update(id, b);
  }

  @Perm('PRODUCT', 'delete') @Delete(':id') @RequirePermission('PRODUCT', 'can_delete') remove(@Param('id') id: number) { return this.service.remove(id); }


  @Perm('PRODUCT', 'create')
  @Post('create-variant')
  async createVariant(@Body() createVariantDto: CreateVariantDto) {
    return this.service.createVariant(createVariantDto);
  }

  @RequireAnyPermission(
    ['PRODUCT', 'can_view'],
    ['PRODUCTION', 'can_view'],
    ['PURCHASE', 'can_view'],
  )
  @AnyPerm(
    ['PRODUCT', 'view'],
    ['PRODUCTION', 'view'],
    ['PURCHASE', 'view'],
  )
  @Get(':id/routings') getRoutings(@Param('id') id: number) { return this.service.getRoutings(id); }
  @Perm('PRODUCT', 'update')
  @Post(':id/routings') saveRoutings(@Param('id') id: number, @Body() b: any) { return this.service.saveRoutings(id, b); }

  @Perm('PRODUCT', 'view')
  @Get(':id/logistics') getLogistics(@Param('id') id: number) { return this.service.getLogistics(id); }
  @Perm('PRODUCT', 'update')
  @Post(':id/logistics') saveLogistics(@Param('id') id: number, @Body() b: any) { return this.service.saveLogistics(id, b); }

  // --- API PATTERN ---
  @Perm('PRODUCT', 'view')
  @Get(':id/pattern') getPattern(@Param('id') id: number) { return this.service.getPattern(id); }
  @Perm('PRODUCT', 'update')
  @Post(':id/pattern') savePattern(@Param('id') id: number, @Body() b: any) { return this.service.savePattern(id, b); }

  // --- API WEBSITE CONFIG ---
  @Perm('PRODUCT', 'view')
  @RequiresPackage(PackageKey.WEBSITE)
  @Get(':id/website-config') getWebsiteConfig(@Param('id') id: number) { return this.service.getWebsiteConfig(Number(id)); }
  @Perm('PRODUCT', 'update')
  @RequiresPackage(PackageKey.WEBSITE)
  @Post(':id/website-config') saveWebsiteConfig(@Param('id') id: number, @Body() b: any) { return this.service.saveWebsiteConfig(Number(id), b); }
  // --------------------------

  @RequireAnyPermission(
    ['PRODUCT', 'can_view'],
    ['PURCHASE', 'can_view'],
    ['PRODUCTION', 'can_view'],
    ['SALES', 'can_view'],
    ['INVENTORY', 'can_view'],
  )
  @AnyPerm(
    ['PRODUCT', 'view'],
    ['PURCHASE', 'view'],
    ['PRODUCTION', 'view'],
    ['SALES', 'view'],
    ['INVENTORY', 'view'],
  )
  @Get(':sku/boms')
  async getBoms(@Param('sku') sku: string, @Req() req?: any) {
    const boms = await this.service.getBomByProductSku(sku);
    const canViewCost = await this.permCacheService.canViewCostPrice(req?.user, [
      'PRODUCT',
      'PURCHASE',
      'PRODUCTION',
      'SALES',
      'INVENTORY',
      'FINANCE',
    ]);
    if (!canViewCost) {
      return stripCostPrice(boms);
    }
    return boms;
  }
  @Perm('PRODUCT', 'update')
  @Post(':id/boms') saveBoms(@Param('id') id: number, @Body() b: any) { return this.service.saveBoms(Number(id), b); }

  @Perm('PRODUCT', 'create')
  @Post(':id/sync-variants') syncVariants(@Param('id') id: number) { return this.service.syncToVariants(id); }

  @RequireAnyPermission(
    ['PRODUCT', 'can_view'],
    ['PURCHASE', 'can_view'],
    ['PRODUCTION', 'can_view'],
    ['SALES', 'can_view'],
    ['INVENTORY', 'can_view'],
  )
  @AnyPerm(
    ['PRODUCT', 'view'],
    ['PURCHASE', 'view'],
    ['PRODUCTION', 'view'],
    ['SALES', 'view'],
    ['INVENTORY', 'view'],
  )
  @Get('combo/:sku')
  async getCombo(@Param('sku') sku: string, @Req() req?: any) {
    const combo = await this.service.getComboComponents(sku);
    const canViewCost = await this.permCacheService.canViewCostPrice(req?.user, [
      'PRODUCT',
      'PURCHASE',
      'PRODUCTION',
      'SALES',
      'INVENTORY',
      'FINANCE',
    ]);
    if (!canViewCost) {
      return stripCostPrice(combo);
    }
    return combo;
  }
  @Perm('PRODUCT', 'create')
  @Post('combo/add') addComboItem(@Body() body: any) { return this.service.addComponent(body.parentSku, body.childSku, Number(body.qty)); }
  @Perm('PRODUCT', 'delete')
  @Delete('combo/item/:id') removeComboItem(@Param('id') id: number) { return this.service.removeComponent(id); }

  @Perm('PRODUCT', 'create')
  @Post(':id/components')
  saveComponents(@Param('id') id: number, @Body() items: any[]) {
    return this.service.saveComponents(id, items);
  }

  @Perm('PRODUCT', 'create')
  @Post('copy-bom')
  async copyBom(@Body() body: any) {
    return this.service.copyBom(body.sourceSku, body.targetSku);
  }

  @Perm('PRODUCT', 'create')
  @Post('copy-routings')
  async copyRoutings(@Body() body: any) {
    return this.service.copyRoutings(body.sourceSku, body.targetSku);
  }

  @Perm('PRODUCT', 'create')
  @Post('copy-logistics')
  async copyLogistics(@Body() body: any) {
    return this.service.copyLogistics(body.sourceSku, body.targetSku);
  }

  @Perm('PRODUCT', 'create')
  @Post('copy-semi-finished')
  async copySemiFinished(@Body() body: any) {
    return this.service.copySemiFinished(body.sourceSku, body.targetSku);
  }

  @RequireAnyPermission(
    ['PRODUCT', 'can_view'],
    ['PRODUCTION', 'can_view'],
  )
  @AnyPerm(
    ['PRODUCT', 'view'],
    ['PRODUCTION', 'view'],
  )
  @Get('calculate-cost/:sku') calculateCost(@Param('sku') sku: string) { return this.service.calculateCostPrice(sku); }

  @Perm('PRODUCT', 'view')
  @Post('calculate-all-costs')
  async calculateAllCosts() {
    return this.service.calculateAllCosts();
  }

  @Perm('PRODUCT', 'view')
  @Get(':id/sales-history')
  @RequirePermission('PRODUCT', 'can_view')
  getSalesHistory(@Param('id') id: number) {
    return this.service.getSalesHistory(Number(id));
  }
}