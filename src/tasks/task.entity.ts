import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Project } from '../projects/entities/project.entity';
import { Milestone } from '../projects/entities/milestone.entity';
import { TaskTimeLog } from './task-time-log.entity';

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  DONE = 'DONE'
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.MEDIUM })
  priority: TaskPriority;

  @Column({ type: 'timestamp', nullable: true })
  start_date: Date;

  @Column({ type: 'timestamp', nullable: true })
  due_date: Date;

  @Column({ default: false })
  is_reminded: boolean;

  // --- LIÊN KẾT MODULE KHÁC ---
  @Column({ nullable: true })
  reference_code: string; // VD: LEAD-2312, SO-9999, PO-123

  @Column({ nullable: true })
  reference_type: string; // VD: CRM, SALES, PURCHASE, PRODUCTION
  // --------------------------------

  // --- PROJECT MANAGEMENT ---
  @ManyToOne(() => Project, (p) => p.tasks, { nullable: true })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ nullable: true })
  project_id: number;

  @ManyToOne(() => Milestone, (m) => m.tasks, { nullable: true })
  @JoinColumn({ name: 'milestone_id' })
  milestone: Milestone;

  @Column({ nullable: true })
  milestone_id: number;

  @Column({ type: 'float', default: 0 })
  estimated_hours: number;

  @OneToMany(() => TaskTimeLog, (log) => log.task)
  time_logs: TaskTimeLog[];
  // --------------------------

  // --- COST TRACKING ---
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  estimated_cost: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  actual_cost: number;

  @Column({ type: 'text', nullable: true })
  cost_note: string;

  @Column({ nullable: true })
  department: string; // Kế thừa từ milestone hoặc tự set
  // ---------------------

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assignee_id' })
  assignee: User;

  @Column({ nullable: true })
  assignee_id: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'creator_id' })
  creator: User;

  @Column({ nullable: true })
  creator_id: number;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}