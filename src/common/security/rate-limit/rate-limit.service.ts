import { Inject, Injectable } from '@nestjs/common';
import {
  RATE_LIMIT_STORE,
  RateLimitCheckResult,
  RateLimitRecord,
  RateLimitStore,
} from './rate-limit.types';
import { RateLimitedException } from './rate-limit.exception';
import { TenantContext } from '../../tenancy/tenant-context';

@Injectable()
export class RateLimitService {
  constructor(
    @Inject(RATE_LIMIT_STORE)
    private readonly store: RateLimitStore,
  ) {}

  /**
   * Extract normalized client IP from Express request, respecting reverse proxy headers.
   */
  getClientIp(req: any): string {
    if (!req) return '127.0.0.1';
    if (req.ip && typeof req.ip === 'string') return req.ip;

    const forwarded = req.headers?.['x-forwarded-for'];
    if (forwarded) {
      const list = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      const ip = list.split(',')[0].trim();
      if (ip) return ip;
    }

    return req.socket?.remoteAddress || '127.0.0.1';
  }

  /**
   * Extract current tenantId safely from TenantContext (defaults to 'default').
   */
  getCurrentTenantId(): string {
    try {
      return TenantContext.current()?.tenantId || 'default';
    } catch {
      return 'default';
    }
  }

  /**
   * Normalize an identifier (email, username, phone) to lowercase and trimmed string.
   */
  normalizeIdentifier(identifier?: string | null): string {
    if (!identifier || typeof identifier !== 'string') return '';
    return identifier.trim().toLowerCase();
  }

  /**
   * Build composite tenant-isolated key for storage.
   * Format: rl:<tenantId>:<prefix>:<normalizedIdentifier>
   */
  buildKey(prefix: string, identifier: string, tenantId?: string): string {
    const tid = tenantId || this.getCurrentTenantId();
    const cleanId = this.normalizeIdentifier(identifier);
    return `rl:${tid}:${prefix}:${cleanId}`;
  }

  /**
   * Check if a key has reached or exceeded max allowed attempts.
   */
  async checkLimit(key: string, max: number): Promise<RateLimitCheckResult> {
    const record = await this.store.get(key);
    if (!record) {
      return { isBlocked: false, retryAfter: 0, current: 0, max };
    }

    if (record.count >= max) {
      const now = Date.now();
      const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      return { isBlocked: true, retryAfter, current: record.count, max };
    }

    return {
      isBlocked: false,
      retryAfter: 0,
      current: record.count,
      max,
    };
  }

  /**
   * Assert key is not rate limited. If it is, throw RateLimitedException.
   */
  async assertNotRateLimited(key: string, max: number): Promise<void> {
    const check = await this.checkLimit(key, max);
    if (check.isBlocked) {
      throw new RateLimitedException(check.retryAfter);
    }
  }

  /**
   * Record a hit (increment counter) and check against max.
   * If exceeded, throws RateLimitedException immediately.
   */
  async consume(
    key: string,
    ttlMs: number,
    max: number,
  ): Promise<RateLimitCheckResult> {
    // Check beforehand
    await this.assertNotRateLimited(key, max);

    // Increment
    const record = await this.store.increment(key, ttlMs);
    if (record.count > max) {
      const now = Date.now();
      const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      throw new RateLimitedException(retryAfter);
    }

    return {
      isBlocked: false,
      retryAfter: 0,
      current: record.count,
      max,
    };
  }

  /**
   * Increment counter for a failed event (e.g. login failed, verify OTP failed).
   */
  async recordFailure(key: string, ttlMs: number): Promise<RateLimitRecord> {
    return await this.store.increment(key, ttlMs);
  }

  /**
   * Reset / clear key (e.g. successful login resets IP+username failure counter).
   */
  async reset(key: string): Promise<void> {
    await this.store.reset(key);
  }

  /**
   * Clear all records in store (for testing).
   */
  async clearAll(): Promise<void> {
    await this.store.clear();
  }

  // ============================================================
  // Configuration Helpers (read environment variables dynamically)
  // ============================================================

  getLoginUserMax(): number {
    const val = process.env.RATE_LIMIT_LOGIN_USER_MAX;
    return val ? parseInt(val, 10) || 10 : 10;
  }

  getLoginUserWindowMs(): number {
    const sec = process.env.RATE_LIMIT_LOGIN_USER_WINDOW_SEC;
    return (sec ? parseInt(sec, 10) || 900 : 900) * 1000;
  }

  getLoginIpMax(): number {
    const val = process.env.RATE_LIMIT_LOGIN_IP_MAX;
    return val ? parseInt(val, 10) || 50 : 50;
  }

  getLoginIpWindowMs(): number {
    const sec = process.env.RATE_LIMIT_LOGIN_IP_WINDOW_SEC;
    return (sec ? parseInt(sec, 10) || 900 : 900) * 1000;
  }

  getPortalOtpIdentifierMax(): number {
    const val = process.env.RATE_LIMIT_PORTAL_OTP_IDENTIFIER_MAX;
    return val ? parseInt(val, 10) || 5 : 5;
  }

  getPortalOtpIdentifierWindowMs(): number {
    const sec = process.env.RATE_LIMIT_PORTAL_OTP_IDENTIFIER_WINDOW_SEC;
    return (sec ? parseInt(sec, 10) || 900 : 900) * 1000;
  }

  getPortalOtpIpMax(): number {
    const val = process.env.RATE_LIMIT_PORTAL_OTP_IP_MAX;
    return val ? parseInt(val, 10) || 20 : 20;
  }

  getPortalOtpIpWindowMs(): number {
    const sec = process.env.RATE_LIMIT_PORTAL_OTP_IP_WINDOW_SEC;
    return (sec ? parseInt(sec, 10) || 900 : 900) * 1000;
  }

  getPortalOtpVerifyMax(): number {
    const val = process.env.RATE_LIMIT_PORTAL_OTP_VERIFY_MAX;
    return val ? parseInt(val, 10) || 5 : 5;
  }

  getRecruitmentIpMax(): number {
    const val = process.env.RATE_LIMIT_RECRUITMENT_IP_MAX;
    return val ? parseInt(val, 10) || 20 : 20;
  }

  getRecruitmentIpWindowMs(): number {
    const sec = process.env.RATE_LIMIT_RECRUITMENT_IP_WINDOW_SEC;
    return (sec ? parseInt(sec, 10) || 900 : 900) * 1000;
  }
}
