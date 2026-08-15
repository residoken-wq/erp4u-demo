import { Controller, Post, Body, UseGuards, Req, Res, Get } from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { AiLearningService } from './ai-learning.service';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiProactiveService } from './ai-proactive.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
    constructor(
        private readonly aiService: AiService,
        private readonly aiLearningService: AiLearningService,
        private readonly aiAnalyticsService: AiAnalyticsService,
        private readonly aiProactiveService: AiProactiveService
    ) { }

    @Post('pricing')
    async suggestPrice(@Body() body: any) {
        return this.aiService.suggestPrice(body);
    }

    @Post('chat')
    async chat(@Body() body: any) {
        return this.aiService.chat(body);
    }

    @Post('chat-stream')
    async chatStream(@Body() body: any, @Req() req: any, @Res() res: Response) {
        const userId = req.user.id.toString();
        const { message, contextUrl, activeContext, approvedPermission } = body;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        try {
            await this.aiService.handleChatStream(
                userId, 
                message, 
                contextUrl,
                activeContext,
                approvedPermission,
                (chunk: string) => {
                    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
                },
                (status: string) => {
                    res.write(`data: ${JSON.stringify({ status })}\n\n`);
                },
                (permissionRequest: any) => {
                    res.write(`data: ${JSON.stringify({ permission_request: permissionRequest })}\n\n`);
                }
            );
            res.write(`data: [DONE]\n\n`);
            res.end();
        } catch (e) {
            res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
            res.end();
        }
    }

    @Post('suggest-reply')
    async suggestReply(@Body() body: any) {
        return this.aiService.suggestReply(body);
    }

    @Post('customer-360-summary')
    async summarizeCustomer360(@Body('customerId') customerId: number) {
        return this.aiService.summarizeCustomer360(customerId);
    }

    @Post('feedback')
    async submitFeedback(@Body() body: any, @Req() req: any) {
        const userId = req.user.id.toString();
        return this.aiLearningService.saveFeedback({ ...body, userId });
    }

    @Get('analytics')
    async getAnalytics() {
        return this.aiAnalyticsService.getUsageStats();
    }

    @Get('proactive')
    async getProactiveInsights() {
        return this.aiProactiveService.generateDailyInsights();
    }
}
