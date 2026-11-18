import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionFulfillmentOrder } from './pfo.entity';
import { Supplier } from '../suppliers/supplier.entity';

export enum PfoMilestoneType {
  MATERIAL_RECEIVED = 'MATERIAL_RECEIVED',
  SPLICING = 'SPLICING',             // Nối vải
  QUILTING = 'QUILTING',             // Chần gòn
  PRINTING = 'PRINTING',             // In ấn
  EMBROIDERY = 'EMBROIDERY',         // Thêu
  SEWING = 'SEWING',                 // May
  PACKAGING = 'PACKAGING',           // Đóng gói
  INTERNAL_QC_COMPLETED = 'INTERNAL_QC_COMPLETED',
  READY_FOR_DISPATCH = 'READY_FOR_DISPATCH'
}

export enum MilestoneStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  DELAYED = 'DELAYED'
}

@Entity('pfo_milestones')
export class PfoMilestone {
  [key: string]: any;

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductionFulfillmentOrder, (pfo) => pfo.milestones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pfo_id' })
  pfo: ProductionFulfillmentOrder;

  @Column()
  pfo_id: number;

  @Column({ nullable: true })
  milestone_type: string;

  @Column({ nullable: true })
  step_name: string; // Tên công đoạn (Nối vải, Chần gòn, In, Thêu, May, Đóng gói)

  // --- MỚI: Liên kết với sản phẩm cụ thể ---
  @Column({ nullable: true })
  product_id: number;

  @Column({ nullable: true })
  product_name: string;

  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'vendor_id' })
  vendor: Supplier;

  @Column({ nullable: true })
  vendor_id: number; // Nhà gia công riêng cho công đoạn này

  @Column({ nullable: true })
  vendor_name: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  unit_price: number; // Đơn giá gia công công đoạn này

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  total_cost: number;

  @Column({ type: 'date', nullable: true })
  planned_date: Date;

  @Column({ type: 'date', nullable: true })
  actual_date: Date;

  @Column({
    type: 'varchar',
    default: MilestoneStatus.PENDING
  })
  status: string;

  @Column('float', { default: 0 })
  planned_quantity: number;

  @Column('float', { default: 0 })
  completed_quantity: number;

  @Column('float', { default: 0 })
  rejected_quantity: number;

  @Column('text', { nullable: true })
  evidence_photo_url: string;

  @Column('text', { nullable: true })
  note: string;

  @Column({ nullable: true })
  updated_by_id: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
