import { Controller, Get, Query, Res } from '@nestjs/common';
import { TikTokService } from './tiktok.service';
import { Response } from 'express';

@Controller('tiktok/auth')
export class TikTokAuthController {
    constructor(private readonly tiktokService: TikTokService) { }

    /**
     * GET /tiktok/auth/url
     * Generates the TikTok Shop authorization URL
     * Frontend redirects user to this URL to grant permissions
     */
    @Get('url')
    getAuthUrl(@Query('state') state?: string) {
        const url = this.tiktokService.getAuthorizationUrl(state);
        return { url };
    }

    /**
     * GET /tiktok/auth/callback
     * OAuth callback handler — TikTok redirects here after user approval
     * Exchanges authorization code for access/refresh tokens
     */
    @Get('callback')
    async handleCallback(
        @Query('code') code: string,
        @Query('state') state: string,
        @Res() res: Response,
    ) {
        try {
            const channel = await this.tiktokService.handleAuthCallback(code);
            // Redirect to frontend with success
            return res.redirect(`/social/channels?tiktok_connected=true&channel_id=${channel.id}`);
        } catch (error) {
            // Redirect with error
            return res.redirect(`/social/channels?tiktok_error=${encodeURIComponent(error.message)}`);
        }
    }

    /**
     * GET /tiktok/auth/channels
     * List all connected TikTok channels
     */
    @Get('channels')
    async getChannels() {
        return this.tiktokService.getTikTokChannels();
    }
}
