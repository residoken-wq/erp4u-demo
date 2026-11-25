import {
    Injectable,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionComment } from './entities/discussion-comment.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { sanitizeHtmlContent } from '../common/security/html-sanitizer';
import { CreateDiscussionDto } from './dto/create-discussion.dto';
import { UpdateDiscussionDto } from './dto/update-discussion.dto';
import { AddDiscussionCommentDto } from './dto/add-comment.dto';

@Injectable()
export class DiscussionsService {
    constructor(
        @InjectRepository(Discussion) private repo: Repository<Discussion>,
        @InjectRepository(DiscussionComment) private commentRepo: Repository<DiscussionComment>,
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

    async findAll(user: any, groupId?: number) {
        const query = this.repo.createQueryBuilder('d')
            .leftJoinAndSelect('d.creator', 'creator')
            .leftJoinAndSelect('d.group', 'group')
            .leftJoinAndSelect('d.comments', 'comments')
            .orderBy('d.is_pinned', 'DESC')
            .addOrderBy('d.created_at', 'DESC');

        const isMod = await this.isModerator(user);
        if (isMod) {
            if (groupId) {
                query.andWhere('d.group_id = :groupId', { groupId });
            }
        } else {
            const userGroupId = user?.groupId;
            if (userGroupId) {
                query.andWhere('(d.group_id IS NULL OR d.group_id = :userGroupId)', { userGroupId });
            } else {
                query.andWhere('d.group_id IS NULL');
            }
            if (groupId) {
                query.andWhere('d.group_id = :groupId', { groupId });
            }
        }

        const items = await query.getMany();
        return items.map(i => ({
            ...i,
            comment_count: i.comments?.length || 0,
            comments: undefined,
            can_edit: isMod || (user && i.creator_id === user.id),
            can_delete: isMod || (user && i.creator_id === user.id),
            can_pin: isMod,
        }));
    }

    async findOne(id: number, user: any) {
        const discussion = await this.repo.findOne({
            where: { id },
            relations: ['creator', 'group', 'comments', 'comments.user']
        });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        // Group scope check: other group discussion -> 404
        if (discussion.group_id && (!user || discussion.group_id !== user.groupId) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        // Sort comments by date ASC
        discussion.comments.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

        // Increment view count
        await this.repo.increment({ id }, 'views_count', 1);

        const canEdit = isMod || (user && discussion.creator_id === user.id);
        const canDelete = isMod || (user && discussion.creator_id === user.id);

        return {
            ...discussion,
            can_edit: canEdit,
            can_delete: canDelete,
            can_pin: isMod,
            comments: discussion.comments.map(c => ({
                ...c,
                can_delete: isMod || (user && c.user_id === user.id),
            })),
        };
    }

    async create(dto: CreateDiscussionDto, user: any) {
        const cleanContent = sanitizeHtmlContent(dto.content).trim();
        if (!cleanContent) {
            throw new BadRequestException('Nội dung không được để trống');
        }

        const discussion = this.repo.create({
            title: dto.title.trim(),
            content: cleanContent,
            group_id: dto.group_id || null as any,
            creator_id: user.id,
            is_pinned: false,
            type: 'GENERAL',
        });
        return this.repo.save(discussion);
    }

    async update(id: number, dto: UpdateDiscussionDto, user: any) {
        const discussion = await this.repo.findOne({ where: { id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== user.groupId) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

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

        await this.repo.save(discussion);
        return this.findOne(id, user);
    }

    async remove(id: number, user: any) {
        const discussion = await this.repo.findOne({ where: { id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== user.groupId) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        if (discussion.creator_id !== user?.id && !isMod) {
            throw new ForbiddenException('Bạn không có quyền xóa thảo luận này');
        }

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
        if (discussion.group_id && (!user || discussion.group_id !== user.groupId) && !isMod) {
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

        // Notify discussion creator if someone else comments via NotificationsService
        if (discussion.creator_id !== user.id) {
            await this.notificationsService.create({
                title: '💬 Bình luận mới',
                message: `Có bình luận mới trong thảo luận "${discussion.title}"`,
                type: 'INFO',
                user_id: discussion.creator_id,
                link: `/workspace/discussions/${discussionId}`,
                is_read: false,
            });
        }

        return this.findOne(discussionId, user);
    }

    async removeComment(commentId: number, user: any) {
        const comment = await this.commentRepo.findOne({ where: { id: commentId } });
        if (!comment) throw new NotFoundException('Comment not found');

        const discussion = await this.repo.findOne({ where: { id: comment.discussion_id } });
        if (!discussion) throw new NotFoundException('Discussion not found');

        const isMod = await this.isModerator(user);
        if (discussion.group_id && (!user || discussion.group_id !== user.groupId) && !isMod) {
            throw new NotFoundException('Discussion not found');
        }

        if (comment.user_id !== user?.id && !isMod) {
            throw new ForbiddenException('Bạn không có quyền xóa bình luận này');
        }

        return this.commentRepo.delete(commentId);
    }
}
