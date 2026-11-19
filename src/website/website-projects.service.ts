import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere } from 'typeorm';
import { WebProject, WebProjectStatus } from './entities/web-project.entity';
import { generateSlug } from '../utils/slug.util';

@Injectable()
export class WebsiteProjectsService {
    constructor(
        @InjectRepository(WebProject)
        private readonly repo: Repository<WebProject>
    ) { }

    async findAll(query: any = {}) {
        const { page = 1, limit = 20, search, status } = query;
        const skip = (page - 1) * limit;

        const where: FindOptionsWhere<WebProject> = {};
        if (search) {
            where.title = Like(`%${search}%`);
        }
        if (status) {
            where.status = status;
        }

        const [data, total] = await this.repo.findAndCount({
            where,
            order: { sort_order: 'DESC', created_at: 'DESC' },
            skip,
            take: Number(limit)
        });

        return {
            data,
            total,
            page: Number(page),
            limit: Number(limit),
            last_page: Math.ceil(total / limit)
        };
    }

    async findOne(idOrSlug: string) {
        let options: FindOptionsWhere<WebProject> = {};
        if (!isNaN(Number(idOrSlug))) {
            options = { id: Number(idOrSlug) };
        } else {
            options = { slug: idOrSlug };
        }

        const item = await this.repo.findOne({ where: options });
        if (!item) {
            throw new NotFoundException('Dự án không tồn tại');
        }

        // Increment view count
        if (isNaN(Number(idOrSlug))) {
            await this.repo.increment({ id: item.id }, 'view_count', 1);
        }

        return item;
    }

    private async ensureUniqueSlug(title: string, currentId?: number) {
        let baseSlug = generateSlug(title);
        let finalSlug = baseSlug;
        let counter = 1;

        while (true) {
            const existing = await this.repo.findOne({ where: { slug: finalSlug } });
            if (!existing || (currentId && existing.id === currentId)) {
                break;
            }
            finalSlug = `${baseSlug}-${counter}`;
            counter++;
        }
        return finalSlug;
    }

    async create(data: Partial<WebProject>) {
        if (!data.title) throw new BadRequestException('Title is required');

        if (!data.slug) {
            data.slug = await this.ensureUniqueSlug(data.title);
        } else {
            data.slug = await this.ensureUniqueSlug(data.slug);
        }

        if (data.status === WebProjectStatus.PUBLISHED && !data.published_at) {
            data.published_at = new Date();
        }

        const item = this.repo.create(data);
        return this.repo.save(item);
    }

    async update(id: number, data: Partial<WebProject>) {
        const item = await this.repo.findOne({ where: { id } });
        if (!item) throw new NotFoundException('Dự án không tồn tại');

        if (data.title && data.title !== item.title && (!data.slug || data.slug === item.slug)) {
            data.slug = await this.ensureUniqueSlug(data.title, id);
        } else if (data.slug && data.slug !== item.slug) {
            data.slug = await this.ensureUniqueSlug(data.slug, id);
        }

        if (data.status === WebProjectStatus.PUBLISHED && item.status !== WebProjectStatus.PUBLISHED && !item.published_at) {
            data.published_at = new Date();
        }

        Object.assign(item, data);
        return this.repo.save(item);
    }

    async remove(id: number) {
        const result = await this.repo.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException('Dự án không tồn tại');
        }
        return { message: 'Đã xoá dự án' };
    }
}
