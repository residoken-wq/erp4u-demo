import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { MaterialsService } from './materials.service';

@Controller('materials')
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  @Get()
  findAll() { return this.materialsService.findAll(); }

  @Post()
  create(@Body() body: any) { return this.materialsService.create(body); }

  @Put(':id')
  update(@Param('id') id: number, @Body() body: any) { return this.materialsService.update(id, body); }

  @Delete(':id')
  remove(@Param('id') id: number) { return this.materialsService.remove(id); }
}
