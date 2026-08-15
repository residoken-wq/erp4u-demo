import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SocialChannel, SocialPlatform } from './social-channel.entity';
import { Product } from '../../products/product.entity';

export enum ProductMappingStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ERROR = 'ERROR'
}

@Entity('social_product_mappings')
export class SocialProductMapping {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => SocialChannel, { nullable: false })
    @JoinColumn({ name: 'channel_id' })
    channel: SocialChannel;

    @Column()
    channel_id: number;

    @Column({ type: 'enum', enum: SocialPlatform })
    platform: SocialPlatform;

    @ManyToOne(() => Product, { nullable: false })
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column()
    product_id: number;

    @Column()
    platform_product_id: string;

    @Column({ nullable: true })
    platform_sku: string;

    @Column({ nullable: true })
    platform_name: string;

    @Column({ type: 'enum', enum: ProductMappingStatus, default: ProductMappingStatus.ACTIVE })
    status: ProductMappingStatus;

    // Price can be different on each platform
    @Column('decimal', { precision: 15, scale: 2, nullable: true })
    platform_price: number;

    // Current stock on platform
    @Column('int', { default: 0 })
    platform_stock: number;

    @Column('jsonb', { nullable: true })
    platform_data: any;

    @Column({ nullable: true })
    last_sync_at: Date;

    @Column('text', { nullable: true })
    last_error: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
