import { Entity, Column, PrimaryColumn, UpdateDateColumn, CreateDateColumn } from 'typeorm';

@Entity('website_policies')
export class WebsitePolicy {
    @PrimaryColumn()
    slug: string; // 'bao-hanh', 'doi-tra', 'bao-mat', 'van-chuyen', 'thanh-toan'

    @Column()
    title: string;

    @Column('text', { nullable: true })
    content: string; // HTML content from rich text editor

    @Column({ default: true })
    is_active: boolean;

    @Column({ default: 0 })
    display_order: number;

    @Column({ nullable: true })
    icon: string; // Icon name or emoji

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
