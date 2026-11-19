import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CHATBOT_ENTITIES } from './entities';
import { SystemConfig } from '../system/system-config.entity';
import { User } from '../users/entities/user.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Customer } from '../customers/customer.entity';
import { EmailService } from '../common/services/email.service';

import { ChatbotSchemaService } from './schema/chatbot-schema.service';
import { ChatbotSeedService } from './seed/chatbot-seed.service';
import { ChatbotConfigService } from './config/chatbot-config.service';
import { ChatSessionService } from './session/chat-session.service';
import { ChatSessionGuard } from './session/chat-session.guard';
import { ChatRateLimiter, LlmConcurrency } from './security/chat-rate-limiter';
import { LlmBudgetService } from './llm/llm-budget.service';
import { ChatAttachmentService } from './attachments/chat-attachment.service';
import { ChatbotAuditService } from './audit/chatbot-audit.service';
import { FakeProvider } from './llm/fake.provider';
import { GeminiProvider, resolveTenantGeminiKey } from './llm/gemini.provider';
import {
  LLM_PROVIDER,
  LlmGenerateRequest,
  LlmGenerateResult,
  LlmProvider,
} from './llm/llm-provider';

import { PublicChatController } from './controllers/public-chat.controller';
import { ChatbotAdminConfigController } from './controllers/chatbot-admin-config.controller';
import { ChatbotKbController } from './controllers/chatbot-kb.controller';
import { ChatbotInboxController } from './controllers/chatbot-inbox.controller';
import { ChatbotFlowController } from './controllers/chatbot-flow.controller';
import { ChatbotFlowService } from './flow/chatbot-flow.service';
import { ChatbotKbSeedService } from './seed/chatbot-kb-seed.service';
import { ChatbotKbService } from './kb/chatbot-kb.service';
import { ChatbotToolsService } from './tools/chatbot-tools.service';
import { ScriptedResponderService } from './conversation/scripted-responder.service';
import { ChatbotConversationService } from './conversation/chatbot-conversation.service';
import { ChatbotOutboxService } from './outbox/chatbot-outbox.service';

import { TurnOrchestratorService } from './conversation/turn-orchestrator.service';
import { RuleUnderstanderService } from './conversation/rule-understander.service';
import { UsageService } from '../common/packages/usage.service';
import { TenantConfigService } from '../common/tenancy/tenant-config.service';
import { TenantContext } from '../common/tenancy/tenant-context';

class TenantAwareLlmProvider implements LlmProvider {
  private readonly logger = new Logger('ChatbotModule');
  private readonly activeProviderNameByTenant = new Map<
    string,
    'fake' | 'gemini'
  >();

  constructor(
    private readonly fakeProvider: FakeProvider,
    private readonly geminiProvider: GeminiProvider,
    private readonly tenantConfigService: TenantConfigService,
  ) {}

  get name(): 'fake' | 'gemini' {
    const tenantId = TenantContext.current().tenantId;
    return this.activeProviderNameByTenant.get(tenantId) || 'fake';
  }

  private async resolveDelegate(): Promise<LlmProvider> {
    const tenantId = TenantContext.current().tenantId;
    const providerName = (
      (await this.tenantConfigService.get('CHATBOT_LLM_PROVIDER')) || 'fake'
    ).toLowerCase();

    if (providerName === 'gemini') {
      const resolved = await resolveTenantGeminiKey(this.tenantConfigService);
      if (resolved.key) {
        this.activeProviderNameByTenant.set(tenantId, 'gemini');
        return this.geminiProvider;
      }
      this.logger.warn(
        `CHATBOT_LLM_PROVIDER is gemini for tenant "${tenantId}" but no API key is configured. Falling back to FakeProvider.`,
      );
    }

    this.activeProviderNameByTenant.set(tenantId, 'fake');
    return this.fakeProvider;
  }

  async getModel(): Promise<string> {
    const delegate = await this.resolveDelegate();
    return delegate.getModel();
  }

  async generateJson<T>(
    req: LlmGenerateRequest,
  ): Promise<LlmGenerateResult<T>> {
    const delegate = await this.resolveDelegate();
    return delegate.generateJson<T>(req);
  }
}

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      ...CHATBOT_ENTITIES,
      SystemConfig,
      User,
      UserGroup,
      GroupPermission,
      Customer,
    ]),
  ],
  controllers: [
    PublicChatController,
    ChatbotAdminConfigController,
    ChatbotKbController,
    ChatbotInboxController,
    ChatbotFlowController,
  ],
  providers: [
    ChatbotSchemaService,
    ChatbotSeedService,
    ChatbotKbSeedService,
    ChatbotConfigService,
    ChatSessionService,
    ChatSessionGuard,
    ChatRateLimiter,
    LlmConcurrency,
    LlmBudgetService,
    ChatAttachmentService,
    ChatbotAuditService,
    ChatbotKbService,
    ChatbotToolsService,
    ScriptedResponderService,
    RuleUnderstanderService,
    TurnOrchestratorService,
    ChatbotConversationService,
    ChatbotOutboxService,
    ChatbotFlowService,
    EmailService,
    FakeProvider,
    GeminiProvider,
    {
      provide: LLM_PROVIDER,
      useFactory: (
        configService: ChatbotConfigService,
        usageService: UsageService,
        tenantConfigService: TenantConfigService,
      ) => {
        const fakeProvider = new FakeProvider();
        const geminiProvider = new GeminiProvider(
          configService,
          undefined,
          undefined,
          undefined,
          usageService,
          tenantConfigService,
        );
        return new TenantAwareLlmProvider(
          fakeProvider,
          geminiProvider,
          tenantConfigService,
        );
      },
      inject: [ChatbotConfigService, UsageService, TenantConfigService],
    },
  ],
  exports: [
    ChatbotConfigService,
    ChatSessionService,
    ChatAttachmentService,
    ChatbotAuditService,
    ChatRateLimiter,
    LlmBudgetService,
    ChatbotKbService,
    ChatbotToolsService,
    TurnOrchestratorService,
    LLM_PROVIDER,
  ],
})
export class ChatbotModule {}
