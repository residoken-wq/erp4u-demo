import { AuthOnly, Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { ProcessesService } from './processes.service';

@Controller('processes')
export class ProcessesController {
  constructor(private readonly s: ProcessesService) {}

  @AuthOnly()
  @Get() findAll() { return this.s.findAll(); }
  @Perm('PRODUCTION', 'create')
  @Post() create(@Body() b: any) { return this.s.create(b); }
  @Perm('PRODUCTION', 'update')
  @Put(':id') update(@Param('id') id: number, @Body() b: any) { return this.s.update(id, b); }
  @Perm('PRODUCTION', 'delete')
  @Delete(':id') remove(@Param('id') id: number) { return this.s.remove(id); }
  
  @Perm('PRODUCTION', 'create')
  @Post('seed') seed() { return this.s.seed(); }
}