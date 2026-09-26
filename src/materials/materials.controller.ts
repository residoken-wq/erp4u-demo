import { AuthOnly, Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @AuthOnly()
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
