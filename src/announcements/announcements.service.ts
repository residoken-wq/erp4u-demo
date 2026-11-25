import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Announcement, AnnouncementType } from './announcement.entity';
import { AnnouncementRead } from './announcement-read.entity';
import { sanitizeHtmlContent } from '../common/security/html-sanitizer';

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
        if (data.content) {
            data.content = sanitizeHtmlContent(data.content);
        }
        const announcement = this.announcementRepo.create(data);
        return this.announcementRepo.save(announcement);
    }

    async update(id: number, data: Partial<Announcement>) {
        if (data.content) {
            data.content = sanitizeHtmlContent(data.content);
        }
        await this.announcementRepo.update(id, data);
        return this.findOne(id);
    }

    async delete(id: number) {
        await this.announcementRepo.delete(id);
        return { success: true };
    }

    // ==================== EMPLOYEE FUNCTIONS ====================

    /**
     * Common SQL filter for active announcements targeted to a user's group.
     * Criteria:
     * - is_active = true
     * - start_date <= now OR start_date IS NULL
     * - end_date >= now OR end_date IS NULL
     * - target_group_ids IS NULL OR :groupId = ANY(target_group_ids)
     */
    private applyUserFilter(query: SelectQueryBuilder<Announcement>, groupId?: number) {
        const now = new Date();
        query
            .andWhere('a.is_active = :active', { active: true })
            .andWhere('(a.start_date IS NULL OR a.start_date <= :now)', { now })
            .andWhere('(a.end_date IS NULL OR a.end_date >= :now)', { now });

        if (groupId) {
            query.andWhere('(a.target_group_ids IS NULL OR :groupId = ANY(a.target_group_ids))', { groupId });
        } else {
            query.andWhere('a.target_group_ids IS NULL');
        }
    }

    /**
     * Lấy danh sách announcements đang hiệu lực cho user
     */
    async findActiveForUser(userId: number, groupId?: number) {
        const query = this.announcementRepo
            .createQueryBuilder('a')
            .leftJoinAndSelect('a.creator', 'creator')
            .where('1=1');

        this.applyUserFilter(query, groupId);

        const announcements = await query
            .orderBy('a.is_pinned', 'DESC')
            .addOrderBy('a.priority', 'DESC')
            .addOrderBy('a.created_at', 'DESC')
            .getMany();

        const readRecords = await this.readRepo.find({
            where: { user_id: userId },
            select: ['announcement_id']
        });
        const readIds = new Set(readRecords.map(r => r.announcement_id));

        return announcements.map(a => ({
            ...a,
            is_read: readIds.has(a.id)
        }));
    }

    /**
     * Lấy chỉ những announcement chưa đọc cho user
     */
    async findUnreadForUser(userId: number, groupId?: number) {
        const allActive = await this.findActiveForUser(userId, groupId);
        return allActive.filter(a => !a.is_read);
    }

    /**
     * Đếm số announcement chưa đọc cho user
     */
    async getUnreadCount(userId: number, groupId?: number): Promise<number> {
        const unread = await this.findUnreadForUser(userId, groupId);
        return unread.length;
    }

    /**
     * Đánh dấu announcement đã đọc:
     * Nếu thông báo không hiển thị cho user (không active, ngoài ngày, hoặc khác group) -> 404
     */
    async markAsRead(announcementId: number, userId: number, groupId?: number) {
        const query = this.announcementRepo
            .createQueryBuilder('a')
            .where('a.id = :id', { id: announcementId });

        this.applyUserFilter(query, groupId);

        const announcement = await query.getOne();
        if (!announcement) {
            throw new NotFoundException('Announcement not found');
        }

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
    async markAllAsRead(userId: number, groupId?: number) {
        const query = this.announcementRepo
            .createQueryBuilder('a')
            .select('a.id')
            .where('1=1');

        this.applyUserFilter(query, groupId);

        const activeAnnouncements = await query.getMany();

        const readRecords = await this.readRepo.find({
            where: { user_id: userId },
            select: ['announcement_id']
        });
        const readIds = new Set(readRecords.map(r => r.announcement_id));

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
}
