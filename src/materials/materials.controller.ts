import { AuthOnly, Perm, AnyPerm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { MaterialsService } from './materials.service';
import { RequiresPackage } from '../common/packages/requires-package.decorator';
import { PackageKey } from '../common/packages/package.registry';
import { CostVisible } from '../auth/cost-visibility';

@Controller('materials')
@RequiresPackage(PackageKey.INVENTORY)
@CostVisible({
  modules: ['PURCHASE', 'INVENTORY', 'FINANCE'],
  purchaseKeys: ['cost_per_unit', 'cost_price'],
})
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @AnyPerm(['INVENTORY', 'view'], ['PURCHASE', 'view'])
  @Get()
  findAll() { return this.materialsService.findAll(); }

  @Perm('INVENTORY', 'create')
  @Post()
  create(@Body() body: any) { return this.materialsService.create(body); }

  @Perm('INVENTORY', 'update')
  @Put(':id')
  update(@Param('id') id: number, @Body() body: any) { return this.materialsService.update(id, body); }

  @Perm('INVENTORY', 'delete')
  @Delete(':id')
  remove(@Param('id') id: number) { return this.materialsService.remove(id); }
}
