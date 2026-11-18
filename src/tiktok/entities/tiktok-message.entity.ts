import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SocialChannel } from '../../social/entities/social-channel.entity';

export enum MessageSenderType {
    BUYER = 'BUYER',
    SELLER = 'SELLER',
    SYSTEM = 'SYSTEM',
}

export enum MessageContentType {
    TEXT = 'TEXT',
    IMAGE = 'IMAGE',
    PRODUCT_CARD = 'PRODUCT_CARD',
    ORDER_CARD = 'ORDER_CARD',
}

@Entity('tiktok_messages')
@Index(['channel_id', 'conversation_id'])
@Index(['conversation_id', 'platform_created_at'])
export class TikTokMessage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    channel_id: number;

    @ManyToOne(() => SocialChannel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'channel_id' })
    channel: SocialChannel;

    @Column()
    @Index()
    conversation_id: string;

    @Column({ unique: true })
    message_id: string;

    @Column({ type: 'enum', enum: MessageSenderType })
    sender_type: MessageSenderType;

    @Column({ type: 'enum', enum: MessageContentType, default: MessageContentType.TEXT })
    content_type: MessageContentType;

    @Column('text')
    content: string;

    // Buyer info (cached for display)
    @Column({ nullable: true })
    buyer_name: string;

    @Column({ nullable: true })
    buyer_avatar: string;

    @Column({ nullable: true })
    buyer_id: string;

    @Column({ default: false })
    is_read: boolean;

    @Column({ type: 'timestamp', nullable: true })
    replied_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    platform_created_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
