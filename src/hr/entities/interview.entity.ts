import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, UpdateDateColumn } from 'typeorm';
import { Candidate } from './candidate.entity';

export enum InterviewStatus {
    PENDING = 'PENDING',
    PASS = 'PASS',
    FAIL = 'FAIL',
    CANCELED = 'CANCELED'
}

@Entity('interviews')
export class Interview {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Candidate)
    @JoinColumn({ name: 'candidate_id' })
    candidate: Candidate;

    @Column()
    candidate_id: number;

    @Column({ type: 'timestamp' })
    scheduled_at: Date;

    @Column({ nullable: true })
    location: string;

    @Column({ nullable: true })
    meeting_link: string;

    @Column({ nullable: true })
    hr_interviewer: string; // The person conducting the interview

    @Column({ type: 'enum', enum: InterviewStatus, default: InterviewStatus.PENDING })
    result_status: InterviewStatus;

    @Column({ type: 'text', nullable: true })
    notes: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
