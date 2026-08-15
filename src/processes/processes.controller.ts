import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ProcessesService } from './processes.service';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly s: ProcessesService) {}

  @Get() findAll() { return this.s.findAll(); }
  @Post() create(@Body() b: any) { return this.s.create(b); }
  @Put(':id') update(@Param('id') id: number, @Body() b: any) { return this.s.update(id, b); }
  @Delete(':id') remove(@Param('id') id: number) { return this.s.remove(id); }
  
  @Post('seed') seed() { return this.s.seed(); }
}