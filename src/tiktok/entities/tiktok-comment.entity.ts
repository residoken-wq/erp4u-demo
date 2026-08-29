import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { SocialChannel } from '../../social/entities/social-channel.entity';

export enum CommentSentiment {
    POSITIVE = 'POSITIVE',
    NEGATIVE = 'NEGATIVE',
    NEUTRAL = 'NEUTRAL',
}

@Entity('tiktok_comments')
@Index(['channel_id', 'video_id'])
@Index(['video_id', 'platform_created_at'])
export class TikTokComment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    channel_id: number;

    @ManyToOne(() => SocialChannel, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'channel_id' })
    channel: SocialChannel;

    @Column()
    @Index()
    video_id: string;

    @Column({ unique: true })
    comment_id: string;

    @Column({ nullable: true })
    parent_comment_id: string;

    @Column({ nullable: true })
    username: string;

    @Column({ nullable: true })
    avatar_url: string;

    @Column('text')
    text: string;

    @Column({ default: 0 })
    like_count: number;

    @Column({ default: 0 })
    reply_count: number;

    @Column({ default: false })
    is_replied: boolean;

    @Column({ nullable: true })
    our_reply: string;

    @Column({ type: 'enum', enum: CommentSentiment, default: CommentSentiment.NEUTRAL })
    sentiment: CommentSentiment;

    @Column({ type: 'timestamp', nullable: true })
    platform_created_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
