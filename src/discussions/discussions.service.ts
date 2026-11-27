import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionComment } from './entities/discussion-comment.entity';
import { DiscussionRead } from './entities/discussion-read.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { sanitizeHtmlContent } from '../common/security/html-sanitizer';
import { CreateDiscussionDto } from './dto/create-discussion.dto';
import { UpdateDiscussionDto } from './dto/update-discussion.dto';
import { AddDiscussionCommentDto } from './dto/add-comment.dto';
import { UpdateDiscussionCommentDto } from './dto/update-comment.dto';

@Injectable()
export class DiscussionsService {
    constructor(
        @InjectRepository(Discussion) private repo: Repository<Discussion>,
        @InjectRepository(DiscussionComment) private commentRepo: Repository<DiscussionComment>,
        @InjectRepository(DiscussionRead) private readRepo: Repository<DiscussionRead>,
        @InjectRepository(User) private userRepo: Repository<User>,
        private readonly notificationsService: NotificationsService,
        private readonly permCache: PermissionCacheService,
    ) { }

    /**
     * Moderator check:
     * Admin: user.username === 'admin' strictly.
     * Moderator: admin OR user's group has SYSTEM:update permission.
     */
    async isModerator(user: any): Promise<boolean> {
        if (!user) return false;
        if (user.username === 'admin') return true;
        const groupId = user.groupId || user.group_id;
        if (!groupId) return false;
        return this.permCache.hasAny(groupId, [{ module: 'SYSTEM', action: 'update' }]);
    }

    /**
     * Filter mentioned users ensuring they exist, are active, and have permission to view discussion
     */
    async filterValidMentionedUsers(rawMentioned: any, groupId?: number | null, senderId?: number): Promise<User[]> {
        if (!rawMentioned) return [];
        const rawArray = Array.isArray(rawMentioned) ? rawMentioned : String(rawMentioned).split(',');
        const ids: number[] = rawArray
            .map((s: any) => parseInt(String(s).trim(), 10))
            .filter((n: number) => !isNaN(n) && n > 0 && n !== senderId);

        if (ids.length === 0) return [];

        const activeUsers = await this.userRepo.find({
            where: { id: In(ids), is_active: true },
        });

        if (activeUsers.length === 0) return [];

        if (!groupId) {
            return activeUsers;
        }

        const validUsers: User[] = [];
        for (const u of activeUsers) {
            if (u.group_id === groupId) {
                validUsers.push(u);
            } else {
                const isMod = await this.isModerator(u);
                if (isMod) {
                    validUsers.push(u);
                }
            }
        }
        return validUsers;
    }

    async findAll(user: any, options?: { page?: number; limit?: number; q?: string; group_id?: number }) {
        const page = Math.max(1, Number(options?.page) || 1);
        const rawLimit = Number(options?.limit) || 20;
        const limit = Math.min(Math.max(1, rawLimit), 50);
        const offset = (page - 1) * limit;

        const isMod = await this.isModerator(user);
        const query = this.repo.createQueryBuilder('d')
            .leftJoinAndSelect('d.creator', 'creator')
            .leftJoinAndSelect('d.group', 'group');

        if (isMod) {
            if (options?.group_id) {
                query.andWhere('d.group_id = :groupId', { groupId: options.group_id });
            }
        } else {
            const userGroupId = user?.groupId || user?.group_id;
            if (userGroupId) {
                query.andWhere('(d.group_id IS NULL OR d.group_id = :userGroupId)', { userGroupId });
            } else {
                query.andWhere('d.group_id IS NULL');
            }
            if (options?.group_id) {
                query.andWhere('d.group_id = :groupId', { groupId: options.group_id });
            }
        }

        if (options?.q && options.q.trim()) {
            query.andWhere('LOWER(d.title) LIKE LOWER(:q)', { q: `%${options.q.trim()}%` });
        }

        const currentUserId = Number(user?.id || 0);

        query.addSelect(
            '(SELECT COUNT(c.id)::int FROM discussion_comments c WHERE c.discussion_id = d.id)',
            'd_comment_count',
        );
        query.addSelect(
            '(SELECT COUNT(r.id)::int FROM discussion_reads r WHERE r.discussion_id = d.id)',
            'd_view_count',
        );
        query.addSelect(
            '(SELECT MAX(c.created_at) FROM discussion_comments c WHERE c.discussion_id = d.id)',
            'd_latest_comment_at',
        );
        query.addSelect(
            `(SELECT r.last_read_at FROM discussion_reads r WHERE r.discussion_id = d.id AND r.user_id = ${currentUserId} LIMIT 1)`,
            'd_user_last_read_at',
        );

        query.addSelect(
            'GREATEST(d.updated_at, COALESCE((SELECT MAX(c.created_at) FROM discussion_comments c WHERE c.discussion_id = d.id), d.updated_at))',
            'd_last_activity',
        );

        query.orderBy('d.is_pinned', 'DESC')
            .addOrderBy('d_last_activity', 'DESC');

        const total = await query.getCount();
        query.skip(offset).take(limit);

        let data: any[] = [];
        if (typeof query.getRawAndEntities === 'function') {
            const { entities, raw } = await query.getRawAndEntities();
            data = entities.map((item, idx) => {
                const rawRow = raw[idx] || {};
                const commentCount = Number(rawRow.d_comment_count ?? 0);
                const viewCount = Number(rawRow.d_view_count ?? 0);
                const latestCommentAt = rawRow.d_latest_comment_at ? new Date(rawRow.d_latest_comment_at) : null;
                const userLastReadAt = rawRow.d_user_last_read_at ? new Date(rawRow.d_user_last_read_at) : null;

                const lastActivity = latestCommentAt && latestCommentAt > item.updated_at
                    ? latestCommentAt
                    : item.updated_at;

                let isNew = false;
                if (user?.id) {
                    if (!userLastReadAt) {
                        isNew = true;
                    } else if (lastActivity > userLastReadAt) {
                        isNew = true;
                    }
                }

                return {
                    ...item,
                    comment_count: commentCount,
                    view_count: viewCount,
                    views_count: viewCount,
                    is_new: isNew,
                    can_edit: isMod || Boolean(user && item.creator_id === user.id),
                    can_delete: isMod || Boolean(user && item.creator_id === user.id),
                    can_pin: isMod,
                };
            });
        } else {
            const items = await query.getMany();
            data = items.map((i) => ({
                ...i,
                comment_count: i.comments?.length || 0,
                view_count: i.views_count || 0,
                views_count: i.views_count || 0,
                is_new: false,
                can_edit: Boolean(user && i.creator_id === user.id),
                can_delete: isMod || Boolean(user && i.creator_id === user.id),
                can_pin: isMod,
            }));
        }

        return {
            data,
            total,
            page,
            limit,
        };
    }

    async findOne(id: number, user: any) {
        const discussion = await this.repo.findOne({
            where: { id },
            relations: ['creator', 'group', 'comments', 'comments.user']
        });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        // Group scope check: other group discussion -> 404
        if (discussion.group_id && (!user || discussion.group_id !== (user.groupId || user.group_id)) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        // Sort comments by date ASC
        if (discussion.comments) {
            discussion.comments.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
        }

        // Upsert read record for user
        if (user?.id) {
            const existingRead = await this.readRepo.findOne({
                where: { discussion_id: id, user_id: user.id }
            });
            if (existingRead) {
                existingRead.last_read_at = new Date();
                await this.readRepo.save(existingRead);
            } else {
                await this.readRepo.save(this.readRepo.create({
                    discussion_id: id,
                    user_id: user.id,
                    last_read_at: new Date(),
                }));
            }
        }

        const viewCount = await this.readRepo.count({ where: { discussion_id: id } });

        const canEdit = isMod || Boolean(user && discussion.creator_id === user.id);
        const canDelete = isMod || Boolean(user && discussion.creator_id === user.id);

        return {
            ...discussion,
            view_count: viewCount,
            views_count: viewCount,
            can_edit: canEdit,
            can_delete: canDelete,
            can_pin: isMod,
            comments: (discussion.comments || []).map(c => ({
                ...c,
                can_edit: Boolean(user && c.user_id === user.id),
                can_delete: isMod || Boolean(user && c.user_id === user.id),
            })),
        };
    }

    async create(dto: CreateDiscussionDto, user: any) {
        if (dto.type === 'ANNOUNCEMENT') {
            throw new BadRequestException('Loại ANNOUNCEMENT không còn được hỗ trợ cho thảo luận');
        }

        const cleanContent = sanitizeHtmlContent(dto.content).trim();
        if (!cleanContent) {
            throw new BadRequestException('Nội dung không được để trống');
        }

        const isMod = await this.isModerator(user);
        const userGroupId = user?.groupId || user?.group_id;
        if (!isMod && dto.group_id && dto.group_id !== userGroupId) {
            throw new ForbiddenException('Bạn không thể tạo thảo luận trong nhóm khác');
        }

        const discussion = this.repo.create({
            title: dto.title.trim(),
            content: cleanContent,
            group_id: dto.group_id || null as any,
            creator_id: user.id,
            is_pinned: false,
            type: 'GENERAL',
        });
        const saved = await this.repo.save(discussion);

        // Record creator as read
        if (user?.id) {
            await this.readRepo.save(this.readRepo.create({
                discussion_id: saved.id,
                user_id: user.id,
                last_read_at: new Date(),
            }));
        }

        const notifiedUserIds = new Set<number>();

        // Handle @mentions
        const validMentioned = await this.filterValidMentionedUsers(dto.mentioned_user_ids, dto.group_id, user.id);
        for (const target of validMentioned) {
            await this.notificationsService.create({
                user_id: target.id,
                title: '📢 Có người nhắc đến bạn',
                message: `${user.full_name || user.username || 'Ai đó'} đã nhắc đến bạn trong thảo luận "${saved.title}"`,
                type: 'INFO',
                link: `/workspace/discussions/${saved.id}`,
                is_read: false,
            });
            notifiedUserIds.add(target.id);
        }

        // Notify active members of group_id (except creator and already notified mentions)
        if (dto.group_id) {
            const groupMembers = await this.userRepo.find({
                where: { group_id: dto.group_id, is_active: true }
            });
            for (const member of groupMembers) {
                if (member.id !== user.id && !notifiedUserIds.has(member.id)) {
                    await this.notificationsService.create({
                        user_id: member.id,
                        title: '💬 Thảo luận mới trong nhóm',
                        message: `${user.full_name || user.username || 'Ai đó'} đã tạo thảo luận mới "${saved.title}" trong nhóm của bạn`,
                        type: 'INFO',
                        link: `/workspace/discussions/${saved.id}`,
                        is_read: false,
                    });
                }
            }
        }

        return saved;
    }

    async update(id: number, dto: UpdateDiscussionDto, user: any) {
        if (dto.type === 'ANNOUNCEMENT') {
            throw new BadRequestException('Loại ANNOUNCEMENT không còn được hỗ trợ cho thảo luận');
        }

        const discussion = await this.repo.findOne({ where: { id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== (user.groupId || user.group_id)) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        // Only creator or moderator can edit discussion
        if (discussion.creator_id !== user?.id && !isMod) {
            throw new ForbiddenException('Bạn không có quyền sửa thảo luận này');
        }

        if (dto.title !== undefined) {
            discussion.title = dto.title.trim();
        }
        if (dto.content !== undefined) {
            const clean = sanitizeHtmlContent(dto.content).trim();
            if (!clean) throw new BadRequestException('Nội dung không được để trống');
            discussion.content = clean;
        }

        discussion.edited_at = new Date();

        await this.repo.save(discussion);
        return this.findOne(id, user);
    }

    async remove(id: number, user: any) {
        const discussion = await this.repo.findOne({ where: { id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== (user.groupId || user.group_id)) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        if (discussion.creator_id !== user?.id && !isMod) {
            throw new ForbiddenException('Bạn không có quyền xóa thảo luận này');
        }

        await this.readRepo.delete({ discussion_id: id });
        await this.commentRepo.delete({ discussion_id: id });
        return this.repo.delete(id);
    }

    async pin(id: number, pinned: boolean, user: any) {
        const isMod = await this.isModerator(user);
        if (!isMod) {
            throw new ForbiddenException('Chỉ người điều phối mới có quyền ghim thảo luận');
        }

        const discussion = await this.repo.findOne({ where: { id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        await this.repo.update(id, { is_pinned: Boolean(pinned) });
        return this.findOne(id, user);
    }

    async addComment(discussionId: number, dto: AddDiscussionCommentDto, user: any) {
        const discussion = await this.repo.findOne({ where: { id: discussionId } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== (user.groupId || user.group_id)) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        const cleanContent = sanitizeHtmlContent(dto.content).trim();
        if (!cleanContent) {
            throw new BadRequestException('Nội dung bình luận không được để trống');
        }

        const comment = this.commentRepo.create({
            discussion_id: discussionId,
            content: cleanContent,
            user_id: user.id,
        });
        await this.commentRepo.save(comment);

        // Update sender's read record
        if (user?.id) {
            const userRead = await this.readRepo.findOne({
                where: { discussion_id: discussionId, user_id: user.id }
            });
            if (userRead) {
                userRead.last_read_at = new Date();
                await this.readRepo.save(userRead);
            } else {
                await this.readRepo.save(this.readRepo.create({
                    discussion_id: discussionId,
                    user_id: user.id,
                    last_read_at: new Date(),
                }));
            }
        }

        const notifiedUserIds = new Set<number>();

        // Handle @mentions
        const validMentioned = await this.filterValidMentionedUsers(dto.mentioned_user_ids, discussion.group_id, user.id);
        for (const target of validMentioned) {
            await this.notificationsService.create({
                user_id: target.id,
                title: '📢 Có người nhắc đến bạn',
                message: `${user.full_name || user.username || 'Ai đó'} đã nhắc đến bạn trong thảo luận "${discussion.title}"`,
                type: 'INFO',
                link: `/workspace/discussions/${discussionId}`,
                is_read: false,
            });
            notifiedUserIds.add(target.id);
        }

        // Notify creator + previous commenters, excluding sender and already notified mentions
        const recipients = new Set<number>();
        if (discussion.creator_id !== user.id) {
            recipients.add(discussion.creator_id);
        }

        const previousComments = await this.commentRepo.find({
            where: { discussion_id: discussionId },
            select: ['user_id']
        });
        for (const c of previousComments) {
            if (c.user_id !== user.id) {
                recipients.add(c.user_id);
            }
        }

        for (const recipientId of recipients) {
            if (!notifiedUserIds.has(recipientId)) {
                await this.notificationsService.create({
                    user_id: recipientId,
                    title: '💬 Bình luận mới',
                    message: `${user.full_name || user.username || 'Ai đó'} đã bình luận trong thảo luận "${discussion.title}"`,
                    type: 'INFO',
                    link: `/workspace/discussions/${discussionId}`,
                    is_read: false,
                });
            }
        }

        return this.findOne(discussionId, user);
    }

    async updateComment(commentId: number, dto: UpdateDiscussionCommentDto, user: any) {
        const comment = await this.commentRepo.findOne({ where: { id: commentId } });
        if (!comment) throw new NotFoundException('Comment not found');

        const discussion = await this.repo.findOne({ where: { id: comment.discussion_id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== (user.groupId || user.group_id)) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        // Strictly comment author can edit
        if (comment.user_id !== user?.id) {
            throw new ForbiddenException('Chỉ người viết mới có quyền sửa bình luận này');
        }

        const cleanContent = sanitizeHtmlContent(dto.content).trim();
        if (!cleanContent) {
            throw new BadRequestException('Nội dung bình luận không được để trống');
        }

        comment.content = cleanContent;
        comment.edited_at = new Date();
        return this.commentRepo.save(comment);
    }

    async removeComment(commentId: number, user: any) {
        const comment = await this.commentRepo.findOne({ where: { id: commentId } });
        if (!comment) throw new NotFoundException('Comment not found');

        const discussion = await this.repo.findOne({ where: { id: comment.discussion_id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== (user.groupId || user.group_id)) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        if (comment.user_id !== user?.id && !isMod) {
            throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
        }

        return this.commentRepo.delete(commentId);
    }
}
