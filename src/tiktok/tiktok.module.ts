import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

// Entities
import { TikTokMessage } from './entities/tiktok-message.entity';
import { TikTokComment } from './entities/tiktok-comment.entity';
import { TikTokConversation } from './entities/tiktok-conversation.entity';
import { SocialChannel } from '../social/entities/social-channel.entity';

// Service & Client
import { TikTokService } from './tiktok.service';
import { TikTokApiClient } from './tiktok-api.client';

// Controllers
import { TikTokAuthController } from './tiktok-auth.controller';
import { TikTokInboxController } from './tiktok-inbox.controller';
import { TikTokCommentController } from './tiktok-comment.controller';
import { TikTokWebhookController } from './tiktok-webhook.controller';

@Module({
    imports: [
        ConfigModule,
        TypeOrmModule.forFeature([
            TikTokMessage,
            TikTokComment,
            TikTokConversation,
            SocialChannel,
        ]),
    ],
    controllers: [
        TikTokAuthController,
        TikTokInboxController,
        TikTokCommentController,
        TikTokWebhookController,
    ],
    providers: [
        TikTokApiClient,
        TikTokService,
    ],
    exports: [TikTokService],
})
export class TikTokModule { }
