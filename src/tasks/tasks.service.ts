import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Task } from './task.entity';
import { TaskTimeLog } from './task-time-log.entity';
import { Notification } from '../notifications/notification.entity';

@Injectable()
export class TasksService {
    private readonly logger = new Logger(TasksService.name);

    constructor(
        @InjectRepository(Task) private taskRepo: Repository<Task>,
        @InjectRepository(Notification) private notiRepo: Repository<Notification>,
        @InjectRepository(TaskTimeLog) private timeLogRepo: Repository<TaskTimeLog>,
    ) { }

    async findAll(filters?: { assignee_id?: number; status_not?: string; limit?: number }) {
        const query = this.taskRepo.createQueryBuilder('task')
            .leftJoinAndSelect('task.assignee', 'assignee')
            .leftJoinAndSelect('task.creator', 'creator')
            .leftJoinAndSelect('task.project', 'project')
            .leftJoinAndSelect('task.milestone', 'milestone')
            .orderBy('task.created_at', 'DESC');

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

    async create(data: any) {
        const newTask = this.taskRepo.create(data);
        const task = await this.taskRepo.save(newTask) as unknown as Task;

        // Notify assignee when assigned
        if (task.assignee_id && task.assignee_id !== task.creator_id) {
            await this.notiRepo.save({
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

    async update(id: number, data: any) {
        const oldTask = await this.taskRepo.findOne({ where: { id }, relations: ['assignee', 'creator'] });
        const oldStatus = oldTask?.status;
        const oldAssigneeId = oldTask?.assignee_id;

        await this.taskRepo.update(id, data);
        const updatedTask = await this.taskRepo.findOne({ where: { id }, relations: ['assignee', 'creator', 'project', 'milestone'] });

        // Notify if assignee changed
        if (data.assignee_id && data.assignee_id !== oldAssigneeId && data.assignee_id !== updatedTask?.creator_id) {
            await this.notiRepo.save({
                title: '📋 Bạn được giao việc mới',
                message: `Công việc "${updatedTask?.title}" đã được giao cho bạn.`,
                type: 'INFO',
                user_id: data.assignee_id,
                link: `/tasks?task=${id}&highlight=task-${id}`,
                is_read: false
            });
            this.logger.log(`Notified User ${data.assignee_id} about reassigned Task ${id}`);
        }

        // Notify on status change
        if (data.status && data.status !== oldStatus) {
            const statusLabels: Record<string, string> = {
                TODO: 'Chờ xử lý',
                IN_PROGRESS: 'Đang thực hiện',
                REVIEW: 'Chờ duyệt',
                DONE: 'Hoàn thành'
            };
            const statusLabel = statusLabels[data.status] || data.status;

            // Notify creator (if different from who changed it)
            if (updatedTask?.creator_id && updatedTask.creator_id !== updatedTask.assignee_id) {
                await this.notiRepo.save({
                    title: '🔄 Cập nhật trạng thái công việc',
                    message: `Công việc "${updatedTask.title}" đã chuyển sang: ${statusLabel}`,
                    type: data.status === 'DONE' ? 'SUCCESS' : 'INFO',
                    user_id: updatedTask.creator_id,
                    link: `/tasks?task=${id}&highlight=task-${id}`,
                    is_read: false
                });
                this.logger.log(`Notified Creator ${updatedTask.creator_id} about Task ${id} status change`);
            }

            // Notify assignee (if different from who changed it and different from creator)
            if (updatedTask?.assignee_id && updatedTask.assignee_id !== updatedTask.creator_id) {
                await this.notiRepo.save({
                    title: '🔄 Cập nhật trạng thái công việc',
                    message: `Công việc "${updatedTask.title}" đã chuyển sang: ${statusLabel}`,
                    type: data.status === 'DONE' ? 'SUCCESS' : 'INFO',
                    user_id: updatedTask.assignee_id,
                    link: `/tasks?task=${id}&highlight=task-${id}`,
                    is_read: false
                });
                this.logger.log(`Notified Assignee ${updatedTask.assignee_id} about Task ${id} status change`);
            }
        }

        return updatedTask;
    }

    async remove(id: number) { return this.taskRepo.delete(id); }

    // --- TASK TIMER ---
    async startTimer(taskId: number, userId: number) {
        // Check if there's already a running timer for this user on this task
        const running = await this.timeLogRepo.findOne({
            where: { task_id: taskId, user_id: userId, end_time: IsNull() } // Need IsNull import
        });

        if (running) return running; // Already running

        const log = this.timeLogRepo.create({
            task_id: taskId,
            user_id: userId,
            start_time: new Date()
        });
        return this.timeLogRepo.save(log);
    }

    async stopTimer(taskId: number, userId: number, description?: string) {
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

    async getTaskLogs(taskId: number) {
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
                await this.notiRepo.save({
                    title: '⏰ Nhắc nhở công việc',
                    message: `Công việc "${task.title}" sắp đến hạn hoặc đã quá hạn!`,
                    type: 'WARNING',
                    user_id: task.assignee.id,
                    link: `/tasks?task=${task.id}&highlight=task-${task.id}`,
                    is_read: false
                });

                // Đánh dấu đã nhắc để không spam
                await this.taskRepo.update(task.id, { is_reminded: true });
                this.logger.log(`Reminded User ${task.assignee.id} about Task ${task.id}`);
            }
        }
    }
}