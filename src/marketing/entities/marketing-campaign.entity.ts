import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum CampaignType {
    EMAIL = 'EMAIL',
    SMS = 'SMS',
    PUSH_NOTIFICATION = 'PUSH_NOTIFICATION',
    SOCIAL_AD = 'SOCIAL_AD',
    MIXED = 'MIXED'
}

export enum CampaignStatus {
    DRAFT = 'DRAFT',
    SCHEDULED = 'SCHEDULED',
    RUNNING = 'RUNNING',
    PAUSED = 'PAUSED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

@Entity('marketing_campaigns')
export class MarketingCampaign {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    description: string;

    @Column({ type: 'enum', enum: CampaignType })
    type: CampaignType;

    @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
    status: CampaignStatus;

    @Column({ nullable: true })
    segment_id: number;

    // Content based on campaign type
    @Column('jsonb', { nullable: true })
    content: {
        // For Email
        subject?: string;
        email_body?: string;
        template_id?: string;
        // For SMS
        sms_message?: string;
        // For Social Ad
        ad_platform?: string;
        ad_content?: any;
    };

    // Scheduling
    @Column({ type: 'timestamp', nullable: true })
    scheduled_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    started_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    completed_at: Date;

    // Target audience
    @Column('int', { default: 0 })
    target_count: number;

    // Metrics
    @Column('jsonb', { default: {} })
    metrics: {
        sent?: number;
        delivered?: number;
        opened?: number;
        clicked?: number;
        converted?: number;
        unsubscribed?: number;
        bounced?: number;
        revenue?: number;
    };

    // Budget (for ads)
    @Column('decimal', { precision: 15, scale: 2, nullable: true })
    budget: number;

    @Column('decimal', { precision: 15, scale: 2, nullable: true })
    spent: number;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'created_by_id' })
    created_by: User;

    @Column({ nullable: true })
    created_by_id: number;

    @Column('jsonb', { nullable: true })
    settings: {
        send_time_optimization?: boolean;
        a_b_testing?: boolean;
        personalization?: boolean;
    };

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
