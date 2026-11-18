import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SalesOrder } from './sales-order.entity';
import { Product } from '../products/product.entity'; // Import Product Entity

export enum BookingStatus {
  NONE = 'NONE',
  TEMPORARY = 'TEMPORARY',
  CONFIRMED = 'CONFIRMED',
  EXPIRED = 'EXPIRED'
}

@Entity('sales_order_items')
export class SalesOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 0 })
  position: number;

  @ManyToOne(() => SalesOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SalesOrder;

  @Column({ nullable: true })
  order_id: number;

  @Column()
  sku: string;

  // --- QUAN TRỌNG: Relation với Product ---
  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id', referencedColumnName: 'id' })
  product: Product;

  @Column({ nullable: true })
  product_id: number;
  // ----------------------------------------

  @Column('text', { nullable: true })
  image_url: string; // Snapshot image from product at time of order

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column('decimal', { precision: 15, scale: 2 })
  unit_price: number;

  @Column('decimal', { precision: 15, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  total_price: number;

  // --- BOOKING STOCK FIELDS ---
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  booked_quantity: number;

  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.NONE })
  booking_status: BookingStatus;

  @Column({ type: 'timestamp', nullable: true })
  booking_expires_at: Date;
  // ----------------------------

  @Column({ nullable: true })
  variant_color: string;

  @Column({ default: false })
  is_sample_approved: boolean;

  @Column('text', { nullable: true })
  sample_image: string;

  @Column({ nullable: true })
  sample_note: string;


  @Column('text', { nullable: true })
  vat_content: string;

  @Column('json', { nullable: true })
  price_ranges: any;

  // --- MỚI: Ghi chú KH và Nội bộ ---
  @Column('text', { nullable: true })
  customer_note: string;

  @Column('text', { nullable: true })
  internal_note: string;
}