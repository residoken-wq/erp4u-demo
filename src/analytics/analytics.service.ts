import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsVisitor } from './analytics-visitor.entity';
import { Repository, Between } from 'typeorm';
import * as dayjs from 'dayjs';

function isPrivateOrLocalIp(ip?: string): boolean {
    if (!ip) return true;
    const clean = ip.trim().replace(/^::ffff:/, '');
    if (
        clean === '127.0.0.1' ||
        clean === '::1' ||
        clean === 'localhost' ||
        clean.startsWith('192.168.') ||
        clean.startsWith('10.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(clean)
    ) {
        return true;
    }
    return false;
}

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        @InjectRepository(AnalyticsVisitor)
        private visitorRepo: Repository<AnalyticsVisitor>,
    ) { }

    private isBotUserAgent(ua?: string): boolean {
        if (!ua) return false;
        const botKeywords = [
            'bot', 'crawl', 'spider', 'slurp', 'lightpanda', 'headless',
            'python', 'curl', 'wget', 'postman', 'bytespider', 'semrush',
            'ahrefs', 'petalbot', 'yandex', 'bingbot', 'googlebot', 'duckduckbot',
            'dotbot', 'zoominfobot', 'screaming frog', 'lighthouse', 'inspect'
        ];
        const lower = ua.toLowerCase();
        return botKeywords.some(keyword => lower.includes(keyword));
    }

    private async resolveIpCountry(ip: string, visitor: AnalyticsVisitor) {
        if (isPrivateOrLocalIp(ip)) return;
        try {
            const cleanIp = ip.split(',')[0].trim().replace(/^::ffff:/, '');
            if (isPrivateOrLocalIp(cleanIp)) return;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`http://ip-api.com/json/${cleanIp}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data.status === 'success') {
                    if (data.country) visitor.country = data.country;
                    if (data.city) visitor.city = data.city;
                    await this.visitorRepo.save(visitor);
                }
            }
        } catch (error) {
            // Silently fail on timeout or error
        }
    }

    async ping(data: {
        session_id: string;
        ip_address?: string;
        user_agent?: string;
        country?: string;
        city?: string;
    }) {
        try {
            const isBot = this.isBotUserAgent(data.user_agent);

            let visitor = await this.visitorRepo.findOne({
                where: { session_id: data.session_id }
            });

            let ipNeedsResolve = false;

            if (visitor) {
                visitor.last_active = new Date();
                visitor.is_bot = isBot;

                if (data.ip_address && visitor.ip_address !== data.ip_address) {
                    visitor.ip_address = data.ip_address;
                    ipNeedsResolve = !visitor.country;
                } else if (data.ip_address && !visitor.country) {
                    ipNeedsResolve = true;
                }

                if (data.country && !visitor.country) visitor.country = data.country;
                if (data.city && !visitor.city) visitor.city = data.city;
                if (data.user_agent && !visitor.user_agent) visitor.user_agent = data.user_agent;
            } else {
                visitor = this.visitorRepo.create({
                    session_id: data.session_id,
                    ip_address: data.ip_address,
                    user_agent: data.user_agent,
                    country: data.country || undefined,
                    city: data.city || undefined,
                    is_bot: isBot,
                    last_active: new Date(),
                });
                if (data.ip_address && !data.country) {
                    ipNeedsResolve = true;
                }
            }

            const savedVisitor = await this.visitorRepo.save(visitor);

            if (ipNeedsResolve && savedVisitor.ip_address && !isPrivateOrLocalIp(savedVisitor.ip_address)) {
                this.resolveIpCountry(savedVisitor.ip_address, savedVisitor);
            }

            return { success: true };
        } catch (error) {
            this.logger.error('Error in ping: Table might not exist yet', error);
            return { success: false, error: 'Initialization error' };
        }
    }

    async getStats(query?: any) {
        try {
            const todayStart = dayjs().startOf('day').toDate();
            const todayEnd = dayjs().endOf('day').toDate();
            // 3 minutes timeout for "online"
            const onlineThreshold = dayjs().subtract(3, 'minute').toDate();

            const totalVisitors = await this.visitorRepo.count();

            // Today's total visitors
            const todayVisitors = await this.visitorRepo.count({
                where: {
                    created_at: Between(todayStart, todayEnd)
                }
            });

            // Online visitors
            const onlineVisitors = await this.visitorRepo.createQueryBuilder('visitor')
                .where('visitor.last_active >= :threshold', { threshold: onlineThreshold })
                .getCount();

            // Non-bot counts
            let todayRealVisitors = todayVisitors;
            let onlineRealVisitors = onlineVisitors;
            let uniqueIpsToday = 0;

            try {
                todayRealVisitors = await this.visitorRepo.count({
                    where: {
                        created_at: Between(todayStart, todayEnd),
                        is_bot: false,
                    }
                });

                onlineRealVisitors = await this.visitorRepo.createQueryBuilder('visitor')
                    .where('visitor.last_active >= :threshold', { threshold: onlineThreshold })
                    .andWhere('visitor.is_bot = false')
                    .getCount();

                const uniqueIpResult = await this.visitorRepo.createQueryBuilder('visitor')
                    .select('COUNT(DISTINCT visitor.ip_address)', 'cnt')
                    .where('visitor.created_at BETWEEN :start AND :end', { start: todayStart, end: todayEnd })
                    .andWhere('visitor.is_bot = false')
                    .getRawOne();
                uniqueIpsToday = parseInt(uniqueIpResult?.cnt || '0');
            } catch {
                // If is_bot column not synced yet, fall back gracefully
            }

            return {
                totalVisitors,
                todayVisitors,
                onlineVisitors,
                todayRealVisitors,
                onlineRealVisitors,
                uniqueIpsToday,
            };
        } catch (error) {
            this.logger.error('Error in getStats', error);
            return {
                totalVisitors: 0,
                todayVisitors: 0,
                onlineVisitors: 0,
                todayRealVisitors: 0,
                onlineRealVisitors: 0,
                uniqueIpsToday: 0,
            };
        }
    }

    async getVisitors(query: any) {
        try {
            const page = parseInt(query.current || query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 10;
            const skip = (page - 1) * pageSize;
            const hideBots = query.hideBots === 'true' || query.hideBots === true;
            const search = (query.search || '').trim();
            const groupBy = query.groupBy || 'session'; // 'ip' | 'session'

            if (groupBy === 'ip') {
                const countQb = this.visitorRepo.createQueryBuilder('v')
                    .select('COUNT(DISTINCT v.ip_address)', 'cnt')
                    .where('v.ip_address IS NOT NULL');

                if (hideBots) {
                    countQb.andWhere('v.is_bot = false');
                }
                if (search) {
                    countQb.andWhere('(v.ip_address ILIKE :search OR v.user_agent ILIKE :search)', { search: `%${search}%` });
                }

                const totalRes = await countQb.getRawOne();
                const total = parseInt(totalRes?.cnt || '0');

                const dataQb = this.visitorRepo.createQueryBuilder('v')
                    .select('v.ip_address', 'ip_address')
                    .addSelect('MAX(v.country)', 'country')
                    .addSelect('MAX(v.city)', 'city')
                    .addSelect('COUNT(v.id)', 'session_count')
                    .addSelect('MAX(v.last_active)', 'last_active')
                    .addSelect('MIN(v.created_at)', 'created_at')
                    .addSelect('MAX(v.user_agent)', 'user_agent')
                    .addSelect('BOOL_OR(v.is_bot)', 'is_bot')
                    .where('v.ip_address IS NOT NULL')
                    .groupBy('v.ip_address')
                    .orderBy('MAX(v.last_active)', 'DESC')
                    .offset(skip)
                    .limit(pageSize);

                if (hideBots) {
                    dataQb.andWhere('v.is_bot = false');
                }
                if (search) {
                    dataQb.andWhere('(v.ip_address ILIKE :search OR v.user_agent ILIKE :search)', { search: `%${search}%` });
                }

                const rawData = await dataQb.getRawMany();
                const data = rawData.map((row, index) => ({
                    id: `ip_${row.ip_address || index}`,
                    ip_address: row.ip_address,
                    country: row.country,
                    city: row.city,
                    session_count: parseInt(row.session_count || '1'),
                    last_active: row.last_active,
                    created_at: row.created_at,
                    user_agent: row.user_agent,
                    is_bot: Boolean(row.is_bot),
                }));

                return {
                    data,
                    total,
                    success: true,
                };
            }

            // Default: Session view
            const qb = this.visitorRepo.createQueryBuilder('v')
                .orderBy('v.last_active', 'DESC')
                .skip(skip)
                .take(pageSize);

            if (hideBots) {
                qb.andWhere('v.is_bot = false');
            }
            if (search) {
                qb.andWhere('(v.ip_address ILIKE :search OR v.user_agent ILIKE :search)', { search: `%${search}%` });
            }

            const [data, total] = await qb.getManyAndCount();

            return {
                data,
                total,
                success: true,
            };
        } catch (error) {
            this.logger.error('Error fetching visitors', error);
            return { data: [], total: 0, success: false };
        }
    }
}
