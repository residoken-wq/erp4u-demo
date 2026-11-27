import {
    Injectable,
    Logger,
    Optional,
    Inject,
    NotFoundException,
    ForbiddenException,
    forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from './task.entity';
import { TaskTimeLog } from './task-time-log.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from '../common/tenancy/tenant-context';
import { TENANT_REGISTRY, TenantRegistry } from '../common/tenancy/tenant-registry.interface';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { hasPermission } from '../auth/rbac-assert.helper';

export const ALLOWED_TASK_FIELDS = [
    'title',
    'description',
    'status',
    'priority',
    'start_date',
    'due_date',
    'is_reminded',
    'reference_code',
    'reference_type',
    'project_id',
    'milestone_id',
    'estimated_hours',
    'estimated_cost',
    'actual_cost',
    'cost_note',
    'department',
    'assignee_id',
];

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        @InjectRepository(Task) private taskRepo: Repository<Task>,
        private readonly notificationsService: NotificationsService,
        @InjectRepository(TaskTimeLog) private timeLogRepo: Repository<TaskTimeLog>,
        @Optional()
        @Inject(TENANT_REGISTRY)
        private readonly tenantRegistry?: TenantRegistry,
        @Optional()
        @Inject(forwardRef(() => PermissionCacheService))
        private readonly permCacheService?: PermissionCacheService,
    ) { }

    private async canViewAllTasks(user: any): Promise<boolean> {
        return hasPermission(user, this.permCacheService, 'PROJECTS', 'view');
    }

    private async canUpdateAllTasks(user: any): Promise<boolean> {
        return hasPermission(user, this.permCacheService, 'PROJECTS', 'update');
    }

    private async canDeleteAllTasks(user: any): Promise<boolean> {
        return hasPermission(user, this.permCacheService, 'PROJECTS', 'delete');
    }

    async findAll(
        filters?: { assignee_id?: number; status_not?: string; limit?: number },
        user?: any,
    ) {
        const query = this.taskRepo.createQueryBuilder('task')
            .leftJoinAndSelect('task.assignee', 'assignee')
            .leftJoinAndSelect('task.creator', 'creator')
            .leftJoinAndSelect('task.project', 'project')
            .leftJoinAndSelect('task.milestone', 'milestone')
            .orderBy('task.created_at', 'DESC');

        const canSeeAll = await this.canViewAllTasks(user);
        const userId = Number(user?.id || user?.userId || 0);

        if (!canSeeAll) {
            query.andWhere('(task.creator_id = :userId OR task.assignee_id = :userId)', { userId });
        }

        if (filters?.assignee_id) {
            query.andWhere('(task.assignee_id = :assignee_id OR task.creator_id = :assignee_id)', { assignee_id: filters.assignee_id });
        }
        if (filters?.status_not) {
            query.andWhere('task.status != :status_not', { status_not: filters.status_not });
        }
        if (filters?.limit) {
            query.take(filters.limit);
        }

        return query.getMany();
    }

    async create(data: any, user?: any) {
        const userId = Number(user?.id || user?.userId || 0);
        const sanitized: any = {};
        for (const field of ALLOWED_TASK_FIELDS) {
            if (data[field] !== undefined) {
                sanitized[field] = data[field];
            }
        }
        if (userId) {
            sanitized.creator_id = userId;
        }

        const newTask = this.taskRepo.create(sanitized);
        const task = await this.taskRepo.save(newTask) as unknown as Task;

        // Notify assignee when assigned
        if (task.assignee_id && task.assignee_id !== task.creator_id) {
            await this.notificationsService.create({
                title: '📋 Bạn được giao việc mới',
                message: `Công việc "${task.title}" đã được giao cho bạn.`,
                type: 'INFO',
                user_id: task.assignee_id,
                link: `/tasks?task=${task.id}&highlight=task-${task.id}`,
                is_read: false
            });
            this.logger.log(`Notified User ${task.assignee_id} about new Task ${task.id}`);
        }

        return task;
    }

    async update(id: number, data: any, user?: any) {
        const oldTask = await this.taskRepo.findOne({ where: { id }, relations: ['assignee', 'creator'] });
        if (!oldTask) {
            throw new NotFoundException('Không tìm thấy công việc');
        }

        const userId = Number(user?.id || user?.userId || 0);
        const canUpdateAll = await this.canUpdateAllTasks(user);
        const isCreator = oldTask.creator_id === userId;
        const isAssignee = oldTask.assignee_id === userId;

        if (!canUpdateAll && !isCreator && !isAssignee) {
            throw new ForbiddenException('Bạn chỉ có thể chỉnh sửa công việc do mình tạo hoặc được giao');
        }

        const sanitized: any = {};
        for (const field of ALLOWED_TASK_FIELDS) {
            if (data[field] !== undefined) {
                sanitized[field] = data[field];
            }
        }

        const oldStatus = oldTask?.status;
        const oldAssigneeId = oldTask?.assignee_id;

        await this.taskRepo.update(id, sanitized);
        const updatedTask = await this.taskRepo.findOne({ where: { id }, relations: ['assignee', 'creator', 'project', 'milestone'] });

        // Notify if assignee changed
        if (sanitized.assignee_id && sanitized.assignee_id !== oldAssigneeId && sanitized.assignee_id !== updatedTask?.creator_id) {
            await this.notificationsService.create({
                title: '📋 Bạn được giao việc mới',
                message: `Công việc "${updatedTask?.title}" đã được giao cho bạn.`,
                type: 'INFO',
                user_id: sanitized.assignee_id,
                link: `/tasks?task=${id}&highlight=task-${id}`,
                is_read: false
            });
            this.logger.log(`Notified User ${sanitized.assignee_id} about reassigned Task ${id}`);
        }

        // Notify on status change
        if (sanitized.status && sanitized.status !== oldStatus) {
            const statusLabels: Record<string, string> = {
                TODO: 'Chờ xử lý',
                IN_PROGRESS: 'Đang thực hiện',
                REVIEW: 'Chờ duyệt',
                DONE: 'Hoàn thành'
            };
            const statusLabel = statusLabels[sanitized.status] || sanitized.status;

            // Notify creator (if different from who changed it)
            if (updatedTask?.creator_id && updatedTask.creator_id !== updatedTask.assignee_id) {
                await this.notificationsService.create({
                    title: '🔄 Cập nhật trạng thái công việc',
                    message: `Công việc "${updatedTask.title}" đã chuyển sang: ${statusLabel}`,
                    type: sanitized.status === 'DONE' ? 'SUCCESS' : 'INFO',
                    user_id: updatedTask.creator_id,
                    link: `/tasks?task=${id}&highlight=task-${id}`,
                    is_read: false
                });
                this.logger.log(`Notified Creator ${updatedTask.creator_id} about Task ${id} status change`);
            }

            // Notify assignee (if different from who changed it and different from creator)
            if (updatedTask?.assignee_id && updatedTask.assignee_id !== updatedTask.creator_id) {
                await this.notificationsService.create({
                    title: '🔄 Cập nhật trạng thái công việc',
                    message: `Công việc "${updatedTask.title}" đã chuyển sang: ${statusLabel}`,
                    type: sanitized.status === 'DONE' ? 'SUCCESS' : 'INFO',
                    user_id: updatedTask.assignee_id,
                    link: `/tasks?task=${id}&highlight=task-${id}`,
                    is_read: false
                });
                this.logger.log(`Notified Assignee ${updatedTask.assignee_id} about Task ${id} status change`);
            }
        }

        return updatedTask;
    }

    async remove(id: number, user?: any) {
        const oldTask = await this.taskRepo.findOne({ where: { id } });
        if (!oldTask) {
            throw new NotFoundException('Không tìm thấy công việc');
        }

        const userId = Number(user?.id || user?.userId || 0);
        const canDeleteAll = await this.canDeleteAllTasks(user);
        const isCreator = oldTask.creator_id === userId;

        if (!canDeleteAll && !isCreator) {
            throw new ForbiddenException('Chỉ người tạo mới có quyền xóa công việc này');
        }

        return this.taskRepo.delete(id);
    }

    // --- TASK TIMER ---
    async startTimer(taskId: number, user: any) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) {
            throw new NotFoundException('Không tìm thấy công việc');
        }

        const userId = Number(user?.id || user?.userId || (typeof user === 'number' ? user : 0));
        const canUpdateAll = await this.canUpdateAllTasks(user);
        const isCreator = task.creator_id === userId;
        const isAssignee = task.assignee_id === userId;

        if (!canUpdateAll && !isCreator && !isAssignee) {
            throw new ForbiddenException('Bạn chỉ có thể bấm giờ cho công việc do mình tạo hoặc được giao');
        }

        // Check if there's already a running timer for this user on this task
        const running = await this.timeLogRepo.findOne({
            where: { task_id: taskId, user_id: userId, end_time: IsNull() }
        });

        if (running) return running; // Already running

        const log = this.timeLogRepo.create({
            task_id: taskId,
            user_id: userId,
            start_time: new Date()
        });
        return this.timeLogRepo.save(log);
    }

    async stopTimer(taskId: number, user: any, description?: string) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) {
            throw new NotFoundException('Không tìm thấy công việc');
        }

        const userId = Number(user?.id || user?.userId || (typeof user === 'number' ? user : 0));
        const canUpdateAll = await this.canUpdateAllTasks(user);
        const isCreator = task.creator_id === userId;
        const isAssignee = task.assignee_id === userId;

        if (!canUpdateAll && !isCreator && !isAssignee) {
            throw new ForbiddenException('Bạn chỉ có thể dừng bấm giờ cho công việc do mình tạo hoặc được giao');
        }

        const running = await this.timeLogRepo.findOne({
            where: { task_id: taskId, user_id: userId, end_time: IsNull() }
        });

        if (!running) return null; // No running timer

        const now = new Date();
        running.end_time = now;
        running.duration_seconds = Math.floor((now.getTime() - running.start_time.getTime()) / 1000);
        if (description) running.description = description;

        return this.timeLogRepo.save(running);
    }

    async getTaskLogs(taskId: number, user?: any) {
        const task = await this.taskRepo.findOne({ where: { id: taskId } });
        if (!task) {
            throw new NotFoundException('Không tìm thấy công việc');
        }

        if (user) {
            const userId = Number(user?.id || user?.userId || (typeof user === 'number' ? user : 0));
            const canViewAll = await this.canViewAllTasks(user);
            const isCreator = task.creator_id === userId;
            const isAssignee = task.assignee_id === userId;

            if (!canViewAll && !isCreator && !isAssignee) {
                throw new ForbiddenException('Bạn chỉ có thể xem nhật ký của công việc do mình tạo hoặc được giao');
            }
        }

        return this.timeLogRepo.find({
            where: { task_id: taskId },
            relations: ['user'],
            order: { start_time: 'DESC' }
        });
    }

    // --- CRON JOB: REMINDER TỰ ĐỘNG ---
    // Chạy mỗi phút để kiểm tra deadline
    @Cron(CronExpression.EVERY_MINUTE)
    async checkDeadlines() {
        const tenants = this.tenantRegistry
            ? await this.tenantRegistry.list()
            : [DEFAULT_TENANT_CONTEXT];

        for (const tenant of tenants) {
            await TenantContext.run(tenant, async () => {
                try {
                    // Tìm các task chưa xong, chưa nhắc, và deadline sắp đến (hoặc đã qua)
                    // Logic: Deadline < (Hiện tại + 30 phút)
                    const now = new Date();
                    const remindTime = new Date(now.getTime() + 30 * 60000); // 30 phút tới

                    const tasks = await this.taskRepo.find({
                        where: {
                            status: LessThan('DONE') as any, // Chưa xong (giả sử trạng thái sort đc, hoặc dùng In([...]))
                            is_reminded: false,
                            due_date: LessThan(remindTime)
                        },
                        relations: ['assignee']
                    });

                    for (const task of tasks) {
                        if (task.assignee) {
                            // Tạo thông báo
                            await this.notificationsService.create({
                                title: '⏰ Nhắc nhở công việc',
                                message: `Công việc "${task.title}" sắp đến hạn hoặc đã quá hạn!`,
                                type: 'WARNING',
                                user_id: task.assignee.id,
                                link: `/tasks?task=${task.id}&highlight=task-${task.id}`,
                                is_read: false
                            });

                            // Đánh dấu đã nhắc để không spam
                            await this.taskRepo.update(task.id, { is_reminded: true });
                            this.logger.log(`[tenant=${tenant.tenantId}] Reminded User ${task.assignee.id} about Task ${task.id}`);
                        }
                    }
                } catch (err: any) {
                    this.logger.error(`[tenant=${tenant.tenantId}] checkDeadlines failed: ${err?.message}`);
                }
            });
        }
    }
}