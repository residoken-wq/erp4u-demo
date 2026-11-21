/**
 * Rate Limit Types & Storage Interface
 *
 * Designed for ERP4U Open Core.
 * Note on Architecture:
 * - Default store is in-process memory (MemoryRateLimitStore), suitable for single-instance deployments.
 * - Multi-instance / clustered deployments (such as ERP4U Cloud) can implement RateLimitStore
 *   backed by Redis or an external distributed cache.
 */

export interface RateLimitRecord {
  /**
   * Current number of counted hits/failures in the active window
   */
  count: number;

  /**
   * Epoch timestamp in milliseconds when the active window resets
   */
  resetAt: number;
}

export interface RateLimitStore {
  /**
   * Retrieve current rate limit record for key, or null if expired/non-existent.
   */
  get(key: string): Promise<RateLimitRecord | null> | RateLimitRecord | null;

  /**
   * Increment counter for key with TTL in milliseconds.
   * If key does not exist or has expired, creates new record with count=1 and resetAt=now + ttlMs.
   */
  increment(
    key: string,
    ttlMs: number,
  ): Promise<RateLimitRecord> | RateLimitRecord;

  /**
   * Reset / remove counter for key (e.g. after successful login).
   */
  reset(key: string): Promise<void> | void;

  /**
   * Clear all records in store (primarily for test isolation).
   */
  clear(): Promise<void> | void;
}

export const RATE_LIMIT_STORE = Symbol('RATE_LIMIT_STORE');

export interface RateLimitCheckResult {
  isBlocked: boolean;
  retryAfter: number;
  current: number;
  max: number;
}
