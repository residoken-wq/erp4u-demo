import { Injectable, Logger, Optional, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { Subject, Observable } from 'rxjs';
import { NOTIFICATION_CHANNELS, NotificationChannelBridge } from '../common/extension-points';
import { TenantContext, DEFAULT_TENANT_CONTEXT } from '../common/tenancy/tenant-context';

export interface NotificationPayload {
  id: number;
  title: string;
  message: string;
  type: string;
  link?: string;
  is_read: boolean;
  created_at: Date | string;
}

export interface NotificationEvent {
  tenantId: string;
  userId: number;
  data: NotificationPayload;
}

export interface StreamClientOptions {
  tenantId: string;
  userId: number;
  req: any;
  res: any;
  heartbeatIntervalMs?: number;
  jwtExp?: number;
}

interface ActiveConnection {
  id: number;
  res: any;
  cleanup: () => void;
  createdAt: number;
}

@Injectable()
export class NotificationsService {
    private readonly logger = new Logger(NotificationsService.name);
    private readonly notificationStream = new Subject<NotificationEvent>();
    private readonly activeConnections = new Map<string, ActiveConnection[]>();
    private nextConnectionId = 0;
    private defaultHeartbeatIntervalMs = 25_000;

    constructor(
        @InjectRepository(Notification) private repo: Repository<Notification>,
        @Optional()
        @Inject(NOTIFICATION_CHANNELS)
        private readonly notificationChannels?: NotificationChannelBridge | NotificationChannelBridge[],
    ) { }

    getStream(): Observable<NotificationEvent> {
        return this.notificationStream.asObservable();
    }

    setDefaultHeartbeatInterval(ms: number) {
        this.defaultHeartbeatIntervalMs = ms;
    }

    getObserverCount(): number {
        return (this.notificationStream as any).observers?.length ?? 0;
    }

    getActiveConnectionsCount(tenantId?: string, userId?: number): number {
        if (tenantId && userId !== undefined) {
            const key = `${tenantId}:${userId}`;
            return this.activeConnections.get(key)?.length ?? 0;
        }
        let total = 0;
        for (const conns of this.activeConnections.values()) {
            total += conns.length;
        }
        return total;
    }

    closeAllConnections(): void {
        for (const conns of this.activeConnections.values()) {
            for (const conn of conns) {
                conn.cleanup();
                try {
                    conn.res.end();
                } catch {
                    // ignore
                }
            }
        }
        this.activeConnections.clear();
    }

    subscribeClient(options: StreamClientOptions): () => void {
        const { tenantId, userId, req, res, heartbeatIntervalMs, jwtExp } = options;
        const key = `${tenantId}:${userId}`;

        // Enforce max 5 concurrent connections per user per tenant
        const existing = this.activeConnections.get(key) || [];
        if (existing.length >= 5) {
            const oldest = existing.shift();
            if (oldest) {
                try {
                    this.logger.debug(
                        `[NotificationsService] User ${userId} exceeded 5 connections on tenant ${tenantId}. Closing oldest connection ${oldest.id}.`,
                    );
                    oldest.res.write('event: evicted\ndata: {}\n\n');
                    oldest.cleanup();
                    oldest.res.end();
                } catch {
                    // ignore
                }
            }
        }

        // Set SSE response headers
        if (!res.headersSent) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            if (typeof res.flushHeaders === 'function') {
                res.flushHeaders();
            }
        }

        const connectionId = ++this.nextConnectionId;
        let isCleanedUp = false;
        let heartbeatTimer: NodeJS.Timeout | undefined;
        let jwtTimer: NodeJS.Timeout | undefined;
        let subscription: any;

        const cleanup = () => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            if (jwtTimer) clearTimeout(jwtTimer);
            if (subscription) subscription.unsubscribe();

            const current = this.activeConnections.get(key) || [];
            const remaining = current.filter((c) => c.id !== connectionId);
            if (remaining.length > 0) {
                this.activeConnections.set(key, remaining);
            } else {
                this.activeConnections.delete(key);
            }
            this.logger.debug(
                `[NotificationsService] Stream connection ${connectionId} closed for tenant=${tenantId} user=${userId}. Remaining: ${remaining.length}`,
            );
        };

        const interval = heartbeatIntervalMs || this.defaultHeartbeatIntervalMs;
        heartbeatTimer = setInterval(() => {
            try {
                res.write(': ping\n\n');
            } catch {
                cleanup();
            }
        }, interval);
        heartbeatTimer.unref?.();

        // Expire when JWT expires
        if (jwtExp) {
            const remainingMs = jwtExp * 1000 - Date.now();
            if (remainingMs <= 0) {
                cleanup();
                try {
                    res.end();
                } catch {
                    // ignore
                }
                return cleanup;
            }
            jwtTimer = setTimeout(() => {
                this.logger.debug(
                    `[NotificationsService] JWT expired for tenant=${tenantId} user=${userId}. Closing stream.`,
                );
                cleanup();
                try {
                    res.end();
                } catch {
                    // ignore
                }
            }, remainingMs);
            jwtTimer.unref?.();
        }

        // Subscribe to RxJS Subject with tenant & user filter
        subscription = this.notificationStream.subscribe({
            next: (ev) => {
                if (ev.tenantId === tenantId && ev.userId === userId) {
                    try {
                        res.write(`data: ${JSON.stringify(ev.data)}\n\n`);
                    } catch {
                        cleanup();
                    }
                }
            },
        });

        req.on('close', cleanup);
        res.on('close', cleanup);

        const connectionRecord: ActiveConnection = {
            id: connectionId,
            res,
            cleanup,
            createdAt: Date.now(),
        };
        existing.push(connectionRecord);
        this.activeConnections.set(key, existing);

        this.logger.debug(
            `[NotificationsService] Open stream connections for tenant=${tenantId} user=${userId}: ${existing.length}`,
        );

        return cleanup;
    }

    async create(data: {
        user_id: number;
        title: string;
        message: string;
        type?: string;
        link?: string;
        is_read?: boolean;
        tenantId?: string;
    }) {
        // Save to PostgreSQL (source of truth)
        const notification = await this.repo.save(this.repo.create({
            ...data,
            type: data.type || 'INFO',
            is_read: data.is_read ?? false
        }));

        let tenantId = data.tenantId;
        if (!tenantId) {
            try {
                tenantId = TenantContext.current()?.tenantId || DEFAULT_TENANT_CONTEXT.tenantId;
            } catch {
                tenantId = DEFAULT_TENANT_CONTEXT.tenantId;
            }
        }

        const payload: NotificationPayload = {
            id: notification.id,
            title: notification.title,
            message: notification.message,
            type: notification.type,
            link: notification.link,
            is_read: notification.is_read,
            created_at: notification.created_at,
        };

        // Broadcast to in-memory real-time SSE stream
        try {
            this.notificationStream.next({
                tenantId,
                userId: data.user_id,
                data: payload,
            });
        } catch (error) {
            this.logger.warn('Failed to emit notification event', error);
        }

        // Optional dispatch to notification channels (e.g. ZNS in premium)
        if (this.notificationChannels) {
            try {
                const channels = Array.isArray(this.notificationChannels)
                    ? this.notificationChannels
                    : [this.notificationChannels];
                for (const ch of channels) {
                    if (ch && typeof ch.send === 'function') {
                        ch.send(notification).catch((err: any) =>
                            this.logger.debug(`Channel ${ch.channel} send error: ${err.message}`),
                        );
                    }
                }
            } catch (err: any) {
                this.logger.debug(`Notification channels dispatch skipped: ${err.message}`);
            }
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

    async markAsRead(id: number, userId: number) {
        const notification = await this.repo.findOne({ where: { id, user_id: userId } });
        if (!notification) {
            throw new NotFoundException('Notification not found');
        }
        await this.repo.update({ id, user_id: userId }, { is_read: true });
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
