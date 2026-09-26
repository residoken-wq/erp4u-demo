import { AuthOnly } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly s: TasksService) { }

  @AuthOnly()
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
  @AuthOnly()
  @Post() create(@Body() b: any) { return this.s.create(b); }
  @AuthOnly()
  @Put(':id') update(@Param('id') id: number, @Body() b: any) { return this.s.update(id, b); }
  @AuthOnly()
  @Delete(':id') remove(@Param('id') id: number) { return this.s.remove(id); }

  @AuthOnly()
  @Post(':id/start-timer')
  startTimer(@Param('id') id: number, @Body() body: any) {
    return this.s.startTimer(id, body.user_id);
  }

  @AuthOnly()
  @Post(':id/stop-timer')
  stopTimer(@Param('id') id: number, @Body() body: any) {
    return this.s.stopTimer(id, body.user_id, body.description);
  }

  @AuthOnly()
  @Get(':id/logs')
  getLogs(@Param('id') id: number) {
    return this.s.getTaskLogs(id);
  }
}