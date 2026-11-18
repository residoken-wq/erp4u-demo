import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

export enum AttendanceStatus {
    PRESENT = 'PRESENT',
    LATE = 'LATE',
    ABSENT = 'ABSENT',
    HALF_DAY = 'HALF_DAY'
}

@Entity('attendances')
export class Attendance {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employee_id' })
    employee: Employee;

    @Column()
    employee_id: number;

    @Column({ type: 'date' })
    date: Date;

    @Column({ type: 'timestamp', nullable: true })
    check_in: Date;

    @Column({ type: 'timestamp', nullable: true })
    check_out: Date;

    @Column({ type: 'decimal', precision: 4, scale: 2, default: 0 })
    work_hours: number;

    @Column({ type: 'enum', enum: AttendanceStatus, default: AttendanceStatus.PRESENT })
    status: AttendanceStatus;

    @Column({ nullable: true })
    note: string;

    @CreateDateColumn()
    created_at: Date;
}
