import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductWebsiteConfig } from './entities/product-website-config.entity';
import { BlogPost } from './entities/blog-post.entity';
import { WebProject } from './entities/web-project.entity';

export interface WebsiteMediaUsageSources {
    productConfigs: Array<{ product_id: number; customization_config: any }>;
    blogs: Array<{ id: number; title: string; featured_image: string; content: string; content_blocks: any }>;
    projects: Array<{ id: number; title: string; image_url: string; content: string; content_blocks: any }>;
}

@Injectable()
export class WebsiteService {
    constructor(
        @InjectRepository(ProductWebsiteConfig)
        private readonly websiteConfigRepo: Repository<ProductWebsiteConfig>,
        @InjectRepository(BlogPost)
        private readonly blogRepo: Repository<BlogPost>,
        @InjectRepository(WebProject)
        private readonly projectRepo: Repository<WebProject>,
    ) { }

    async getProductWebsiteConfig(productId: number) {
        return this.websiteConfigRepo.findOne({ where: { product_id: productId } });
    }

    async saveProductWebsiteConfig(productId: number, config: any) {
        try {
            let entry = await this.websiteConfigRepo.findOne({ where: { product_id: productId } });
            if (!entry) {
                entry = this.websiteConfigRepo.create({
                    product_id: productId,
                    customization_config: config,
                });
            } else {
                entry.customization_config = config;
            }
            return await this.websiteConfigRepo.save(entry);
        } catch (error) {
            console.error('Error in saveProductWebsiteConfig:', error);
            throw error;
        }
    }

    async getMediaUsageSources(): Promise<WebsiteMediaUsageSources> {
        const [productConfigs, blogs, projects] = await Promise.all([
            this.websiteConfigRepo.find(),
            this.blogRepo.find({ select: ['id', 'title', 'featured_image', 'content', 'content_blocks'] }),
            this.projectRepo.find({ select: ['id', 'title', 'image_url', 'content', 'content_blocks'] }),
        ]);

        return { productConfigs, blogs, projects };
    }
}
