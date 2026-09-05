import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly s: TasksService) { }

  @Get() findAll(
    @Query('assignee_id') assigneeId?: string,
    @Query('status_not') statusNot?: string,
    @Query('limit') limit?: string,
  ) {
    return this.s.findAll({
      assignee_id: assigneeId ? parseInt(assigneeId, 10) : undefined,
      status_not: statusNot,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }
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