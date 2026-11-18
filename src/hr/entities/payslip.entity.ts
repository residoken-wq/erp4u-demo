import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Employee } from './employee.entity';

@Entity('payslips')
export class Payslip {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Employee)
    @JoinColumn({ name: 'employee_id' })
    employee: Employee;

    @Column()
    employee_id: number;

    @Column()
    month: number;

    @Column()
    year: number;

    // Lương cơ bản
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    base_salary: number;

    // Ngày công chuẩn / thực tế
    @Column({ type: 'decimal', precision: 4, scale: 1, default: 26 })
    standard_work_days: number;

    @Column({ type: 'decimal', precision: 4, scale: 1, default: 0 })
    actual_work_days: number;

    // Lương thực tế = base_salary * (actual_work_days / standard_work_days)
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    actual_salary: number;

    // Phụ cấp
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    allowance_meal: number;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    allowance_transport: number;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    allowance_phone: number;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    bonus: number;

    // Tổng thu nhập
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    gross_income: number;

    // Công ty đóng BHXH (17.5%), BHYT (3%), BHTN (1%)
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    bhxh_company: number;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    bhyt_company: number;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    bhtn_company: number;

    // Nhân viên đóng BHXH (8%), BHYT (1.5%), BHTN (1%)
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    bhxh_employee: number;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    bhyt_employee: number;

    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    bhtn_employee: number;

    // Công đoàn (1% - nếu có)
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    union_fee: number;

    // Thuế TNCN
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    tax_income: number;

    // Khấu trừ khác
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    other_deductions: number;

    // Thực nhận
    @Column({ type: 'decimal', precision: 15, scale: 0, default: 0 })
    net_salary: number;

    @Column({ default: true })
    include_insurance: boolean;

    @Column({ type: 'text', nullable: true })
    note: string;

    @Column({ default: false })
    is_paid: boolean;

    @Column({ type: 'timestamp', nullable: true })
    paid_date: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
