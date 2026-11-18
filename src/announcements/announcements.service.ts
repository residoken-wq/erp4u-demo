import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import { Announcement, AnnouncementType, AnnouncementPriority } from './announcement.entity';
import { AnnouncementRead } from './announcement-read.entity';

@Injectable()
export class AnnouncementsService {
    constructor(
        @InjectRepository(Announcement) private announcementRepo: Repository<Announcement>,
        @InjectRepository(AnnouncementRead) private readRepo: Repository<AnnouncementRead>,
    ) { }

    // ==================== ADMIN FUNCTIONS ====================

    async findAll(options?: { type?: AnnouncementType; is_active?: boolean }) {
        const where: any = {};
        if (options?.type) where.type = options.type;
        if (options?.is_active !== undefined) where.is_active = options.is_active;

        return this.announcementRepo.find({
            where,
            relations: ['creator'],
            order: { is_pinned: 'DESC', created_at: 'DESC' }
        });
    }

    async findOne(id: number) {
        return this.announcementRepo.findOne({
            where: { id },
            relations: ['creator']
        });
    }

    async create(data: Partial<Announcement>) {
        const announcement = this.announcementRepo.create(data);
        return this.announcementRepo.save(announcement);
    }

    async update(id: number, data: Partial<Announcement>) {
        await this.announcementRepo.update(id, data);
        return this.findOne(id);
    }

    async delete(id: number) {
        await this.announcementRepo.delete(id);
        return { success: true };
    }

    // ==================== EMPLOYEE FUNCTIONS ====================

    /**
     * Lấy danh sách announcements đang hiệu lực cho user
     * - is_active = true
     * - start_date <= now hoặc null
     * - end_date >= now hoặc null
     * - target_departments chứa department của user hoặc null
     */
    async findActiveForUser(userId: number, userDepartment?: string) {
        const now = new Date();

        const query = this.announcementRepo
            .createQueryBuilder('a')
            .leftJoinAndSelect('a.creator', 'creator')
            .where('a.is_active = :active', { active: true })
            .andWhere('(a.start_date IS NULL OR a.start_date <= :now)', { now })
            .andWhere('(a.end_date IS NULL OR a.end_date >= :now)', { now });

        // Nếu user có department, filter theo target
        // Nếu target_departments = null -> hiển thị cho tất cả
        if (userDepartment) {
            query.andWhere(
                '(a.target_departments IS NULL OR a.target_departments LIKE :dept)',
                { dept: `%${userDepartment}%` }
            );
        }

        const announcements = await query
            .orderBy('a.is_pinned', 'DESC')
            .addOrderBy('a.priority', 'DESC')
            .addOrderBy('a.created_at', 'DESC')
            .getMany();

        // Lấy danh sách announcement IDs mà user đã đọc
        const readRecords = await this.readRepo.find({
            where: { user_id: userId },
            select: ['announcement_id']
        });
        const readIds = new Set(readRecords.map(r => r.announcement_id));

        // Gắn flag is_read cho mỗi announcement
        return announcements.map(a => ({
            ...a,
            is_read: readIds.has(a.id)
        }));
    }

    /**
     * Lấy chỉ những announcement chưa đọc cho user
     */
    async findUnreadForUser(userId: number, userDepartment?: string) {
        const allActive = await this.findActiveForUser(userId, userDepartment);
        return allActive.filter(a => !a.is_read);
    }

    /**
     * Đánh dấu announcement đã đọc
     */
    async markAsRead(announcementId: number, userId: number) {
        const existing = await this.readRepo.findOne({
            where: { announcement_id: announcementId, user_id: userId }
        });

        if (!existing) {
            await this.readRepo.save(this.readRepo.create({
                announcement_id: announcementId,
                user_id: userId
            }));
        }

        return { success: true };
    }

    /**
     * Đánh dấu tất cả announcements đã đọc cho user
     */
    async markAllAsRead(userId: number) {
        const now = new Date();

        // Lấy tất cả announcement đang active
        const activeAnnouncements = await this.announcementRepo
            .createQueryBuilder('a')
            .select('a.id')
            .where('a.is_active = :active', { active: true })
            .andWhere('(a.start_date IS NULL OR a.start_date <= :now)', { now })
            .andWhere('(a.end_date IS NULL OR a.end_date >= :now)', { now })
            .getMany();

        // Lấy những announcement user chưa đọc
        const readRecords = await this.readRepo.find({
            where: { user_id: userId },
            select: ['announcement_id']
        });
        const readIds = new Set(readRecords.map(r => r.announcement_id));

        // Tạo read records cho những announcement chưa đọc
        const toCreate = activeAnnouncements
            .filter(a => !readIds.has(a.id))
            .map(a => this.readRepo.create({
                announcement_id: a.id,
                user_id: userId
            }));

        if (toCreate.length > 0) {
            await this.readRepo.save(toCreate);
        }

        return { success: true, marked: toCreate.length };
    }

    /**
     * Đếm số announcement chưa đọc cho user
     */
    async getUnreadCount(userId: number, userDepartment?: string): Promise<number> {
        const unread = await this.findUnreadForUser(userId, userDepartment);
        return unread.length;
    }
}
