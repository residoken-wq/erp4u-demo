import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AttendanceCalcType {
    DAILY = 'DAILY',   // Tính công theo ngày
    HOURLY = 'HOURLY'  // Tính công theo giờ
}

@Entity('work_shifts')
export class WorkShift {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string; // VD: "Ca sáng", "Ca chiều", "Ca đêm", "Hành chính"

    @Column({ nullable: true })
    code: string; // VD: "MORNING", "AFTERNOON", "NIGHT"

    @Column({ type: 'time' })
    start_time: string; // VD: "08:00"

    @Column({ type: 'time' })
    end_time: string; // VD: "17:00"

    @Column({ type: 'time', nullable: true })
    break_start: string; // Giờ nghỉ trưa bắt đầu

    @Column({ type: 'time', nullable: true })
    break_end: string; // Giờ nghỉ trưa kết thúc

    @Column({ type: 'decimal', precision: 4, scale: 2, default: 8 })
    work_hours: number; // Số giờ làm việc chuẩn của ca

    @Column({ type: 'enum', enum: AttendanceCalcType, default: AttendanceCalcType.DAILY })
    calc_type: AttendanceCalcType;

    @Column({ type: 'int', default: 15 })
    late_tolerance_minutes: number; // Số phút trễ cho phép

    @Column({ type: 'int', default: 6 })
    work_days_per_week: number; // Số ngày làm việc/tuần: 5 hoặc 6

    @Column({ default: true })
    is_active: boolean;

    @Column({ type: 'text', nullable: true })
    note: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
