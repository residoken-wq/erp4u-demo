import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
    constructor(
        @InjectRepository(User)
        private readonly usersRepository: Repository<User>,
    ) { }

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest();
        const user = request.user; // Populated by AuthGuard

        if (user && user.id) {
            this.updateUserActivity(user.id, request);
        }

        return next.handle();
    }

    private async updateUserActivity(userId: number, req: any) {
        try {
            // Get IP
            const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            // Get User Agent
            const userAgent = req.headers['user-agent'];

            // Update DB (Fire and forget, don't await)
            /* 
               Optimization: We could check if update is needed (e.g. last activity > 5 min ago).
               However, for now, simple update involves less read-before-write logic if we just use update().
               But `update` query is cheap. 
               To avoid excessive DB writes on every request (assets, etc), we might want a simple cache or throttle.
               But let's stick to direct update for simplicity as traffic is likely low (ERP). 
            */

            const now = new Date();
            // Only update if we really need to? No, just update.
            await this.usersRepository.update(userId, {
                last_activity_at: now,
                ip_address: typeof ip === 'string' ? ip : ip?.[0] || '', // Handle array case
                device_info: userAgent || 'Unknown'
            });
        } catch (e) {
            console.warn('Failed to track user activity', e);
        }
    }
}
