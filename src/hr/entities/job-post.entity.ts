import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum JobPostStatus {
    DRAFT = 'DRAFT',
    PUBLISHED = 'PUBLISHED',
    CLOSED = 'CLOSED'
}

export enum JobType {
    FULL_TIME = 'FULL_TIME',
    PART_TIME = 'PART_TIME',
    INTERN = 'INTERN',
    FREELANCE = 'FREELANCE'
}

@Entity('job_posts')
export class JobPost {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ unique: true })
    slug: string;

    @Column({ nullable: true })
    department: string;

    @Column({ nullable: true })
    location: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'jsonb', nullable: true })
    requirements_json: any;

    @Column({ nullable: true })
    salary_range: string;

    @Column({ type: 'enum', enum: JobType, default: JobType.FULL_TIME })
    job_type: JobType;

    @Column({ type: 'enum', enum: JobPostStatus, default: JobPostStatus.DRAFT })
    status: JobPostStatus;

    @Column({ type: 'jsonb', nullable: true })
    assessment_template: any; // Mẫu câu hỏi phỏng vấn/đánh giá chuyên môn

    @Column({ default: true })
    show_on_website: boolean;

    @Column({ type: 'timestamp', nullable: true })
    expires_at: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
