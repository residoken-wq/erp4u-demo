import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CHATBOT_ENTITIES } from './entities';
import { SystemConfig } from '../system/system-config.entity';
import { User } from '../users/entities/user.entity';
import { UserGroup } from '../users/entities/user-group.entity';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { AuthModule } from '../auth/auth.module';

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
import { GeminiProvider } from './llm/gemini.provider';
import { LLM_PROVIDER } from './llm/llm-provider';

import { PublicChatController } from './controllers/public-chat.controller';
import { ChatbotAdminConfigController } from './controllers/chatbot-admin-config.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      ...CHATBOT_ENTITIES,
      SystemConfig,
      User,
      UserGroup,
      GroupPermission,
    ]),
  ],
  controllers: [
    PublicChatController,
    ChatbotAdminConfigController,
  ],
  providers: [
    ChatbotSchemaService,
    ChatbotSeedService,
    ChatbotConfigService,
    ChatSessionService,
    ChatSessionGuard,
    ChatRateLimiter,
    LlmConcurrency,
    LlmBudgetService,
    ChatAttachmentService,
    ChatbotAuditService,
    FakeProvider,
    GeminiProvider,
    {
      provide: LLM_PROVIDER,
      useFactory: () => {
        const providerName = (process.env.CHATBOT_LLM_PROVIDER || 'fake').toLowerCase();
        const apiKey = process.env.CHATBOT_LLM_API_KEY;
        const model = process.env.CHATBOT_LLM_MODEL;
        if (providerName === 'gemini') {
          if (!apiKey) {
            new Logger('ChatbotModule').warn(
              'CHATBOT_LLM_PROVIDER is gemini but CHATBOT_LLM_API_KEY is not configured. Falling back to FakeProvider.',
            );
            return new FakeProvider();
          }
          return new GeminiProvider(apiKey, model);
        }
        return new FakeProvider();
      },
    },
  ],
  exports: [
    ChatbotConfigService,
    ChatSessionService,
    ChatAttachmentService,
    ChatbotAuditService,
    ChatRateLimiter,
    LlmBudgetService,
    LLM_PROVIDER,
  ],
})
export class ChatbotModule {}
