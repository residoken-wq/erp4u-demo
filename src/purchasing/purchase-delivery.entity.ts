import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { PurchaseOrder } from './entities/purchase-order.entity';

@Entity('purchase_deliveries')
export class PurchaseDelivery {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => PurchaseOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'po_id' })
  purchase_order: PurchaseOrder;

  @Column()
  po_id: number;

  @Column()
  receipt_code: string; // Mã phiếu nhập kho

  @Column({ type: 'date' })
  delivery_date: Date;

  @Column('jsonb')
  items: any; // Lưu snapshot: [{sku, quantity}]

  @CreateDateColumn()
  created_at: Date;
}