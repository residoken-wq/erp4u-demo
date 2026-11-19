import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum WebProjectStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    ARCHIVED = 'ARCHIVED'
}

@Entity('website_projects')
export class WebProject {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    slug: string;

    @Column()
    title: string;

    @Column({ nullable: true })
    school_name: string;

    @Column('text', { nullable: true })
    description: string;

    @Column('text', { nullable: true })
    content: string;

    @Column('jsonb', { nullable: true, default: [] })
    content_blocks: any;

    @Column({ nullable: true })
    image_url: string;

    @Column({
        type: 'enum',
        enum: WebProjectStatus,
        default: WebProjectStatus.DRAFT
    })
    status: WebProjectStatus;

    @Column('int', { default: 0 })
    sort_order: number;

    // SEO Fields
    @Column({ nullable: true })
    meta_title: string;

    @Column('text', { nullable: true })
    meta_description: string;

    @Column({ nullable: true })
    focus_keyword: string;

    @Column('int', { default: 0 })
    seo_score: number;

    @Column('json', { nullable: true })
    seo_meta: any;

    @Column({ default: false })
    is_hidden: boolean;

    @Column('int', { default: 0 })
    view_count: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    published_at: Date;
}
