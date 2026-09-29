import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermission, Perm } from '../../auth/permissions.decorator';
import { ChatbotFlowService } from '../flow/chatbot-flow.service';

const uid = (req: any): number | null => {
  const v = Number(req.user?.id ?? req.user?.userId);
  return Number.isFinite(v) ? v : null;
};

@Controller('chatbot/admin/flows')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotFlowController {
  constructor(private readonly flowService: ChatbotFlowService) {}

  // CB-130
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get()
  async list() {
    return this.flowService.list();
  }

  // CB-131
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get('topics')
  async topics() {
    return this.flowService.topics();
  }

  // CB-132
  @RequirePermission('CHATBOT_KB', 'can_view')
  @Perm('CHATBOT_KB', 'view')
  @Get(':id')
  async get(@Param('id') id: string) {
    return this.flowService.get(id);
  }

  // CB-133
  @RequirePermission('CHATBOT_KB', 'can_create')
  @Perm('CHATBOT_KB', 'create')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    return this.flowService.create(body, uid(req));
  }

  // CB-134
  @RequirePermission('CHATBOT_KB', 'can_update')
  @Perm('CHATBOT_KB', 'update')
  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.flowService.update(id, body, uid(req));
  }

  // CB-135: publish = approve (same convention as KB: delete permission)
  @RequirePermission('CHATBOT_KB', 'can_delete')
  @Perm('CHATBOT_KB', 'delete')
  @Post(':id/publish')
  async publish(@Param('id') id: string, @Req() req: any) {
    return this.flowService.publish(id, uid(req));
  }

  // CB-136
  @RequirePermission('CHATBOT_KB', 'can_delete')
  @Perm('CHATBOT_KB', 'delete')
  @Post(':id/enabled')
  async setEnabled(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.flowService.setEnabled(id, body?.enabled === true, uid(req));
  }

  // CB-137
  @RequirePermission('CHATBOT_KB', 'can_delete')
  @Perm('CHATBOT_KB', 'delete')
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: any) {
    return this.flowService.remove(id, uid(req));
  }
}
