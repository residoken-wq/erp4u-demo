import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrderItem } from './purchase-order-item.entity';
import { ProductionFulfillmentOrder } from '../../planning/pfo.entity';
import { Supplier } from '../../suppliers/supplier.entity';

export enum POStatus {
  DRAFT = 'DRAFT',
  SENT = 'SENT',
  CONFIRMED = 'CONFIRMED',
  ORDERED = 'ORDERED',
  PARTIAL_DELIVERED = 'PARTIAL_DELIVERED', // Đã giao 1 phần
  DELIVERED = 'DELIVERED', // Đã giao đủ
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum POType {
  MATERIAL = 'MATERIAL',
  OUTSOURCING = 'OUTSOURCING',
  POOLED = 'POOLED'  // Gộp nhiều PO con
}

@Entity('purchase_orders')
export class PurchaseOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  po_code: string;

  @Column({ generated: 'uuid' })
  uuid: string;

  @Column({
    type: 'enum',
    enum: POStatus,
    default: POStatus.DRAFT
  })
  status: POStatus;

  @Column({
    type: 'enum',
    enum: POType,
    default: POType.MATERIAL
  })
  type: POType;



  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ nullable: true })
  supplier_id: number;

  @ManyToOne(() => ProductionFulfillmentOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pfo_id' })
  pfo: ProductionFulfillmentOrder;

  @Column({ nullable: true })
  pfo_id: number;

  @Column({ nullable: true })
  project_id: number;

  @Column({ nullable: true })
  task_id: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  total_amount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  paid_amount: number;

  @Column({ nullable: true })
  note: string;

  @Column('decimal', { precision: 5, scale: 2, default: 0, nullable: true })
  vat_rate: number;

  // --- MỚI: Thông tin vận chuyển NPL sang Gia công ---
  // Lưu dạng JSON: { sent_date: '...', vehicle: '...', status: 'SENT/RECEIVED', note: '...' }
  @Column({ type: 'jsonb', nullable: true })
  outsourcing_delivery_info: any;

  @Column({ type: 'jsonb', nullable: true })
  delivery_info: any;

  // --- MỚI: Chi tiết Đóng gói (Tab 3 - Dạng Matrix) ---
  @Column({ type: 'jsonb', nullable: true })
  packing_list_details: any[]; // Array of rows
  // --------------------------------------------------

  // --- MỚI: Bán thành phẩm tạo ra từ PO Gia công (Tab Bán thành phẩm) ---
  @Column({ type: 'jsonb', nullable: true })
  semi_finished_products: any[];
  // --------------------------------------------------

  // --- MỚI: Danh sách NPL bị loại bỏ không giao cho xưởng này ---
  @Column({ type: 'jsonb', nullable: true })
  excluded_outsourcing_materials: string[];
  // ---------------------------------------------------------------

  // --- MỚI: Pooled PO Relations ---
  @Column({ nullable: true })
  parent_po_id: number;

  @ManyToOne(() => PurchaseOrder, po => po.child_pos, { nullable: true })
  @JoinColumn({ name: 'parent_po_id' })
  parent_po: PurchaseOrder;

  @OneToMany(() => PurchaseOrder, po => po.parent_po)
  child_pos: PurchaseOrder[];
  // ---------------------------------

  @OneToMany(() => PurchaseOrderItem, (item) => item.purchase_order, { cascade: true })
  items: PurchaseOrderItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}