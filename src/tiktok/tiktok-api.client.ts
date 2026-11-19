import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DemoModeService } from '../common/services/demo-mode.service';
import { TenantConfigService } from '../common/tenancy/tenant-config.service';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from '../common/tenancy/tenant-context';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');
import * as crypto from 'crypto';

interface ResolvedTikTokConfig {
    appKey: string;
    appSecret: string;
    redirectUri: string;
    authBaseUrl: string;
    apiBaseUrl: string;
}

/**
 * TikTok Shop API Client
 * Handles authentication, request signing, and API communication
 * for Customer Service (Inbox) and Content (Comments) APIs.
 */
@Injectable()
export class TikTokApiClient {
    private readonly logger = new Logger(TikTokApiClient.name);

    constructor(
        private configService: ConfigService,
        private readonly demoModeService: DemoModeService,
        @Optional() private readonly tenantConfigService?: TenantConfigService,
    ) {}

    private async getClientConfig(): Promise<ResolvedTikTokConfig> {
        if (this.tenantConfigService) {
            const cfg = await this.tenantConfigService.getMany([
                'TIKTOK_APP_KEY',
                'TIKTOK_APP_SECRET',
                'TIKTOK_REDIRECT_URI',
                'TIKTOK_AUTH_URL',
                'TIKTOK_API_BASE_URL',
            ]);
            return {
                appKey: cfg['TIKTOK_APP_KEY'] || '',
                appSecret: cfg['TIKTOK_APP_SECRET'] || '',
                redirectUri:
                    cfg['TIKTOK_REDIRECT_URI'] ||
                    'https://localhost:3000/api/tiktok/auth/callback',
                authBaseUrl:
                    cfg['TIKTOK_AUTH_URL'] || 'https://auth.tiktok-shops.com',
                apiBaseUrl:
                    cfg['TIKTOK_API_BASE_URL'] ||
                    'https://open-api.tiktokglobalshop.com',
            };
        }

        const isDefault =
            TenantContext.current().tenantId === DEFAULT_TENANT_CONTEXT.tenantId;
        const readEnv = (k: string, def: string) =>
            isDefault ? this.configService.get<string>(k, def) : def;

        return {
            appKey: readEnv('TIKTOK_APP_KEY', ''),
            appSecret: readEnv('TIKTOK_APP_SECRET', ''),
            redirectUri: readEnv(
                'TIKTOK_REDIRECT_URI',
                'https://localhost:3000/api/tiktok/auth/callback',
            ),
            authBaseUrl: readEnv(
                'TIKTOK_AUTH_URL',
                'https://auth.tiktok-shops.com',
            ),
            apiBaseUrl: readEnv(
                'TIKTOK_API_BASE_URL',
                'https://open-api.tiktokglobalshop.com',
            ),
        };
    }

    // ===================== AUTH =====================

    /**
     * Generate the TikTok Shop authorization URL
     * User will be redirected here to grant permissions
     */
    async getAuthorizationUrl(state?: string): Promise<string> {
        const cfg = await this.getClientConfig();
        const params = new URLSearchParams({
            app_key: cfg.appKey,
            state: state || crypto.randomUUID(),
        });
        return `https://services.tiktokshop.com/open/authorize?${params.toString()}`;
    }

    /**
     * Exchange authorization code for access token
     */
    async getAccessToken(code: string): Promise<{
        access_token: string;
        refresh_token: string;
        access_token_expire_in: number;
        refresh_token_expire_in: number;
        open_id: string;
        seller_name: string;
    }> {
        const cfg = await this.getClientConfig();
        const url = `${cfg.authBaseUrl}/api/v2/token/get`;
        const response = await axios.post(url, null, {
            params: {
                app_key: cfg.appKey,
                app_secret: cfg.appSecret,
                auth_code: code,
                grant_type: 'authorized_code',
            },
        });

        if (response.data.code !== 0) {
            this.logger.error(`Token exchange failed: ${JSON.stringify(response.data)}`);
            throw new Error(`TikTok token exchange failed: ${response.data.message}`);
        }

        return response.data.data;
    }

    /**
     * Refresh an expired access token
     */
    async refreshAccessToken(refreshToken: string): Promise<{
        access_token: string;
        refresh_token: string;
        access_token_expire_in: number;
        refresh_token_expire_in: number;
    }> {
        const cfg = await this.getClientConfig();
        const url = `${cfg.authBaseUrl}/api/v2/token/refresh`;
        const response = await axios.post(url, null, {
            params: {
                app_key: cfg.appKey,
                app_secret: cfg.appSecret,
                refresh_token: refreshToken,
                grant_type: 'refresh_token',
            },
        });

        if (response.data.code !== 0) {
            throw new Error(`TikTok token refresh failed: ${response.data.message}`);
        }

        return response.data.data;
    }

    // ===================== REQUEST SIGNING =====================

    /**
     * Generate HMAC-SHA256 signature for TikTok Shop API requests
     * Following TikTok's signing algorithm:
     * 1. Sort all query params alphabetically
     * 2. Concatenate: app_secret + path + sorted_params + app_secret
     * 3. HMAC-SHA256 with app_secret
     */
    private generateSign(
        appSecret: string,
        path: string,
        params: Record<string, string>,
        body?: string,
    ): string {
        // Sort params by key, exclude 'sign' and 'access_token'
        const sortedKeys = Object.keys(params)
            .filter(k => k !== 'sign' && k !== 'access_token')
            .sort();

        let baseString = appSecret + path;

        for (const key of sortedKeys) {
            baseString += key + params[key];
        }

        // Append body for POST requests
        if (body) {
            baseString += body;
        }

        baseString += appSecret;

        return crypto
            .createHmac('sha256', appSecret)
            .update(baseString)
            .digest('hex');
    }

    /**
     * Make a signed API request to TikTok Shop
     */
    private async signedRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'DELETE',
        path: string,
        accessToken: string,
        queryParams?: Record<string, string>,
        body?: any,
        shopCipher?: string,
    ): Promise<T> {
        const cfg = await this.getClientConfig();
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const params: Record<string, string> = {
            app_key: cfg.appKey,
            timestamp,
            ...queryParams,
        };

        if (shopCipher) {
            params.shop_cipher = shopCipher;
        }

        const bodyStr = body ? JSON.stringify(body) : undefined;
        params.sign = this.generateSign(cfg.appSecret, path, params, bodyStr);

        const config: any = {
            baseURL: cfg.apiBaseUrl,
            timeout: 30000,
            method,
            url: path,
            params,
            headers: {
                'Content-Type': 'application/json',
                'x-tts-access-token': accessToken,
            },
        };

        if (body) {
            config.data = body;
        }

        try {
            const response = await axios.request(config);

            if (response.data.code !== 0) {
                this.logger.error(`TikTok API error [${path}]: ${JSON.stringify(response.data)}`);
                throw new Error(`TikTok API error: ${response.data.message} (code: ${response.data.code})`);
            }

            return response.data.data;
        } catch (error) {
            if (error.response) {
                this.logger.error(`TikTok API HTTP error [${path}]: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            }
            throw error;
        }
    }

    // ===================== CUSTOMER SERVICE (INBOX) API =====================

    /**
     * Search conversations (inbox sessions)
     */
    async getConversations(
        accessToken: string,
        options?: {
            page_size?: number;
            page_token?: string;
            sort_order?: 'ASC' | 'DESC';
        },
        shopCipher?: string,
    ): Promise<{
        conversations: any[];
        next_page_token: string;
        total: number;
    }> {
        return this.signedRequest(
            'POST',
            '/customer_service/202309/conversations/search',
            accessToken,
            undefined,
            {
                page_size: options?.page_size || 20,
                page_token: options?.page_token || '',
                sort_order: options?.sort_order || 'DESC',
            },
            shopCipher,
        );
    }

    /**
     * Get messages within a conversation
     */
    async getMessages(
        accessToken: string,
        conversationId: string,
        options?: {
            page_size?: number;
            page_token?: string;
            locale?: string;
            sort_order?: 'ASC' | 'DESC';
        },
        shopCipher?: string,
    ): Promise<{
        messages: any[];
        next_page_token: string;
    }> {
        const queryParams: Record<string, string> = {
            page_size: String(options?.page_size || 10),
        };
        if (options?.page_token) queryParams.page_token = options.page_token;
        if (options?.locale) queryParams.locale = options.locale;
        if (options?.sort_order) queryParams.sort_order = options.sort_order;

        return this.signedRequest(
            'GET',
            `/customer_service/202309/conversations/${conversationId}/messages`,
            accessToken,
            queryParams,
            undefined,
            shopCipher,
        );
    }

    /**
     * Send a message in a conversation
     */
    async sendMessage(
        accessToken: string,
        conversationId: string,
        type: 'TEXT' | 'IMAGE' | 'PRODUCT_CARD',
        content: string,
        shopCipher?: string,
    ): Promise<any> {
        if (this.demoModeService.guard('TIKTOK', conversationId)) {
            return {
                message_id: `DEMO-TIKTOK-${Date.now()}`,
                create_time: Date.now(),
                demo: true,
            };
        }
        return this.signedRequest(
            'POST',
            `/customer_service/202309/conversations/${conversationId}/messages`,
            accessToken,
            undefined,
            { type, content },
            shopCipher,
        );
    }

    // ===================== COMMENTS API (Organic/Content) =====================

    /**
     * Get comments for a video
     * Uses TikTok Content API (for owned organic content)
     */
    async getVideoComments(
        accessToken: string,
        videoId: string,
        options?: {
            max_count?: number;
            cursor?: number;
        },
    ): Promise<{
        comments: any[];
        cursor: number;
        has_more: boolean;
        total: number;
    }> {
        // Content/Organic API uses a different base URL
        const url = 'https://open.tiktokapis.com/v2/video/comment/list/';
        const response = await axios.post(
            url,
            {
                video_id: videoId,
                max_count: options?.max_count || 50,
                cursor: options?.cursor || 0,
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                params: {
                    fields: 'id,text,like_count,create_time,video_id,parent_comment_id',
                },
            },
        );

        return response.data.data;
    }

    /**
     * Reply to a comment on an organic video
     */
    async replyToComment(
        accessToken: string,
        videoId: string,
        commentId: string,
        text: string,
    ): Promise<any> {
        if (this.demoModeService.guard('TIKTOK', commentId)) {
            return {
                comment_id: `DEMO-CMT-${Date.now()}`,
                text,
                create_time: Date.now(),
                demo: true,
            };
        }
        const url = 'https://open.tiktokapis.com/v2/video/comment/reply/';
        const response = await axios.post(
            url,
            {
                video_id: videoId,
                comment_id: commentId,
                text,
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            },
        );

        return response.data.data;
    }

    // ===================== WEBHOOK =====================

    /**
     * Verify webhook signature from TikTok
     */
    async verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
        const cfg = await this.getClientConfig();
        const expectedSign = crypto
            .createHmac('sha256', cfg.appSecret)
            .update(body)
            .digest('hex');
        return expectedSign === signature;
    }
}
