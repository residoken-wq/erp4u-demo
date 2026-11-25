import { AuthOnly } from '../auth/permissions.decorator';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CorePackage } from '../common/packages/requires-package.decorator';

@Controller('tasks')
@CorePackage()
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly s: TasksService) {}

  @AuthOnly()
  @Get()
  findAll(
    @Req() req: any,
    @Query('assignee_id') assigneeId?: string,
    @Query('status_not') statusNot?: string,
    @Query('limit') limit?: string,
  ) {
    return this.s.findAll(
      {
        assignee_id: assigneeId ? parseInt(assigneeId, 10) : undefined,
        status_not: statusNot,
        limit: limit ? parseInt(limit, 10) : undefined,
      },
      req.user,
    );
  }

  @AuthOnly()
  @Post()
  create(@Body() b: any, @Req() req: any) {
    return this.s.create(b, req.user);
  }

  @AuthOnly()
  @Put(':id')
  update(@Param('id') id: number, @Body() b: any, @Req() req: any) {
    return this.s.update(+id, b, req.user);
  }

  @AuthOnly()
  @Delete(':id')
  remove(@Param('id') id: number, @Req() req: any) {
    return this.s.remove(+id, req.user);
  }

  @AuthOnly()
  @Post(':id/start-timer')
  startTimer(@Param('id') id: number, @Req() req: any) {
    const userId = Number(req.user?.id || req.user?.userId);
    return this.s.startTimer(+id, userId);
  }

  @AuthOnly()
  @Post(':id/stop-timer')
  stopTimer(@Param('id') id: number, @Body() body: any, @Req() req: any) {
    const userId = Number(req.user?.id || req.user?.userId);
    return this.s.stopTimer(+id, userId, body?.description);
  }

  @AuthOnly()
  @Get(':id/logs')
  getLogs(@Param('id') id: number) {
    return this.s.getTaskLogs(+id);
  }
}