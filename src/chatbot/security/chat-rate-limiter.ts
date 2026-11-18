import { Injectable, HttpException, HttpStatus, OnModuleDestroy } from '@nestjs/common';

interface RateLimitRecord {
  timestamps: number[];
  lastWindowMs: number;
}

export class LlmUnavailableError extends Error {
  constructor(message = 'LLM service is currently busy. Please try again later.') {
    super(message);
    this.name = 'LlmUnavailableError';
  }
}

@Injectable()
export class ChatRateLimiter implements OnModuleDestroy {
  private readonly storage = new Map<string, RateLimitRecord>();
  private readonly MAX_KEYS = 50000;
  private readonly pruneTimer: NodeJS.Timeout;

  constructor() {
    this.pruneTimer = setInterval(() => this.prune(), 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
    }
  }

  consume(bucket: string, key: string, limit: number, windowMs: number): void {
    if (!key) return;
    const compoundKey = `${bucket}:${key}`;
    const now = Date.now();

    let record = this.storage.get(compoundKey);
    if (!record) {
      if (this.storage.size >= this.MAX_KEYS) {
        this.prune();
        if (this.storage.size >= this.MAX_KEYS) {
          throw new HttpException(
            { code: 'RATE_LIMITED', retry_after_s: 60 },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      record = { timestamps: [], lastWindowMs: windowMs };
      this.storage.set(compoundKey, record);
    }

    record.lastWindowMs = Math.max(record.lastWindowMs, windowMs);
    const windowStart = now - windowMs;
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= limit) {
      const oldest = record.timestamps[0];
      const retryAfterMs = oldest + windowMs - now;
      const retryAfterS = Math.max(1, Math.ceil(retryAfterMs / 1000));
      throw new HttpException(
        {
          code: 'RATE_LIMITED',
          retry_after_s: retryAfterS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    record.timestamps.push(now);
  }

  reset() {
    this.storage.clear();
  }

  private prune() {
    const now = Date.now();
    for (const [key, record] of this.storage.entries()) {
      const windowStart = now - (record.lastWindowMs || 3600000);
      record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
      if (record.timestamps.length === 0) {
        this.storage.delete(key);
      }
    }
  }
}

@Injectable()
export class LlmConcurrency {
  private activeCount = 0;
  private readonly waiters: Array<{ resolve: () => void; reject: (err: any) => void; timer: NodeJS.Timeout }> = [];

  async acquire(maxConcurrency: number = 8, waitTimeoutMs: number = 10000): Promise<() => void> {
    if (this.activeCount < maxConcurrency) {
      this.activeCount++;
      return () => this.release(maxConcurrency);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
          reject(new LlmUnavailableError('LLM concurrency limit reached, wait timed out'));
        }
      }, waitTimeoutMs);

      this.waiters.push({
        resolve: () => {
          clearTimeout(timer);
          resolve(() => this.release(maxConcurrency));
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
        timer,
      });
    });
  }

  private release(maxConcurrency: number) {
    if (this.waiters.length > 0) {
      const next = this.waiters.shift();
      if (next) {
        next.resolve();
        return;
      }
    }
    this.activeCount = Math.max(0, this.activeCount - 1);
  }
}
