import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { PurchaseOrder } from '../purchasing/entities/purchase-order.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { QCDefectItem } from './qc-defect-item.entity';

export enum QCStatus {
  PENDING = 'PENDING',     // Chờ kiểm tra
  IN_PROGRESS = 'IN_PROGRESS', // Đang kiểm
  PASSED = 'PASSED',       // Đạt
  FAILED = 'FAILED',       // Không đạt
  CONDITIONAL = 'CONDITIONAL'  // Đạt có điều kiện
}

export enum QCType {
  INCOMING = 'INCOMING',       // Kiểm hàng nhập (NPL)
  OUTSOURCING = 'OUTSOURCING', // Kiểm hàng gia công
  FINAL = 'FINAL'              // Kiểm thành phẩm
}

@Entity('quality_inspections')
export class QualityInspection {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // QC-YYMMDD-XXX

  @Column({ type: 'enum', enum: QCType, default: QCType.OUTSOURCING })
  type: QCType;

  @Column({ type: 'enum', enum: QCStatus, default: QCStatus.PENDING })
  status: QCStatus;

  // Link to PO (Outsourcing or Material)
  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'po_id' })
  purchase_order: PurchaseOrder;

  @Column({ nullable: true })
  po_id: number;

  // Supplier / Nhà gia công
  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ nullable: true })
  supplier_id: number;

  @Column({ nullable: true })
  pfo_id: number;

  // Số lượng kiểm tra
  @Column('int', { default: 0 })
  total_quantity: number; // Tổng SL nhận

  @Column('int', { default: 0 })
  inspected_quantity: number; // SL đã kiểm

  @Column('int', { default: 0 })
  passed_quantity: number; // SL đạt

  @Column('int', { default: 0 })
  defect_quantity: number; // SL lỗi

  // Tỷ lệ lỗi (%) — auto-calculated
  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  defect_rate: number;

  // Điểm đánh giá NCC (1-10)
  @Column('decimal', { precision: 3, scale: 1, nullable: true })
  supplier_score: number;

  @Column({ nullable: true })
  inspector: string; // Người kiểm tra

  @Column({ type: 'date', nullable: true })
  inspection_date: string;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  corrective_action: string; // Biện pháp khắc phục

  @OneToMany(() => QCDefectItem, item => item.inspection, { cascade: true })
  defect_items: QCDefectItem[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
