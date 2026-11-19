import { ConfigService } from '@nestjs/config';

export function getPublicAppUrl(configService?: ConfigService): string {
    const raw = configService?.get<string>('PUBLIC_APP_URL') || process.env.PUBLIC_APP_URL || 'http://localhost:5173';
    return raw.replace(/\/+$/, '');
}

export function buildPortalQuoteUrl(orderUuid: string, configService?: ConfigService): string {
    return `${getPublicAppUrl(configService)}/portal/quote/${orderUuid}`;
}

export function buildRecruitmentPortalUrl(token: string, configService?: ConfigService): string {
    return `${getPublicAppUrl(configService)}/portal/recruitment/${token}`;
}
