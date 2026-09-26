import {
  Controller,
  Get,
  Put,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermission, Perm } from '../../auth/permissions.decorator';
import { ChatbotConfigService } from '../config/chatbot-config.service';
import { LlmBudgetService } from '../llm/llm-budget.service';
import { DataSource } from 'typeorm';
import { SystemConfig } from '../../system/system-config.entity';

@Controller('chatbot/admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotAdminConfigController {
  constructor(
    private readonly configService: ChatbotConfigService,
    private readonly budgetService: LlmBudgetService,
    private readonly dataSource: DataSource,
  ) {}

  @RequirePermission('SYSTEM', 'can_view')
  @Perm('SYSTEM', 'view')
  @Get('config')
  async getConfig() {
    return this.configService.get();
  }

  @RequirePermission('SYSTEM', 'can_update')
  @Perm('SYSTEM', 'update')
  @Put('config')
  async updateConfig(@Body() dto: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.userId;
    return this.configService.save(dto, userId);
  }

  @RequirePermission('SYSTEM', 'can_view')
  @Perm('SYSTEM', 'view')
  @Get('status')
  async getStatus() {
    const provider = process.env.CHATBOT_LLM_PROVIDER || 'fake';
    const keyConfigured = !!process.env.CHATBOT_LLM_API_KEY;
    const callsToday = await this.budgetService.getTodayCalls();

    let seedV1At: string | null = null;
    try {
      const seedConfig = await this.dataSource.getRepository(SystemConfig).findOne({
        where: { key: 'CHATBOT_SEED_V1' },
      });
      if (seedConfig && seedConfig.value) {
        const parsed = JSON.parse(seedConfig.value);
        seedV1At = parsed.at || null;
      }
    } catch {
      seedV1At = null;
    }

    let schemaOk = false;
    try {
      const expectedObjects = [
        'chatbot_conversations',
        'chatbot_sessions',
        'chatbot_messages',
        'chatbot_briefs',
        'chatbot_consents',
        'chatbot_attachments',
        'chatbot_requests',
        'chatbot_tickets',
        'chatbot_outbox',
        'chatbot_audit_events',
        'chatbot_request_seq',
        'chatbot_ticket_seq',
      ];
      const res = await this.dataSource.query(
        `SELECT count(*)::int as cnt FROM pg_class WHERE relname = ANY($1) AND relkind IN ('r', 'p', 'S')`,
        [expectedObjects],
      );
      const count = Number(res[0]?.cnt || 0);
      schemaOk = count === expectedObjects.length;
    } catch {
      schemaOk = false;
    }

    return {
      llm_provider: provider,
      llm_key_configured: keyConfigured,
      llm_calls_today: callsToday,
      seed_v1_at: seedV1At,
      schema_ok: schemaOk,
    };
  }
}
