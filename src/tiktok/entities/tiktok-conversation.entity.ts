import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SocialChannel } from '../../social/entities/social-channel.entity';

export enum ConversationStatus {
    OPEN = 'OPEN',
    CLOSED = 'CLOSED',
    PENDING = 'PENDING',
}

@Entity('tiktok_conversations')
@Index(['channel_id', 'status'])
export class TikTokConversation {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    channel_id: number;

    @ManyToOne(() => SocialChannel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'channel_id' })
    channel: SocialChannel;

    @Column({ unique: true })
    conversation_id: string;

    // Buyer info
    @Column({ nullable: true })
    buyer_id: string;

    @Column({ nullable: true })
    buyer_name: string;

    @Column({ nullable: true })
    buyer_avatar: string;

    @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.OPEN })
    status: ConversationStatus;

    @Column({ default: 0 })
    unread_count: number;

    @Column('text', { nullable: true })
    last_message: string;

    @Column({ type: 'timestamp', nullable: true })
    last_message_at: Date;

    @Column({ default: 0 })
    message_count: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
