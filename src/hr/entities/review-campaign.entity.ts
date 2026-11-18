import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum CampaignStatus {
    DRAFT = 'DRAFT',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
}

@Entity('review_campaigns')
export class ReviewCampaign {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ type: 'timestamp', nullable: true })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_date: Date;

    // e.g., [{ category: 'Kỹ năng', count: 5 }, { category: 'Thái độ', count: 3 }]
    @Column({ type: 'jsonb', nullable: true })
    config_json: any;

    @Column({ type: 'enum', enum: CampaignStatus, default: CampaignStatus.DRAFT })
    status: CampaignStatus;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
