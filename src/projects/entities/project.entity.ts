import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Milestone } from './milestone.entity';
import { Task } from '../../tasks/task.entity';
import { JoinTable, ManyToMany } from 'typeorm';
import { SalesOrder } from '../../sales/sales-order.entity';

export enum ProjectStatus {
    PLANNING = 'PLANNING',
    ACTIVE = 'ACTIVE',
    COMPLETED = 'COMPLETED',
    ARCHIVED = 'ARCHIVED',
    ON_HOLD = 'ON_HOLD',
    CANCELLED = 'CANCELLED'
}

export enum ProjectType {
    GENERAL = 'GENERAL',
    SO_PROJECT = 'SO_PROJECT'
}

@Entity('projects')
export class Project {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.PLANNING })
    status: ProjectStatus;

    @Column({ type: 'enum', enum: ProjectType, default: ProjectType.GENERAL })
    project_type: ProjectType;

    // --- SO PROJECT LINK ---
    @ManyToOne(() => SalesOrder, { nullable: true })
    @JoinColumn({ name: 'sales_order_id' })
    sales_order: SalesOrder;

    @Column({ nullable: true })
    sales_order_id: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    budget: number; // Ngân sách dự kiến
    // -----------------------

    @Column({ type: 'timestamp', nullable: true })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_date: Date; // Expected end date

    @ManyToOne(() => User)
    @JoinColumn({ name: 'manager_id' })
    manager: User;

    @Column({ nullable: true })
    manager_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'created_by_id' })
    created_by: User;

    @Column({ nullable: true })
    created_by_id: number;

    @ManyToMany(() => User)
    @JoinTable({ name: 'project_members' })
    members: User[];

    @OneToMany(() => Milestone, (m) => m.project)
    milestones: Milestone[];

    @OneToMany(() => Task, (t) => t.project)
    tasks: Task[]; // Tasks directly linked to project

    @CreateDateColumn() created_at: Date;
    @UpdateDateColumn() updated_at: Date;
}
