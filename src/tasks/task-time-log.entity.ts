import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Task } from './task.entity';
import { User } from '../users/entities/user.entity';

@Entity('task_time_logs')
export class TaskTimeLog {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Task, (task) => task.time_logs, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'task_id' })
    task: Task;

    @Column()
    task_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: number;

    @Column({ type: 'timestamp' })
    start_time: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_time: Date;

    @Column({ type: 'int', default: 0 })
    duration_seconds: number; // Computed when stopped

    @Column({ nullable: true })
    description: string;

    @CreateDateColumn() created_at: Date;
}
