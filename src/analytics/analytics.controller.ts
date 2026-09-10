import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Request } from 'express';

function isPrivateOrLocalIp(ip?: string): boolean {
    if (!ip) return true;
    const clean = ip.trim().replace(/^::ffff:/, '');
    if (
        clean === '127.0.0.1' ||
        clean === '::1' ||
        clean === 'localhost' ||
        clean.startsWith('192.168.') ||
        clean.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)
    ) {
        return true;
    }
    return false;
}

@Controller('public/analytics')
export class AnalyticsController {
    constructor(private readonly analyticsService: AnalyticsService) { }

    @Post('ping')
    async ping(
        @Body() body: { session_id: string; client_ip?: string; user_agent?: string },
        @Req() req: Request
    ) {
        if (!body.session_id) {
            return { success: false, error: 'session_id is required' };
        }

        // 1. Cloudflare connecting IP
        const cfIp = req.headers['cf-connecting-ip'] as string;
        // 2. Cloudflare country code (e.g. 'VN', 'US')
        const cfCountry = req.headers['cf-ipcountry'] as string;
        // 3. True-Client-IP
        const trueClientIp = req.headers['true-client-ip'] as string;
        // 4. X-Real-IP
        const xRealIp = req.headers['x-real-ip'] as string;
        // 5. X-Forwarded-For (take the first client IP in chain)
        const xForwardedFor = req.headers['x-forwarded-for'] as string;
        let xffFirst: string | undefined;
        if (xForwardedFor) {
            const parts = xForwardedFor.split(',').map(p => p.trim()).filter(Boolean);
            if (parts.length > 0) {
                const nonPrivate = parts.find(p => !isPrivateOrLocalIp(p));
                xffFirst = nonPrivate || parts[0];
            }
        }

        // Determine server-detected IP
        let ip_address = cfIp || trueClientIp || xRealIp || xffFirst || req.ip || req.socket.remoteAddress || '';
        ip_address = ip_address.replace(/^::ffff:/, '').trim();

        // If server-detected IP is private/local and client reported a public client_ip in payload
        if (isPrivateOrLocalIp(ip_address) && body.client_ip && !isPrivateOrLocalIp(body.client_ip)) {
            ip_address = body.client_ip.trim();
        }

        const user_agent = body.user_agent || (req.headers['user-agent'] as string) || '';

        return this.analyticsService.ping({
            session_id: body.session_id,
            ip_address,
            user_agent,
            country: cfCountry && cfCountry !== 'XX' ? cfCountry : undefined,
        });
    }

    @Get('stats')
    async getStats(@Req() req: Request) {
        return this.analyticsService.getStats(req.query);
    }

    @Get('visitors')
    async getVisitors(@Req() req: Request) {
        return this.analyticsService.getVisitors(req.query);
    }
}
