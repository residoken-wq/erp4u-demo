import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Project } from './project.entity';
import { Task } from '../../tasks/task.entity';
import { User } from '../../users/entities/user.entity';

@Entity('milestones')
export class Milestone {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'timestamp', nullable: true })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    due_date: Date;

    @Column({ default: 'PLANNING' })
    status: string;

    // --- Bộ phận phụ trách ---
    @Column({ nullable: true })
    department: string; // SALES, PLANNING, PURCHASING, PRODUCTION, DESIGN, QC, LOGISTICS, FINANCE

    @Column({ type: 'int', default: 0 })
    sort_order: number;

    // Người chịu trách nhiệm chính milestone
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'owner_id' })
    owner: User;

    @Column({ nullable: true })
    owner_id: number;

    // Cho phép user bật/tắt milestone không áp dụng cho đơn này
    @Column({ default: true })
    is_active: boolean;
    // -------------------------

    @ManyToOne(() => Project, (p) => p.milestones, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'project_id' })
    project: Project;

    @Column()
    project_id: number;

    @OneToMany(() => Task, (t) => t.milestone)
    tasks: Task[];

    @CreateDateColumn() created_at: Date;
}
