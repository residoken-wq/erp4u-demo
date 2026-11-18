import { Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { TikTokService } from './tiktok.service';

@Controller('tiktok/inbox')
export class TikTokInboxController {
    constructor(private readonly tiktokService: TikTokService) { }

    /**
     * GET /tiktok/inbox/stats
     * Dashboard statistics for inbox
     */
    @Perm('MARKETING', 'view')
    @Get('stats')
    async getStats(@Query('channel_id') channelId?: string) {
        return this.tiktokService.getInboxStats(channelId ? parseInt(channelId) : undefined);
    }

    /**
     * POST /tiktok/inbox/sync
     * Sync conversations from TikTok Shop API
     */
    @Perm('MARKETING', 'create')
    @Post('sync')
    async syncConversations(@Body('channel_id') channelId?: number) {
        return this.tiktokService.syncConversations(channelId);
    }

    /**
     * GET /tiktok/inbox/conversations
     * Get local conversations list
     */
    @Perm('MARKETING', 'view')
    @Get('conversations')
    async getConversations(@Query('channel_id') channelId?: string) {
        return this.tiktokService.getLocalConversations(channelId ? parseInt(channelId) : undefined);
    }

    /**
     * GET /tiktok/inbox/conversations/:id
     * Get single conversation details
     */
    @Perm('MARKETING', 'view')
    @Get('conversations/:id')
    async getConversation(@Param('id', ParseIntPipe) id: number) {
        return this.tiktokService.getConversationById(id);
    }

    /**
     * GET /tiktok/inbox/conversations/:id/messages
     * Get messages in a conversation (local data)
     */
    @Perm('MARKETING', 'view')
    @Get('conversations/:id/messages')
    async getMessages(@Param('id', ParseIntPipe) id: number) {
        return this.tiktokService.getLocalMessages(id);
    }

    /**
     * POST /tiktok/inbox/conversations/:id/sync
     * Sync messages from TikTok for a specific conversation
     */
    @Perm('MARKETING', 'create')
    @Post('conversations/:id/sync')
    async syncMessages(@Param('id', ParseIntPipe) id: number) {
        return this.tiktokService.syncMessages(id);
    }

    /**
     * POST /tiktok/inbox/conversations/:id/reply
     * Send a reply message in a conversation
     */
    @Perm('MARKETING', 'create')
    @Post('conversations/:id/reply')
    async replyMessage(
        @Param('id', ParseIntPipe) id: number,
        @Body('text') text: string,
    ) {
        return this.tiktokService.sendReply(id, text);
    }
}
