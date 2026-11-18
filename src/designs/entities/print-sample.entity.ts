import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PrintDesign } from './print-design.entity';
import { PurchaseOrder } from '../../purchasing/entities/purchase-order.entity';
import { Supplier } from '../../suppliers/supplier.entity';

export enum PrintSampleStatus {
    PENDING = 'PENDING',
    PASSED = 'PASSED',
    FAILED = 'FAILED'
}

@Entity('print_samples')
export class PrintSample {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => PrintDesign, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'print_design_id' })
    print_design: PrintDesign;

    @Column()
    print_design_id: number;

    @ManyToOne(() => PurchaseOrder, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'po_id' })
    po: PurchaseOrder;

    @Column({ nullable: true })
    po_id: number;

    @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'supplier_id' })
    supplier: Supplier;

    @Column({ nullable: true })
    supplier_id: number;

    @Column({ type: 'date', nullable: true })
    sample_date: Date;

    @Column('text', { nullable: true })
    result_image_url: string;

    @Column({
        type: 'enum',
        enum: PrintSampleStatus,
        default: PrintSampleStatus.PENDING
    })
    status: PrintSampleStatus;

    @Column('text', { nullable: true })
    feedback_notes: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
