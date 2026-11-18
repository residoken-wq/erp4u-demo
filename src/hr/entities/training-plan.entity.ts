import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

export enum TrainingStatus {
    PLANNED = 'PLANNED',
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

@Entity('training_plans')
export class TrainingPlan {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employee_id' })
    employee: Employee;

    @Column()
    employee_id: number;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'date', nullable: true })
    start_date: Date;

    @Column({ type: 'date', nullable: true })
    target_date: Date;

    @Column({ type: 'enum', enum: TrainingStatus, default: TrainingStatus.PLANNED })
    status: TrainingStatus;

    // JSON array: ["Skill 1", "Skill 2"]
    @Column({ type: 'simple-array', nullable: true })
    skills: string[];

    // JSON array: [{title, completed, date}]
    @Column({ type: 'json', nullable: true })
    milestones: { title: string; completed: boolean; date?: string }[];

    @Column({ type: 'int', default: 0 })
    progress: number;

    @Column({ type: 'text', nullable: true })
    note: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
