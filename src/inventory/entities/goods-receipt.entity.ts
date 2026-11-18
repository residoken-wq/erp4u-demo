import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { GoodsReceiptItem } from './goods-receipt-item.entity';
import { PurchaseOrder } from '../../purchasing/entities/purchase-order.entity';

export enum GoodsReceiptStatus {
    DRAFT = 'DRAFT',
    COMPLETED = 'COMPLETED', // Confirmed types
    CANCELLED = 'CANCELLED'
}

@Entity('goods_receipts')
export class GoodsReceipt {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string; // PNK-YYYYMMDD-XXX

    @ManyToOne(() => PurchaseOrder, { nullable: true })
    @JoinColumn({ name: 'po_id' })
    purchase_order: PurchaseOrder;

    @Column({ nullable: true })
    po_id: number;

    @Column({ type: 'enum', enum: GoodsReceiptStatus, default: GoodsReceiptStatus.DRAFT })
    status: GoodsReceiptStatus;

    @Column({ type: 'date', nullable: true })
    delivery_date: string;

    @Column({ type: 'date', nullable: true })
    actual_receive_date: string;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    shipping_fee: number;

    @Column({ nullable: true })
    delivery_note_url: string;

    @Column({ nullable: true })
    note: string;

    @OneToMany(() => GoodsReceiptItem, item => item.receipt, { cascade: true })
    items: GoodsReceiptItem[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
