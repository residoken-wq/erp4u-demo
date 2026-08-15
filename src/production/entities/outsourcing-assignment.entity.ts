import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionOrder } from './production-order.entity';
import { Supplier } from '../../suppliers/supplier.entity';
import { WorkOrderStep } from '../work-order-step.entity';

export enum AssignmentStatus {
  PLANNED = 'PLANNED',       // Đã lên kế hoạch  
  ASSIGNED = 'ASSIGNED',     // Đã giao việc
  IN_PROGRESS = 'IN_PROGRESS', // Đang gia công
  COMPLETED = 'COMPLETED',   // Hoàn thành
  CANCELLED = 'CANCELLED'
}

// Entity cho phân bổ sản lượng gia công cho nhiều NCC
// VD: 500 SP may → 300 cho Xưởng A, 200 cho Xưởng B
@Entity('outsourcing_assignments')
export class OutsourcingAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // GC-YYMMDD-XXX

  // Link to Production Order
  @ManyToOne(() => ProductionOrder, { nullable: true })
  @JoinColumn({ name: 'production_order_id' })
  production_order: ProductionOrder;

  @Column({ nullable: true })
  production_order_id: number;

  // Link to specific Work Order Step (e.g. "Công đoạn May")
  @ManyToOne(() => WorkOrderStep, { nullable: true })
  @JoinColumn({ name: 'step_id' })
  step: WorkOrderStep;

  @Column({ nullable: true })
  step_id: number;

  // Nhà gia công
  @ManyToOne(() => Supplier, { nullable: true })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ nullable: true })
  supplier_id: number;

  @Column({ nullable: true })
  pfo_id: number;

  // Sản lượng phân bổ
  @Column('int', { default: 0 })
  assigned_quantity: number; // SL giao cho NCC này

  @Column('int', { default: 0 })
  completed_quantity: number; // SL đã hoàn thành

  @Column('int', { default: 0 })
  defect_quantity: number; // SL lỗi

  // Đơn giá gia công (có thể khác nhau giữa các NCC)
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  unit_price: number;

  @Column({ type: 'enum', enum: AssignmentStatus, default: AssignmentStatus.PLANNED })
  status: AssignmentStatus;

  @Column({ type: 'date', nullable: true })
  deadline: string;

  @Column({ type: 'date', nullable: true })
  actual_completion_date: string;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
