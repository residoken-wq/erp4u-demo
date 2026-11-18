import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { WorkOrderStep } from './work-order-step.entity';
import { ProductionOrder } from './entities/production-order.entity';

export enum WorkOrderStatus {
  PENDING = 'PENDING',       
  IN_PROGRESS = 'IN_PROGRESS', 
  COMPLETED = 'COMPLETED',   
  CANCELLED = 'CANCELLED'    
}

@Entity('work_orders')
export class WorkOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; 

  @Column()
  product_sku: string; 

  @Column('int')
  quantity: number; 

  @Column({
    type: 'enum',
    enum: WorkOrderStatus,
    default: WorkOrderStatus.PENDING
  })
  status: WorkOrderStatus;

  // --- MỚI: Link to ProductionOrder ---
  @ManyToOne(() => ProductionOrder, po => po.work_orders, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'production_order_id' })
  production_order: ProductionOrder;

  @Column({ nullable: true })
  production_order_id: number;

  @Column({ nullable: true })
  pfo_id: number;

  // --- QUẢN LÝ TIẾN ĐỘ CHI TIẾT ---
  @OneToMany(() => WorkOrderStep, (step) => step.work_order, { cascade: true })
  steps: WorkOrderStep[];
  // -------------------------------

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
