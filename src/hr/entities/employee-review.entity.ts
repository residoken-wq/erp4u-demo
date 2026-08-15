import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ReviewCampaign } from './review-campaign.entity';
import { Employee } from './employee.entity';

export enum ReviewStatus {
    PENDING = 'PENDING',
    SUBMITTED = 'SUBMITTED',
}

@Entity('employee_reviews')
export class EmployeeReview {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    campaign_id: number;

    @ManyToOne(() => ReviewCampaign)
    @JoinColumn({ name: 'campaign_id' })
    campaign: ReviewCampaign;

    @Column()
    reviewer_id: number; // The person writing the review

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'reviewer_id' })
    reviewer: Employee;

    @Column()
    reviewee_id: number; // The person being reviewed

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'reviewee_id' })
    reviewee: Employee;

    // Generated questions based on campaign config
    @Column({ type: 'jsonb', nullable: true })
    questions_json: any;

    // User's answers
    @Column({ type: 'jsonb', nullable: true })
    answers_json: any;

    // AI summary/feedback generated upon submission
    @Column({ type: 'text', nullable: true })
    ai_feedback: string;

    @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
    status: ReviewStatus;

    @CreateDateColumn()
    created_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    submitted_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
