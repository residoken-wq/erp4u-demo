import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/entities/user.entity';

export enum BlogStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED'
}

@Entity('blog_posts')
export class BlogPost {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    slug: string;

    @Column()
    title: string;

    @Column('text', { nullable: true })
    excerpt: string;

    @Column('text')
    content: string;

    @Column('jsonb', { nullable: true, default: [] })
    content_blocks: any;

    @Column({ nullable: true })
    featured_image: string;

    @Column({ nullable: true })
    featured_image_alt: string;

    @Column({ nullable: true })
    featured_image_title: string;

    @Column({ nullable: true })
    category: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'author_id' })
    author: User;

    @Column({ nullable: true })
    author_id: number;

    @Column({
        type: 'enum',
        enum: BlogStatus,
        default: BlogStatus.DRAFT
    })
    status: BlogStatus;

    @Column({ type: 'timestamp', nullable: true })
    published_at: Date;

    // SEO Fields
    @Column({ nullable: true })
    meta_title: string;

    @Column('text', { nullable: true })
    meta_description: string;

    @Column('jsonb', { nullable: true, default: [] })
    tags: string[];

    // RankMath-like SEO Fields
    @Column({ nullable: true })
    focus_keyword: string;

    @Column({ default: 0 })
    seo_score: number;

    @Column('jsonb', { nullable: true })
    seo_meta: {
        title?: string;
        description?: string;
        canonicalUrl?: string;
        schemaType?: 'Article' | 'NewsArticle' | 'BlogPosting';
        ogImage?: string;
        robots?: string[]; // index, noindex, follow, nofollow
    };

    @Column({ default: false })
    is_hidden: boolean;

    @Column({ default: 0 })
    view_count: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
