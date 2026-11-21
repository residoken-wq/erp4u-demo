import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { RateLimitRecord, RateLimitStore } from './rate-limit.types';

/**
 * In-memory implementation of RateLimitStore.
 *
 * NOTE / LIMITATION:
 * This store runs inside a single Node.js process memory.
 * - Multi-instance or auto-scaled deployments require a shared store (e.g., Redis)
 *   implementing RateLimitStore, which can be swapped in ERP4U Cloud without
 *   changing rate limit guards or controllers.
 */
@Injectable()
export class MemoryRateLimitStore implements RateLimitStore, OnModuleDestroy {
  private readonly records = new Map<string, RateLimitRecord>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically evict expired keys every 60 seconds to prevent unbounded memory growth
    this.cleanupTimer = setInterval(() => {
      this.evictExpired();
    }, 60_000);
    // Allow process to exit cleanly without waiting for this interval
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  get(key: string): RateLimitRecord | null {
    const record = this.records.get(key);
    if (!record) return null;

    if (Date.now() >= record.resetAt) {
      this.records.delete(key);
      return null;
    }
    return record;
  }

  increment(key: string, ttlMs: number): RateLimitRecord {
    const now = Date.now();
    const existing = this.records.get(key);

    if (!existing || now >= existing.resetAt) {
      const newRecord: RateLimitRecord = {
        count: 1,
        resetAt: now + ttlMs,
      };
      this.records.set(key, newRecord);
      return newRecord;
    }

    existing.count += 1;
    return existing;
  }

  reset(key: string): void {
    this.records.delete(key);
  }

  clear(): void {
    this.records.clear();
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, record] of this.records.entries()) {
      if (now >= record.resetAt) {
        this.records.delete(key);
      }
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}
