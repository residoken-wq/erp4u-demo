import { Controller, Post, Body, Req, Logger, HttpCode } from '@nestjs/common';
import { TikTokService } from './tiktok.service';
import { TikTokApiClient } from './tiktok-api.client';
import { Request } from 'express';

@Controller('tiktok/webhook')
export class TikTokWebhookController {
    private readonly logger = new Logger(TikTokWebhookController.name);

    constructor(
        private readonly tiktokService: TikTokService,
        private readonly apiClient: TikTokApiClient,
    ) { }

    /**
     * POST /tiktok/webhook
     * Receives webhook events from TikTok Shop
     * Events: NEW_MESSAGE, ORDER_STATUS_CHANGE, etc.
     */
    @Post()
    @HttpCode(200)
    async handleWebhook(@Body() body: any, @Req() req: Request) {
        const signature = req.headers['x-tts-signature'] as string;

        // Verify webhook signature (optional but recommended)
        if (signature) {
            const rawBody = JSON.stringify(body);
            const isValid = this.apiClient.verifyWebhookSignature(rawBody, signature);
            if (!isValid) {
                this.logger.warn('Invalid webhook signature received');
                return { code: 0, message: 'Invalid signature' };
            }
        }

        const eventType = body.type || body.event_type;
        const payload = body.data || body;

        this.logger.log(`Webhook received: type=${eventType}, shop_id=${body.shop_id}`);

        try {
            await this.tiktokService.handleWebhookEvent(eventType, payload);
        } catch (error) {
            this.logger.error(`Webhook processing error: ${error.message}`);
        }

        // Always return 200 to prevent TikTok from retrying
        return { code: 0, message: 'success' };
    }
}
