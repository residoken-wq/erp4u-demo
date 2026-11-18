import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { SampleTransactionItem } from './sample-transaction-item.entity';
import { Customer } from '../../customers/customer.entity';

export enum SampleTransactionType {
    IMPORT = 'IMPORT',
    EXPORT = 'EXPORT'
}

export enum SampleTransactionStatus {
    DRAFT = 'DRAFT',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

@Entity('inventory_sample_transactions')
export class SampleTransaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string;

    @Column({ type: 'enum', enum: SampleTransactionType })
    type: SampleTransactionType;

    @Column({ type: 'enum', enum: SampleTransactionStatus, default: SampleTransactionStatus.DRAFT })
    status: SampleTransactionStatus;

    // Optional references to external entities/docs
    @Column({ nullable: true })
    reference_type: string; // e.g. 'LEAD', 'QUOTE', 'SO'

    @Column({ nullable: true })
    reference_id: number;

    @ManyToOne(() => Customer, { nullable: true })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column({ nullable: true })
    customer_id: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    deposit_amount: number;

    @Column({ nullable: true })
    receiver_name: string;

    @Column({ nullable: true })
    receiver_phone: string;

    @Column({ nullable: true })
    receiver_address: string;

    @Column({ nullable: true })
    note: string;

    @OneToMany(() => SampleTransactionItem, item => item.transaction, { cascade: true })
    items: SampleTransactionItem[];

    @Column({ nullable: true })
    created_by: string; // Can be user logic

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
