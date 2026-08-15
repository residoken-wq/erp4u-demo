import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Request } from 'express';

@Controller('public/analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Post('ping')
    async ping(@Body() body: { session_id: string }, @Req() req: Request) {
        if (!body.session_id) {
            return { success: false, error: 'session_id is required' };
        }

        const ip_address = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress;
        const user_agent = req.headers['user-agent'];

        return this.analyticsService.ping({
            session_id: body.session_id,
            ip_address,
            user_agent
        });
    }

    @Get('stats')
    async getStats() {
        return this.analyticsService.getStats();
    }

    @Get('visitors')
    async getVisitors(@Req() req: Request) {
        return this.analyticsService.getVisitors(req.query);
    }
}
