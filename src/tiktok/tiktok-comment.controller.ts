import { Controller, Get, Post, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { TikTokService } from './tiktok.service';
import { CommentSentiment } from './entities/tiktok-comment.entity';

@Controller('tiktok/comments')
export class TikTokCommentController {
    constructor(private readonly tiktokService: TikTokService) { }

    /**
     * GET /tiktok/comments/stats
     * Dashboard statistics for comments
     */
    @Get('stats')
    async getStats(@Query('channel_id') channelId?: string) {
        return this.tiktokService.getCommentStats(channelId ? parseInt(channelId) : undefined);
    }

    /**
     * POST /tiktok/comments/sync
     * Sync comments for a specific video from TikTok API
     */
    @Post('sync')
    async syncComments(
        @Body('channel_id') channelId: number,
        @Body('video_id') videoId: string,
    ) {
        return this.tiktokService.syncVideoComments(channelId, videoId);
    }

    /**
     * GET /tiktok/comments
     * Get locally stored comments with filters
     */
    @Get()
    async getComments(
        @Query('channel_id') channelId?: string,
        @Query('video_id') videoId?: string,
        @Query('sentiment') sentiment?: CommentSentiment,
        @Query('is_replied') isReplied?: string,
    ) {
        return this.tiktokService.getLocalComments({
            channel_id: channelId ? parseInt(channelId) : undefined,
            video_id: videoId,
            sentiment,
            is_replied: isReplied !== undefined ? isReplied === 'true' : undefined,
        });
    }

    /**
     * GET /tiktok/comments/:id/replies
     * Get replies to a specific comment
     */
    @Get(':id/replies')
    async getReplies(@Param('id', ParseIntPipe) id: number) {
        return this.tiktokService.getCommentReplies(id);
    }

    /**
     * POST /tiktok/comments/:id/reply
     * Reply to a comment
     */
    @Post(':id/reply')
    async replyToComment(
        @Param('id', ParseIntPipe) id: number,
        @Body('text') text: string,
    ) {
        return this.tiktokService.replyToComment(id, text);
    }
}
