import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsVisitor } from './analytics-visitor.entity';
import { Repository, Between } from 'typeorm';
import * as dayjs from 'dayjs';

@Injectable()
export class AnalyticsService {
    private readonly logger = new Logger(AnalyticsService.name);

    constructor(
        @InjectRepository(AnalyticsVisitor)
        private visitorRepo: Repository<AnalyticsVisitor>,
    ) { }

    private async resolveIpCountry(ip: string, visitor: AnalyticsVisitor) {
        if (!ip || ip === '127.0.0.1' || ip.includes('localhost') || ip === '::1') return;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`http://ip-api.com/json/${ip.split(',')[0].trim()}`, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data.country) {
                    visitor.country = data.country;
                    await this.visitorRepo.save(visitor);
                }
            }
        } catch (error) {
            // Silently fail on timeout or error
        }
    }

    async ping(data: { session_id: string; ip_address?: string; user_agent?: string }) {
        try {
            let visitor = await this.visitorRepo.findOne({
                where: { session_id: data.session_id }
            });

            let ipNeedsResolve = false;

            if (visitor) {
                // Update last_active
                visitor.last_active = new Date();
                if (data.ip_address && visitor.ip_address !== data.ip_address) {
                    visitor.ip_address = data.ip_address;
                    ipNeedsResolve = true; // IP changed
                } else if (data.ip_address && !visitor.country) {
                    ipNeedsResolve = true; // Missing country
                }
                
                if (data.user_agent && !visitor.user_agent) visitor.user_agent = data.user_agent;
            } else {
                // Create new
                visitor = this.visitorRepo.create({
                    session_id: data.session_id,
                    ip_address: data.ip_address,
                    user_agent: data.user_agent,
                    last_active: new Date(),
                });
                if (data.ip_address) ipNeedsResolve = true;
            }
            
            const savedVisitor = await this.visitorRepo.save(visitor);
            
            // Asynchronously resolve IP to Country to avoid blocking ping response
            if (ipNeedsResolve) {
                this.resolveIpCountry(savedVisitor.ip_address, savedVisitor);
            }

            return { success: true };
        } catch (error) {
            this.logger.error('Error in ping: Table might not exist yet', error);
            // Graceful fallback
            return { success: false, error: 'Initialization error' };
        }
    }

    async getStats() {
        try {
            const todayStart = dayjs().startOf('day').toDate();
            const todayEnd = dayjs().endOf('day').toDate();
            // 3 minutes timeout for "online"
            const onlineThreshold = dayjs().subtract(3, 'minute').toDate();

            const totalVisitors = await this.visitorRepo.count();
            
            const todayVisitors = await this.visitorRepo.count({
                where: {
                    created_at: Between(todayStart, todayEnd)
                }
            });

            const onlineVisitors = await this.visitorRepo.createQueryBuilder('visitor')
                .where('visitor.last_active >= :threshold', { threshold: onlineThreshold })
                .getCount();

            return {
                totalVisitors,
                todayVisitors,
                onlineVisitors
            };
        } catch (error) {
            this.logger.error('Error in getStats: Table might not exist yet', error);
            // Graceful fallback according to TECHNICAL_RULES
            return {
                totalVisitors: 0,
                todayVisitors: 0,
                onlineVisitors: 0
            };
        }
    }

    async getVisitors(query: any) {
        try {
            const page = parseInt(query.current || query.page) || 1;
            const pageSize = parseInt(query.pageSize) || 20;
            const skip = (page - 1) * pageSize;
            
            const [data, total] = await this.visitorRepo.findAndCount({
                order: { last_active: 'DESC' },
                skip,
                take: pageSize,
            });
            
            return {
                data,
                total,
                success: true
            };
        } catch (error) {
            this.logger.error('Error fetching visitors', error);
            return { data: [], total: 0, success: false };
        }
    }
}
