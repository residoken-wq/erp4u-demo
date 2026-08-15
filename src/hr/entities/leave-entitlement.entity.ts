import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

@Entity('leave_entitlements')
export class LeaveEntitlement {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employee_id' })
    employee: Employee;

    @Column()
    employee_id: number;

    @Column({ type: 'int' })
    year: number; // VD: 2026

    @Column({ type: 'decimal', precision: 4, scale: 1, default: 12 })
    annual_days: number; // Số ngày phép năm được cấp

    @Column({ type: 'decimal', precision: 4, scale: 1, default: 0 })
    carried_days: number; // Số ngày phép năm trước chuyển sang

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
