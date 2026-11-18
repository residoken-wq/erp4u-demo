import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Candidate } from './candidate.entity';

export enum AssessmentStatus {
    PENDING = 'PENDING',
    SUBMITTED = 'SUBMITTED',
    EVALUATED = 'EVALUATED'
}

@Entity('assessments')
export class Assessment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Candidate)
    @JoinColumn({ name: 'candidate_id' })
    candidate: Candidate;

    @Column()
    candidate_id: number;

    @Column({ type: 'jsonb', nullable: true })
    questions_json: any; // [{ id, category, question, intent }]

    @Column({ type: 'jsonb', nullable: true })
    answers_json: any;   // [{ question_id, answer_text }]

    @Column({ type: 'jsonb', nullable: true })
    ai_feedback: any;    // { score, pros: [], cons: [], recommendation: 'Hire/Potential/Reject' }

    @Column({ type: 'enum', enum: AssessmentStatus, default: AssessmentStatus.PENDING })
    status: AssessmentStatus;

    @Column({ type: 'timestamp', nullable: true })
    submitted_at: Date;

    @CreateDateColumn()
    created_at: Date;
}
