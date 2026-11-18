import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { SocialChannel, SocialPlatform } from './social-channel.entity';
import { SalesOrder } from '../../sales/sales-order.entity';

export enum SocialOrderStatus {
    PENDING = 'PENDING',
    SYNCED = 'SYNCED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

@Entity('social_orders')
export class SocialOrder {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => SocialChannel, { nullable: false })
    @JoinColumn({ name: 'channel_id' })
    channel: SocialChannel;

    @Column()
    channel_id: number;

    @Column({ type: 'enum', enum: SocialPlatform })
    platform: SocialPlatform;

    @Column()
    platform_order_id: string;

    @Column({ nullable: true })
    platform_order_code: string;

    @ManyToOne(() => SalesOrder, { nullable: true })
    @JoinColumn({ name: 'sales_order_id' })
    sales_order: SalesOrder;

    @Column({ nullable: true })
    sales_order_id: number;

    @Column({ nullable: true })
    platform_status: string;

    @Column({ type: 'enum', enum: SocialOrderStatus, default: SocialOrderStatus.PENDING })
    sync_status: SocialOrderStatus;

    // Customer info from platform
    @Column({ nullable: true })
    buyer_name: string;

    @Column({ nullable: true })
    buyer_phone: string;

    @Column({ nullable: true })
    buyer_email: string;

    @Column('text', { nullable: true })
    shipping_address: string;

    // Financial info
    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    total_amount: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    shipping_fee: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    platform_discount: number;

    @Column({ nullable: true })
    currency: string;

    // Raw data from platform
    @Column('jsonb', { nullable: true })
    raw_data: any;

    @Column('jsonb', { nullable: true })
    items: {
        platform_item_id: string;
        sku: string;
        name: string;
        quantity: number;
        price: number;
        discount?: number;
    }[];

    @Column({ nullable: true })
    synced_at: Date;

    @Column('text', { nullable: true })
    sync_error: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
