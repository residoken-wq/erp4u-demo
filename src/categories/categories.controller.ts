import { AuthOnly, Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly s: CategoriesService) {}

  @AuthOnly()
  @Get() findAll() { return this.s.findAll(); }
  @AuthOnly()
  @Get(':id') findOne(@Param('id') id: number) { return this.s.findOne(id); }
  @Perm('PRODUCT', 'create')
  @Post() create(@Body() b: any) { return this.s.create(b); }
  @Perm('PRODUCT', 'update')
  @Post(':id/sync-size') syncSize(@Param('id') id: number) { return this.s.syncSize(id); }
  @Perm('PRODUCT', 'update')
  @Put(':id') update(@Param('id') id: number, @Body() b: any) { return this.s.update(id, b); }
  @Perm('PRODUCT', 'delete')
  @Delete(':id') remove(@Param('id') id: number) { return this.s.remove(id); }
}