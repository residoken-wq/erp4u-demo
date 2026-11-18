import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { Subject, Observable } from 'rxjs';

export interface NotificationEvent {
  userId: number;
  data: any;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly notificationStream = new Subject<NotificationEvent>();

    constructor(
        @InjectRepository(Notification) private repo: Repository<Notification>,
    ) { }

    getStream(): Observable<NotificationEvent> {
        return this.notificationStream.asObservable();
    }

    async create(data: {
        user_id: number;
        title: string;
        message: string;
        type?: string;
        link?: string;
        is_read?: boolean;
    }) {
        // Save to PostgreSQL (source of truth)
        const notification = await this.repo.save(this.repo.create({
            ...data,
            type: data.type || 'INFO',
            is_read: data.is_read ?? false
        }));

        // Broadcast to in-memory real-time SSE stream
        try {
            this.notificationStream.next({
                userId: data.user_id,
                data: notification,
            });
        } catch (error) {
            this.logger.warn('Failed to emit notification event', error);
        }

        return notification;
    }

    async findByUser(userId: number) {
        return this.repo.find({
            where: { user_id: userId },
            order: { created_at: 'DESC' },
            take: 50
        });
    }

    async markAsRead(id: number) {
        const notification = await this.repo.findOne({ where: { id } });
        if (notification) {
            await this.repo.update(id, { is_read: true });
        }
        return { success: true };
    }

    async markAllRead(userId: number) {
        await this.repo.update({ user_id: userId, is_read: false }, { is_read: true });
        return { success: true };
    }

    async getUnreadCount(userId: number): Promise<number> {
        return this.repo.count({
            where: { user_id: userId, is_read: false }
        });
    }
}
