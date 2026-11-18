import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';
import { User } from '../../users/entities/user.entity';

export enum LeaveType {
    ANNUAL = 'ANNUAL',
    SICK = 'SICK',
    UNPAID = 'UNPAID',
    MATERNITY = 'MATERNITY',
    OTHER = 'OTHER'
}

export enum LeaveStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED'
}

@Entity('leave_requests')
export class LeaveRequest {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employee_id' })
    employee: Employee;

    @Column()
    employee_id: number;

    @Column({ type: 'enum', enum: LeaveType, default: LeaveType.ANNUAL })
    leave_type: LeaveType;

    @Column({ type: 'date' })
    start_date: Date;

    @Column({ type: 'date' })
    end_date: Date;

    @Column({ type: 'decimal', precision: 4, scale: 1, default: 1 })
    days: number;

    @Column({ type: 'text', nullable: true })
    reason: string;

    @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
    status: LeaveStatus;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'approved_by_id' })
    approved_by: User;

    @Column({ nullable: true })
    approved_by_id: number;

    @Column({ type: 'timestamp', nullable: true })
    approved_at: Date;

    @Column({ nullable: true })
    reject_reason: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
