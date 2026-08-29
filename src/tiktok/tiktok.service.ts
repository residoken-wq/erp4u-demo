import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TikTokApiClient } from './tiktok-api.client';
import { TikTokMessage, MessageSenderType, MessageContentType } from './entities/tiktok-message.entity';
import { TikTokComment, CommentSentiment } from './entities/tiktok-comment.entity';
import { TikTokConversation, ConversationStatus } from './entities/tiktok-conversation.entity';
import { SocialChannel, SocialPlatform, ChannelStatus } from '../social/entities/social-channel.entity';

@Injectable()
export class TikTokService {
    private readonly logger = new Logger(TikTokService.name);

    constructor(
        private readonly apiClient: TikTokApiClient,
        @InjectRepository(TikTokMessage)
        private messageRepo: Repository<TikTokMessage>,
        @InjectRepository(TikTokComment)
        private commentRepo: Repository<TikTokComment>,
        @InjectRepository(TikTokConversation)
        private conversationRepo: Repository<TikTokConversation>,
        @InjectRepository(SocialChannel)
        private channelRepo: Repository<SocialChannel>,
    ) { }

    // ===================== CHANNEL HELPERS =====================

    async getTikTokChannel(channelId?: number): Promise<SocialChannel> {
        const where: any = { platform: SocialPlatform.TIKTOK };
        if (channelId) where.id = channelId;

        const channel = await this.channelRepo.findOne({ where });
        if (!channel) {
            throw new NotFoundException('Chưa kết nối kênh TikTok Shop nào');
        }
        return channel;
    }

    async getTikTokChannels(): Promise<SocialChannel[]> {
        return this.channelRepo.find({
            where: { platform: SocialPlatform.TIKTOK },
            order: { created_at: 'DESC' },
        });
    }

    /**
     * Check and auto-refresh token if expired
     */
    private async ensureValidToken(channel: SocialChannel): Promise<string> {
        if (channel.token_expires_at && new Date() >= channel.token_expires_at) {
            this.logger.log(`Token expired for channel ${channel.id}, refreshing...`);
            try {
                const newTokens = await this.apiClient.refreshAccessToken(channel.refresh_token);
                await this.channelRepo.update(channel.id, {
                    access_token: newTokens.access_token,
                    refresh_token: newTokens.refresh_token,
                    token_expires_at: new Date(Date.now() + newTokens.access_token_expire_in * 1000),
                    status: ChannelStatus.ACTIVE,
                    last_error: null,
                });
                return newTokens.access_token;
            } catch (error) {
                await this.channelRepo.update(channel.id, {
                    status: ChannelStatus.ERROR,
                    last_error: `Token refresh failed: ${error.message}`,
                });
                throw new BadRequestException('Không thể refresh token TikTok. Vui lòng kết nối lại.');
            }
        }
        return channel.access_token;
    }

    // ===================== AUTH =====================

    getAuthorizationUrl(state?: string): string {
        return this.apiClient.getAuthorizationUrl(state);
    }

    async handleAuthCallback(code: string): Promise<SocialChannel> {
        const tokenData = await this.apiClient.getAccessToken(code);

        // Check if channel already exists with this open_id
        let channel = await this.channelRepo.findOne({
            where: {
                platform: SocialPlatform.TIKTOK,
                shop_id: tokenData.open_id,
            },
        });

        if (channel) {
            // Update existing channel
            await this.channelRepo.update(channel.id, {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                token_expires_at: new Date(Date.now() + tokenData.access_token_expire_in * 1000),
                shop_name: tokenData.seller_name || channel.shop_name,
                status: ChannelStatus.ACTIVE,
                last_error: null,
                last_sync_at: new Date(),
            });
            return this.channelRepo.findOne({ where: { id: channel.id } });
        }

        // Create new channel
        channel = this.channelRepo.create({
            platform: SocialPlatform.TIKTOK,
            shop_id: tokenData.open_id,
            shop_name: tokenData.seller_name || 'TikTok Shop',
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            token_expires_at: new Date(Date.now() + tokenData.access_token_expire_in * 1000),
            status: ChannelStatus.ACTIVE,
            settings: {
                auto_sync_orders: true,
                sync_interval_minutes: 15,
            },
        });

        return this.channelRepo.save(channel);
    }

    // ===================== INBOX / CONVERSATIONS =====================

    async syncConversations(channelId?: number): Promise<TikTokConversation[]> {
        const channel = await this.getTikTokChannel(channelId);
        const accessToken = await this.ensureValidToken(channel);
        const shopCipher = channel.metadata?.partner_id;

        try {
            const result = await this.apiClient.getConversations(accessToken, {
                page_size: 20,
                sort_order: 'DESC',
            }, shopCipher);

            const conversations: TikTokConversation[] = [];

            for (const conv of result.conversations || []) {
                let existing = await this.conversationRepo.findOne({
                    where: { conversation_id: conv.conversation_id },
                });

                const data: Partial<TikTokConversation> = {
                    channel_id: channel.id,
                    conversation_id: conv.conversation_id,
                    buyer_id: conv.buyer?.id,
                    buyer_name: conv.buyer?.name || conv.buyer?.nickname,
                    buyer_avatar: conv.buyer?.avatar,
                    last_message: conv.last_message?.content,
                    last_message_at: conv.last_message_time ? new Date(conv.last_message_time * 1000) : null,
                };

                if (existing) {
                    await this.conversationRepo.update(existing.id, data);
                    existing = await this.conversationRepo.findOne({ where: { id: existing.id } });
                    conversations.push(existing);
                } else {
                    const newConv = this.conversationRepo.create(data);
                    conversations.push(await this.conversationRepo.save(newConv));
                }
            }

            await this.channelRepo.update(channel.id, { last_sync_at: new Date() });
            this.logger.log(`Synced ${conversations.length} conversations for channel ${channel.id}`);
            return conversations;
        } catch (error) {
            this.logger.error(`Failed to sync conversations: ${error.message}`);
            throw error;
        }
    }

    async getLocalConversations(channelId?: number): Promise<TikTokConversation[]> {
        const where: any = {};
        if (channelId) where.channel_id = channelId;

        return this.conversationRepo.find({
            where,
            order: { last_message_at: 'DESC' },
            relations: ['channel'],
        });
    }

    async getConversationById(id: number): Promise<TikTokConversation> {
        const conv = await this.conversationRepo.findOne({
            where: { id },
            relations: ['channel'],
        });
        if (!conv) throw new NotFoundException(`Conversation #${id} không tồn tại`);
        return conv;
    }

    // ===================== MESSAGES =====================

    async syncMessages(conversationId: number): Promise<TikTokMessage[]> {
        const conversation = await this.getConversationById(conversationId);
        const channel = await this.getTikTokChannel(conversation.channel_id);
        const accessToken = await this.ensureValidToken(channel);
        const shopCipher = channel.metadata?.partner_id;

        const result = await this.apiClient.getMessages(accessToken, conversation.conversation_id, {
            page_size: 10,
            sort_order: 'ASC',
        }, shopCipher);

        const messages: TikTokMessage[] = [];

        for (const msg of result.messages || []) {
            const exists = await this.messageRepo.findOne({
                where: { message_id: msg.id || msg.message_id },
            });

            if (!exists) {
                const newMsg = this.messageRepo.create({
                    channel_id: channel.id,
                    conversation_id: conversation.conversation_id,
                    message_id: msg.id || msg.message_id,
                    sender_type: msg.sender_role === 'BUYER' ? MessageSenderType.BUYER
                        : msg.sender_role === 'SELLER' ? MessageSenderType.SELLER
                            : MessageSenderType.SYSTEM,
                    content_type: (msg.type as MessageContentType) || MessageContentType.TEXT,
                    content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
                    buyer_name: conversation.buyer_name,
                    buyer_avatar: conversation.buyer_avatar,
                    buyer_id: conversation.buyer_id,
                    platform_created_at: msg.create_time ? new Date(msg.create_time * 1000) : new Date(),
                });
                messages.push(await this.messageRepo.save(newMsg));
            } else {
                messages.push(exists);
            }
        }

        // Update conversation last sync
        await this.conversationRepo.update(conversationId, {
            message_count: messages.length,
        });

        return messages;
    }

    async getLocalMessages(conversationId: number): Promise<TikTokMessage[]> {
        const conversation = await this.getConversationById(conversationId);
        return this.messageRepo.find({
            where: { conversation_id: conversation.conversation_id },
            order: { platform_created_at: 'ASC' },
        });
    }

    async sendReply(conversationId: number, text: string): Promise<TikTokMessage> {
        const conversation = await this.getConversationById(conversationId);
        const channel = await this.getTikTokChannel(conversation.channel_id);
        const accessToken = await this.ensureValidToken(channel);
        const shopCipher = channel.metadata?.partner_id;

        const contentJson = JSON.stringify({ text });
        await this.apiClient.sendMessage(
            accessToken,
            conversation.conversation_id,
            'TEXT',
            contentJson,
            shopCipher,
        );

        // Save locally
        const msg = this.messageRepo.create({
            channel_id: channel.id,
            conversation_id: conversation.conversation_id,
            message_id: `local_${Date.now()}`,
            sender_type: MessageSenderType.SELLER,
            content_type: MessageContentType.TEXT,
            content: text,
            platform_created_at: new Date(),
        });

        const saved = await this.messageRepo.save(msg);

        // Update conversation
        await this.conversationRepo.update(conversationId, {
            last_message: text,
            last_message_at: new Date(),
        });

        return saved;
    }

    // ===================== COMMENTS =====================

    async syncVideoComments(channelId: number, videoId: string): Promise<TikTokComment[]> {
        const channel = await this.getTikTokChannel(channelId);
        const accessToken = await this.ensureValidToken(channel);

        try {
            const result = await this.apiClient.getVideoComments(accessToken, videoId, {
                max_count: 50,
            });

            const comments: TikTokComment[] = [];

            for (const c of result.comments || []) {
                const exists = await this.commentRepo.findOne({
                    where: { comment_id: c.id },
                });

                if (!exists) {
                    const sentiment = this.analyzeSentiment(c.text);
                    const newComment = this.commentRepo.create({
                        channel_id: channel.id,
                        video_id: videoId,
                        comment_id: c.id,
                        parent_comment_id: c.parent_comment_id || null,
                        username: c.user?.nickname || c.user?.unique_id || 'Unknown',
                        avatar_url: c.user?.avatar_url,
                        text: c.text,
                        like_count: c.like_count || 0,
                        reply_count: c.reply_count || 0,
                        sentiment,
                        platform_created_at: c.create_time ? new Date(c.create_time * 1000) : new Date(),
                    });
                    comments.push(await this.commentRepo.save(newComment));
                } else {
                    // Update like/reply counts
                    await this.commentRepo.update(exists.id, {
                        like_count: c.like_count || exists.like_count,
                        reply_count: c.reply_count || exists.reply_count,
                    });
                    comments.push(exists);
                }
            }

            this.logger.log(`Synced ${comments.length} comments for video ${videoId}`);
            return comments;
        } catch (error) {
            this.logger.error(`Failed to sync comments for video ${videoId}: ${error.message}`);
            throw error;
        }
    }

    async getLocalComments(filters?: {
        channel_id?: number;
        video_id?: string;
        sentiment?: CommentSentiment;
        is_replied?: boolean;
    }): Promise<TikTokComment[]> {
        const qb = this.commentRepo.createQueryBuilder('c')
            .leftJoinAndSelect('c.channel', 'channel')
            .orderBy('c.platform_created_at', 'DESC');

        if (filters?.channel_id) {
            qb.andWhere('c.channel_id = :channelId', { channelId: filters.channel_id });
        }
        if (filters?.video_id) {
            qb.andWhere('c.video_id = :videoId', { videoId: filters.video_id });
        }
        if (filters?.sentiment) {
            qb.andWhere('c.sentiment = :sentiment', { sentiment: filters.sentiment });
        }
        if (filters?.is_replied !== undefined) {
            qb.andWhere('c.is_replied = :isReplied', { isReplied: filters.is_replied });
        }

        // Only top-level comments (not replies)
        qb.andWhere('c.parent_comment_id IS NULL');

        return qb.getMany();
    }

    async getCommentReplies(commentId: number): Promise<TikTokComment[]> {
        const comment = await this.commentRepo.findOne({ where: { id: commentId } });
        if (!comment) throw new NotFoundException(`Comment #${commentId} không tồn tại`);

        return this.commentRepo.find({
            where: { parent_comment_id: comment.comment_id },
            order: { platform_created_at: 'ASC' },
        });
    }

    async replyToComment(commentId: number, text: string): Promise<TikTokComment> {
        const comment = await this.commentRepo.findOne({
            where: { id: commentId },
            relations: ['channel'],
        });
        if (!comment) throw new NotFoundException(`Comment #${commentId} không tồn tại`);

        const channel = comment.channel;
        const accessToken = await this.ensureValidToken(channel);

        try {
            await this.apiClient.replyToComment(
                accessToken,
                comment.video_id,
                comment.comment_id,
                text,
            );
        } catch (error) {
            this.logger.warn(`TikTok reply API failed (may not have scope): ${error.message}`);
            // Continue to save locally even if API fails
        }

        // Update comment as replied
        await this.commentRepo.update(commentId, {
            is_replied: true,
            our_reply: text,
        });

        return this.commentRepo.findOne({ where: { id: commentId } });
    }

    // ===================== WEBHOOK HANDLING =====================

    async handleWebhookEvent(eventType: string, payload: any): Promise<void> {
        this.logger.log(`Received webhook event: ${eventType}`);

        switch (eventType) {
            case 'NEW_MESSAGE':
                await this.handleNewMessageWebhook(payload);
                break;
            default:
                this.logger.warn(`Unhandled webhook event type: ${eventType}`);
        }
    }

    private async handleNewMessageWebhook(payload: any): Promise<void> {
        const { conversation_id, message } = payload;
        if (!conversation_id || !message) return;

        // Find the conversation
        const conversation = await this.conversationRepo.findOne({
            where: { conversation_id },
        });

        if (!conversation) {
            this.logger.warn(`Webhook: conversation ${conversation_id} not found locally`);
            return;
        }

        // Check if message already exists
        const exists = await this.messageRepo.findOne({
            where: { message_id: message.id || message.message_id },
        });

        if (!exists) {
            const newMsg = this.messageRepo.create({
                channel_id: conversation.channel_id,
                conversation_id,
                message_id: message.id || message.message_id,
                sender_type: message.sender_role === 'BUYER' ? MessageSenderType.BUYER : MessageSenderType.SELLER,
                content_type: (message.type as MessageContentType) || MessageContentType.TEXT,
                content: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
                buyer_name: conversation.buyer_name,
                buyer_avatar: conversation.buyer_avatar,
                buyer_id: conversation.buyer_id,
                platform_created_at: message.create_time ? new Date(message.create_time * 1000) : new Date(),
            });
            await this.messageRepo.save(newMsg);
        }

        // Update conversation
        await this.conversationRepo.update(conversation.id, {
            last_message: typeof message.content === 'string' ? message.content : JSON.stringify(message.content),
            last_message_at: new Date(),
            unread_count: () => 'unread_count + 1',
        });
    }

    // ===================== STATS =====================

    async getInboxStats(channelId?: number): Promise<{
        total_conversations: number;
        unread_conversations: number;
        total_messages: number;
        today_messages: number;
    }> {
        const where: any = {};
        if (channelId) where.channel_id = channelId;

        const totalConversations = await this.conversationRepo.count({ where });

        const unreadConversations = await this.conversationRepo
            .createQueryBuilder('c')
            .where(channelId ? 'c.channel_id = :channelId' : '1=1', { channelId })
            .andWhere('c.unread_count > 0')
            .getCount();

        const totalMessages = await this.messageRepo.count({ where });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayMessages = await this.messageRepo
            .createQueryBuilder('m')
            .where(channelId ? 'm.channel_id = :channelId' : '1=1', { channelId })
            .andWhere('m.created_at >= :today', { today })
            .getCount();

        return {
            total_conversations: totalConversations,
            unread_conversations: unreadConversations,
            total_messages: totalMessages,
            today_messages: todayMessages,
        };
    }

    async getCommentStats(channelId?: number): Promise<{
        total_comments: number;
        unreplied_comments: number;
        positive_count: number;
        negative_count: number;
        neutral_count: number;
        videos_with_comments: number;
    }> {
        const where: any = { parent_comment_id: null };  // only top-level
        if (channelId) where.channel_id = channelId;

        const totalComments = await this.commentRepo.count({ where });
        const unrepliedComments = await this.commentRepo.count({ where: { ...where, is_replied: false } });
        const positiveCount = await this.commentRepo.count({ where: { ...where, sentiment: CommentSentiment.POSITIVE } });
        const negativeCount = await this.commentRepo.count({ where: { ...where, sentiment: CommentSentiment.NEGATIVE } });
        const neutralCount = await this.commentRepo.count({ where: { ...where, sentiment: CommentSentiment.NEUTRAL } });

        const videosResult = await this.commentRepo
            .createQueryBuilder('c')
            .select('COUNT(DISTINCT c.video_id)', 'count')
            .where(channelId ? 'c.channel_id = :channelId' : '1=1', { channelId })
            .getRawOne();

        return {
            total_comments: totalComments,
            unreplied_comments: unrepliedComments,
            positive_count: positiveCount,
            negative_count: negativeCount,
            neutral_count: neutralCount,
            videos_with_comments: parseInt(videosResult?.count || '0'),
        };
    }

    // ===================== SENTIMENT ANALYSIS (Simple) =====================

    private analyzeSentiment(text: string): CommentSentiment {
        if (!text) return CommentSentiment.NEUTRAL;

        const lowerText = text.toLowerCase();

        const positiveWords = [
            'tốt', 'đẹp', 'thích', 'hay', 'good', 'great', 'love', 'amazing', 'excellent',
            'nice', 'beautiful', 'perfect', 'awesome', 'tuyệt', 'xuất sắc', 'chất lượng',
            'ưng', 'hài lòng', 'recommend', 'best', '❤️', '😍', '👍', '🔥', 'wow',
        ];

        const negativeWords = [
            'xấu', 'tệ', 'dở', 'bad', 'terrible', 'worst', 'horrible', 'disappointed',
            'rác', 'lừa', 'fake', 'scam', 'chán', 'kém', 'hỏng', 'vỡ', 'sai',
            'trả hàng', 'refund', '😡', '👎', '😤', 'hate', 'poor',
        ];

        let positiveScore = 0;
        let negativeScore = 0;

        for (const word of positiveWords) {
            if (lowerText.includes(word)) positiveScore++;
        }
        for (const word of negativeWords) {
            if (lowerText.includes(word)) negativeScore++;
        }

        if (positiveScore > negativeScore) return CommentSentiment.POSITIVE;
        if (negativeScore > positiveScore) return CommentSentiment.NEGATIVE;
        return CommentSentiment.NEUTRAL;
    }
}
