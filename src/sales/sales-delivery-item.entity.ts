import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SalesDelivery } from './sales-delivery.entity';

@Entity('sales_delivery_items')
export class SalesDeliveryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SalesDelivery, (delivery) => delivery.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_id' })
  delivery: SalesDelivery;

  @Column()
  sku: string;

  @Column('int')
  quantity: number; // Số lượng giao thực tế đợt này
}