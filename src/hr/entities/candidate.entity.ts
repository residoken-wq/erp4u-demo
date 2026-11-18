import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { JobPost } from './job-post.entity';

export enum CandidateStatus {
    NEW = 'NEW',
    ASSESSMENT_SENT = 'ASSESSMENT_SENT',
    ASSESSED = 'ASSESSED',
    INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
    HIRED = 'HIRED',
    REJECTED = 'REJECTED'
}

export enum CandidateSource {
    WEBSITE = 'WEBSITE',
    MANUAL = 'MANUAL',
    REFERRAL = 'REFERRAL'
}

@Entity('candidates')
export class Candidate {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    email: string;

    @Column({ nullable: true })
    phone: string;

    @Column({ nullable: true })
    cv_url: string; // File attachment URL

    @Column({ unique: true })
    portal_token: string; // UUID for candidate self-service portal

    @ManyToOne(() => JobPost)
    @JoinColumn({ name: 'job_post_id' })
    job_post: JobPost;

    @Column()
    job_post_id: number;

    @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
    overall_score: number;

    @Column({ type: 'enum', enum: CandidateStatus, default: CandidateStatus.NEW })
    status: CandidateStatus;

    @Column({ type: 'enum', enum: CandidateSource, default: CandidateSource.WEBSITE })
    source: CandidateSource;

    @Column({ type: 'jsonb', nullable: true })
    extra_info: any; // Portfolios, cover letters, etc.

    @CreateDateColumn()
    applied_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
