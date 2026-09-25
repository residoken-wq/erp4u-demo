import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { RbacAccessLog } from './entities/rbac-access-log.entity';

@Injectable()
export class RbacAccessLogService implements OnModuleInit {
  private dedupeMap = new Map<string, number>();

  constructor(
    @InjectRepository(RbacAccessLog)
    private logRepo: Repository<RbacAccessLog>,
  ) {}

  async onModuleInit() {
    try {
      await this.logRepo.manager.query(`
        CREATE TABLE IF NOT EXISTS rbac_access_logs (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          mode VARCHAR(10) NOT NULL,
          decision VARCHAR(20) NOT NULL,
          method VARCHAR(8) NOT NULL,
          route VARCHAR(255) NOT NULL,
          required VARCHAR(255),
          user_id INT,
          username VARCHAR(100),
          group_id INT,
          ip VARCHAR(64),
          user_agent VARCHAR(200)
        );
        CREATE INDEX IF NOT EXISTS idx_rbac_access_logs_created_at ON rbac_access_logs (created_at);
        CREATE INDEX IF NOT EXISTS idx_rbac_access_logs_route_decision ON rbac_access_logs (route, decision);
      `);
    } catch (e) {
      console.error('[RbacAccessLogService] DDL Migration error:', e);
    }
  }

  async record(entry: {
    mode: string;
    decision: string;
    method: string;
    route: string;
    required?: string | null;
    user_id?: number | null;
    username?: string | null;
    group_id?: number | null;
    ip?: string | null;
    user_agent?: string | null;
  }): Promise<void> {
    try {
      const isUnclassified = entry.decision === 'UNCLASSIFIED';
      const key = isUnclassified
        ? `UNCLASSIFIED|${entry.method}|${entry.route}`
        : `${entry.method}|${entry.route}|${entry.user_id ?? 'anon'}|${entry.decision}|${entry.ip ?? ''}`;
      const ttl = isUnclassified ? 60 * 60 * 1000 : 5 * 60 * 1000;
      const now = Date.now();
      const lastSeen = this.dedupeMap.get(key);
      if (lastSeen && now - lastSeen < ttl) {
        return;
      }
      this.dedupeMap.set(key, now);

      if (this.dedupeMap.size > 5000) {
        for (const [k, timestamp] of this.dedupeMap.entries()) {
          const itemTtl = k.startsWith('UNCLASSIFIED|') ? 60 * 60 * 1000 : 5 * 60 * 1000;
          if (now - timestamp > itemTtl) {
            this.dedupeMap.delete(k);
          }
        }
      }

      const log = this.logRepo.create({
        mode: entry.mode,
        decision: entry.decision,
        method: entry.method,
        route: entry.route,
        required: entry.required || null,
        user_id: entry.user_id ?? null,
        username: entry.username ?? null,
        group_id: entry.group_id ?? null,
        ip: entry.ip ?? null,
        user_agent: entry.user_agent ? entry.user_agent.slice(0, 200) : null,
      });

      await this.logRepo.save(log);
    } catch (e) {
      // Must not crash or block execution
      console.error('[RbacAccessLogService] Error recording access log:', e);
    }
  }

  @Cron('0 3 * * *')
  async cleanOldLogs() {
    try {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      await this.logRepo
        .createQueryBuilder()
        .delete()
        .from(RbacAccessLog)
        .where('created_at < :date', { date: ninetyDaysAgo })
        .execute();
      console.log('[RbacAccessLogService] Cleaned logs older than 90 days');
    } catch (e) {
      console.error('[RbacAccessLogService] Error cleaning old logs:', e);
    }
  }

  async getReport(from?: string, to?: string, decision?: string) {
    let query = this.logRepo
      .createQueryBuilder('log')
      .select('log.method', 'method')
      .addSelect('log.route', 'route')
      .addSelect('log.decision', 'decision')
      .addSelect('log.required', 'required')
      .addSelect('log.username', 'username')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('MAX(log.created_at)', 'last_seen')
      .addSelect('(ARRAY_AGG(DISTINCT log.ip) FILTER (WHERE log.ip IS NOT NULL))[1:5]', 'ips');

    if (from) {
      query = query.andWhere('log.created_at >= :from', { from: new Date(from) });
    }
    if (to) {
      const toDate = to.length <= 10 ? new Date(`${to}T23:59:59.999Z`) : new Date(to);
      query = query.andWhere('log.created_at <= :to', { to: toDate });
    }
    if (decision && decision !== 'ALL') {
      query = query.andWhere('log.decision = :decision', { decision });
    }

    query = query
      .groupBy('log.method')
      .addGroupBy('log.route')
      .addGroupBy('log.decision')
      .addGroupBy('log.required')
      .addGroupBy('log.username')
      .orderBy('count', 'DESC')
      .limit(1000);

    return await query.getRawMany();
  }

  async getUnclassifiedRoutes() {
    return await this.logRepo
      .createQueryBuilder('log')
      .select('log.route', 'route')
      .addSelect('log.method', 'method')
      .addSelect('COUNT(*)::int', 'hit_count')
      .addSelect('MIN(log.created_at)', 'first_seen')
      .addSelect('MAX(log.created_at)', 'last_seen')
      .where("log.decision = 'UNCLASSIFIED'")
      .groupBy('log.route')
      .addGroupBy('log.method')
      .orderBy('hit_count', 'DESC')
      .limit(1000)
      .getRawMany();
  }
}
