import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Product } from '../../products/product.entity';
import { ProductionFulfillmentOrder } from '../../planning/pfo.entity';
import { WorkOrder } from '../work-order.entity';

@Entity('production_orders')
export class ProductionOrder {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @ManyToOne(() => Product)
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  // --- MỚI: Liên kết Kế hoạch SX ---
  @ManyToOne(() => ProductionFulfillmentOrder, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pfo_id' })
  pfo: ProductionFulfillmentOrder;

  @Column({ nullable: true })
  pfo_id: number;

  // --- MỚI: Truy vết đơn hàng gốc ---
  @Column({ nullable: true })
  sales_order_code: string;

  // --- MỚI: NCC gia công chính (nếu có) ---
  @Column({ nullable: true })
  assigned_supplier_id: number;

  @Column('decimal', { precision: 15, scale: 2 })
  quantity: number;

  @Column({ type: 'date' })
  start_date: string;

  @Column({ type: 'date' })
  due_date: string;

  @Column({ default: 'PLANNED' }) // PLANNED, IN_PROGRESS, COMPLETED, CANCELLED
  status: string;

  // --- MỚI: Work Orders (tracking từng công đoạn) ---
  @OneToMany(() => WorkOrder, wo => wo.production_order)
  work_orders: WorkOrder[];

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}