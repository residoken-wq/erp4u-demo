import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { SalesOrder } from './sales-order.entity';
import { SalesDeliveryItem } from './sales-delivery-item.entity';

@Entity('sales_deliveries')
export class SalesDelivery {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // VD: DO-251210-001 (Delivery Order)

  @ManyToOne(() => SalesOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  sales_order: SalesOrder;

  @Column()
  order_id: number;

  @Column({ type: 'date' })
  delivery_date: Date;

  @Column({ nullable: true })
  note: string;

  @Column('simple-json', { nullable: true })
  attachments: string[];

  @Column({ default: 'PENDING_EXPORT' }) // PENDING_EXPORT, SHIPPED, COMPLETED
  status: string;

  @Column({ default: false })
  email_sent: boolean;

  @Column({ nullable: true })
  delivery_address: string;

  @Column({ nullable: true })
  contact_name: string;

  @Column({ nullable: true })
  contact_phone: string;

  // Shipping carrier info
  @Column({ nullable: true })
  shipping_carrier: string; // ĐVVC code (VD: GHTK, GHN)

  @Column({ nullable: true })
  tracking_code: string; // Mã vận đơn

  @Column('decimal', { precision: 15, scale: 2, nullable: true, default: 0 })
  shipping_cost: number; // Chi phí vận chuyển

  @Column({ nullable: true, default: 'OTHER' })
  shipping_provider: string; // GHTK, GHN, OTHER

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  pick_money: number; // Tiền thu hộ COD

  @Column('int', { default: 1 })
  is_freeship: number; // 1: Shop trả cước, 0: Khách trả cước

  @Column('int', { default: 500 })
  weight_gram: number; // Trọng lượng gói hàng (gram)

  @Column('int', { nullable: true })
  shipping_status_id: number; // Mã trạng thái GHTK (-1 -> 13)

  @Column({ nullable: true })
  shipping_status_text: string; // Tên trạng thái vận đơn

  @Column('jsonb', { nullable: true })
  shipping_metadata: any; // Response GHTK, log tracking, pick address info

  @OneToMany(() => SalesDeliveryItem, (item) => item.delivery, { cascade: true })
  items: SalesDeliveryItem[];

  @CreateDateColumn()
  created_at: Date;
}