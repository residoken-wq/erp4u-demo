import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const DEMO_USERNAMES = ['admin', 'sales01', 'warehouse01', 'accountant01', 'hr01'];

@Injectable()
export class DemoModeService {
    private readonly logger = new Logger(DemoModeService.name);

    constructor(private readonly configService: ConfigService) {}

    /**
     * Checks if DEMO_MODE is enabled (via ConfigService or process.env).
     */
    isDemoMode(): boolean {
        const val = this.configService.get<string | boolean>('DEMO_MODE');
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') return val.trim().toLowerCase() === 'true';
        return process.env.DEMO_MODE === 'true';
    }

    /**
     * Intercepts and guards outbound mutations when DEMO_MODE is active.
     * Logs: [DEMO_MODE] skipped <channel> to <recipientId> without sensitive data (no email, phone, or body content).
     * Returns true if demo mode is active and the operation was skipped.
     */
    guard(channel: string, recipientId?: string | number): boolean {
        if (!this.isDemoMode()) {
            return false;
        }

        const targetId = recipientId !== undefined && recipientId !== null ? String(recipientId) : 'anonymous';
        this.logger.warn(`[DEMO_MODE] skipped ${channel} to ${targetId}`);
        return true;
    }

    /**
     * Checks if a given username belongs to the protected demo accounts.
     */
    isDemoUser(username?: string): boolean {
        if (!username) return false;
        return DEMO_USERNAMES.includes(username.toLowerCase().trim());
    }
}
