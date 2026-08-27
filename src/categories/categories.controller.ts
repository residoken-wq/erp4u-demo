import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly s: CategoriesService) {}

  @Get() findAll() { return this.s.findAll(); }
  @Get(':id') findOne(@Param('id') id: number) { return this.s.findOne(id); }
  @Post() create(@Body() b: any) { return this.s.create(b); }
  @Post(':id/sync-size') syncSize(@Param('id') id: number) { return this.s.syncSize(id); }
  @Put(':id') update(@Param('id') id: number, @Body() b: any) { return this.s.update(id, b); }
  @Delete(':id') remove(@Param('id') id: number) { return this.s.remove(id); }
}