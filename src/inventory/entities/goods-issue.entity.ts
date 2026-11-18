import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { GoodsIssueItem } from './goods-issue-item.entity';
import { PurchaseOrder } from '../../purchasing/entities/purchase-order.entity';
import { Supplier } from '../../suppliers/supplier.entity';

export enum GoodsIssueType {
    OUTSOURCING = 'OUTSOURCING',   // Xuất cho nhà gia công
    PRODUCTION = 'PRODUCTION',      // Xuất cho SX nội bộ
    OTHER = 'OTHER'
}

export enum GoodsIssueDeliveryMode {
    PER_ORDER = 'PER_ORDER',  // Vải / Vải chần gòn → giao theo đơn hàng
    BULK = 'BULK'             // Phụ kiện → giao khoán, trừ dần
}

export enum GoodsIssueStatus {
    DRAFT = 'DRAFT',
    CONFIRMED = 'CONFIRMED',     // Đã xác nhận xuất kho
    DELIVERED = 'DELIVERED'       // Đã giao đến NCC
}

@Entity('goods_issues')
export class GoodsIssue {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string; // PXK-YYMMDD-XXX

    @Column({ type: 'enum', enum: GoodsIssueType, default: GoodsIssueType.OUTSOURCING })
    type: GoodsIssueType;

    @Column({ type: 'enum', enum: GoodsIssueDeliveryMode, default: GoodsIssueDeliveryMode.PER_ORDER })
    delivery_mode: GoodsIssueDeliveryMode;

    @Column({ type: 'enum', enum: GoodsIssueStatus, default: GoodsIssueStatus.DRAFT })
    status: GoodsIssueStatus;

    // Liên kết PO Gia Công
    @ManyToOne(() => PurchaseOrder, { nullable: true })
    @JoinColumn({ name: 'po_id' })
    purchase_order: PurchaseOrder;

    @Column({ nullable: true })
    po_id: number;

    // Nhà gia công nhận NPL
    @ManyToOne(() => Supplier, { nullable: true })
    @JoinColumn({ name: 'supplier_id' })
    supplier: Supplier;

    @Column({ nullable: true })
    supplier_id: number;

    @Column({ nullable: true })
    pfo_id: number;

    @Column({ type: 'date', nullable: true })
    issue_date: string;

    @Column({ nullable: true })
    vehicle: string; // Xe/phương tiện vận chuyển

    @Column({ nullable: true })
    note: string;

    @OneToMany(() => GoodsIssueItem, item => item.issue, { cascade: true })
    items: GoodsIssueItem[];

    @CreateDateColumn() created_at: Date;
    @UpdateDateColumn() updated_at: Date;
}
