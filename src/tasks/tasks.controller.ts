import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly s: TasksService) { }

  @Get() findAll() { return this.s.findAll(); }
  @Post() create(@Body() b: any) { return this.s.create(b); }
  @Put(':id') update(@Param('id') id: number, @Body() b: any) { return this.s.update(id, b); }
  @Delete(':id') remove(@Param('id') id: number) { return this.s.remove(id); }

  @Post(':id/start-timer')
  startTimer(@Param('id') id: number, @Body() body: any) {
    return this.s.startTimer(id, body.user_id);
  }

  @Post(':id/stop-timer')
  stopTimer(@Param('id') id: number, @Body() body: any) {
    return this.s.stopTimer(id, body.user_id, body.description);
  }

  @Get(':id/logs')
  getLogs(@Param('id') id: number) {
    return this.s.getTaskLogs(id);
  }
}