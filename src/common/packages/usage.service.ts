import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsageCounter } from './usage-counter.entity';

@Injectable()
export class UsageService {
  private readonly logger = new Logger(UsageService.name);

  constructor(
    @InjectRepository(UsageCounter)
    private readonly repo: Repository<UsageCounter>,
  ) {}

  getCurrentPeriod(date: Date = new Date()): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  async increment(
    metric: string,
    by: number = 1,
    tenantId: string = 'default',
    period?: string,
  ): Promise<void> {
    if (!metric || !Number.isFinite(by) || by === 0) {
      return;
    }

    const targetPeriod = period || this.getCurrentPeriod();

    try {
      await this.repo.query(
        `INSERT INTO usage_counter (tenant_id, metric, period, value, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (tenant_id, metric, period)
         DO UPDATE SET value = usage_counter.value + EXCLUDED.value, updated_at = NOW()`,
        [tenantId, metric, targetPeriod, by],
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to increment usage_counter (tenant=${tenantId}, metric=${metric}, period=${targetPeriod}, by=${by}): ${err?.message || err}`,
      );
    }
  }
}
