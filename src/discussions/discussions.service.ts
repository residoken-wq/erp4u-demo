import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Discussion } from './entities/discussion.entity';
import { DiscussionComment } from './entities/discussion-comment.entity';
import { Notification } from '../notifications/notification.entity';

@Injectable()
export class DiscussionsService {
    constructor(
        @InjectRepository(Discussion) private repo: Repository<Discussion>,
        @InjectRepository(DiscussionComment) private commentRepo: Repository<DiscussionComment>,
        @InjectRepository(Notification) private notiRepo: Repository<Notification>,
    ) { }

    async findAll(groupId?: number) {
        const query = this.repo.createQueryBuilder('d')
            .leftJoinAndSelect('d.creator', 'creator')
            .leftJoinAndSelect('d.group', 'group')
            .leftJoinAndSelect('d.comments', 'comments') // To count comments
            .orderBy('d.is_pinned', 'DESC')
            .addOrderBy('d.created_at', 'DESC');

        if (groupId) {
            query.andWhere('d.group_id = :groupId', { groupId });
        }

        const items = await query.getMany();
        // Return with comment count
        return items.map(i => ({
            ...i,
            comment_count: i.comments?.length || 0,
            comments: undefined // Don't return all comments in list view
        }));
    }

    async findOne(id: number) {
        const discussion = await this.repo.findOne({
            where: { id },
            relations: ['creator', 'group', 'comments', 'comments.user']
        });
        if (!discussion) throw new NotFoundException('Discussion not found');

        // Sort comments by date ASC
        discussion.comments.sort((a, b) => a.created_at.getTime() - b.created_at.getTime());

        // Increment view count (simple implementation)
        await this.repo.increment({ id }, 'views_count', 1);

        return discussion;
    }

    async create(data: any) {
        const discussion = this.repo.create(data);
        return this.repo.save(discussion);
    }

    async update(id: number, data: any) {
        await this.repo.update(id, data);
        return this.findOne(id);
    }

    async remove(id: number) {
        return this.repo.delete(id);
    }

    async addComment(discussionId: number, data: any) {
        const comment = this.commentRepo.create({
            discussion_id: discussionId,
            ...data
        });
        const saved = await this.commentRepo.save(comment);

        // Notify discussion creator if someone else comments
        const discussion = await this.repo.findOne({ where: { id: discussionId } });
        if (discussion && discussion.creator_id !== data.user_id) {
            await this.notiRepo.save({
                title: '💬 Bình luận mới',
                message: `Có bình luận mới trong thảo luận "${discussion.title}"`,
                type: 'INFO',
                user_id: discussion.creator_id,
                link: `/discussions?id=${discussionId}`,
                is_read: false
            });
        }

        return this.findOne(discussionId);
    }

    async removeComment(commentId: number) {
        return this.commentRepo.delete(commentId);
    }

    async review(id: number) {
        await this.repo.update(id, { is_reviewed: true });
        return this.findOne(id);
    }
}
