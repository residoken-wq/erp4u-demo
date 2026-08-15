import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

export enum CreditTransactionType {
    ADD = 'ADD',        // Khi khách trả dư -> Tăng credit
    USE = 'USE',        // Khi dùng credit để cấn trừ -> Giảm credit
    REFUND = 'REFUND'   // Trả lại tiền dư cho khách -> Giảm credit
}

@Entity('customer_credits')
export class CustomerCredit {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column({ name: 'customer_id' })
    customer_id: number;

    @Column({ type: 'enum', enum: CreditTransactionType })
    type: CreditTransactionType;

    @Column('decimal', { precision: 15, scale: 2 })
    amount: number;

    @Column('text', { nullable: true })
    note: string;

    @Column({ nullable: true })
    reference_code: string; // VD: SO-1234 (đơn hàng tạo ra credit hoặc đơn hàng dùng credit)

    @CreateDateColumn()
    created_at: Date;
}
