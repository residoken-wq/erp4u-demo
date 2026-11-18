import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SocialPlatform {
    FACEBOOK = 'FACEBOOK',
    SHOPEE = 'SHOPEE',
    TIKTOK = 'TIKTOK',
    LAZADA = 'LAZADA',
    ZALO = 'ZALO'
}

export enum ChannelStatus {
    ACTIVE = 'ACTIVE',
    DISCONNECTED = 'DISCONNECTED',
    PENDING = 'PENDING',
    ERROR = 'ERROR'
}

@Entity('social_channels')
export class SocialChannel {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: SocialPlatform })
    platform: SocialPlatform;

    @Column({ nullable: true })
    shop_name: string;

    @Column({ nullable: true })
    shop_id: string;

    @Column({ nullable: true })
    merchant_id: string;

    @Column('text', { nullable: true })
    access_token: string;

    @Column('text', { nullable: true })
    refresh_token: string;

    @Column({ type: 'timestamp', nullable: true })
    token_expires_at: Date;

    @Column({ type: 'enum', enum: ChannelStatus, default: ChannelStatus.PENDING })
    status: ChannelStatus;

    @Column('jsonb', { nullable: true, default: {} })
    settings: {
        auto_sync_products?: boolean;
        auto_sync_orders?: boolean;
        auto_sync_inventory?: boolean;
        sync_interval_minutes?: number;
        default_warehouse_id?: number;
    };

    @Column('jsonb', { nullable: true, default: {} })
    metadata: {
        page_id?: string;
        catalog_id?: string;
        partner_id?: string;
        region?: string;
    };

    @Column({ nullable: true })
    last_sync_at: Date;

    @Column({ nullable: true })
    last_error: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
