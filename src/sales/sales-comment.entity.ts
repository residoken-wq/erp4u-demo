import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
// Dùng import type để tránh vòng lặp lúc runtime (Optional nhưng tốt)
import { SalesOrder } from './sales-order.entity';

@Entity('sales_comments')
export class SalesComment {
  @PrimaryGeneratedColumn()
  id: number;

  // Quan trọng: onDelete CASCADE để xóa đơn thì xóa luôn comment
  @ManyToOne(() => SalesOrder, (order) => order.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SalesOrder;

  @Column()
  sender_type: 'STAFF' | 'CUSTOMER';

  @Column({ nullable: true })
  sender_name: string;

  @Column('text')
  content: string;

  @Column({ default: true })
  is_visible: boolean;

  @Column({ default: 'CUSTOMER' })
  comment_type: 'CUSTOMER' | 'INTERNAL';

  @Column('simple-array', { nullable: true })
  mentioned_user_ids: string;

  @CreateDateColumn()
  created_at: Date;

  // Soft delete: store deletion time, null means not deleted
  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date;

  @Column({ nullable: true })
  deleted_by: string; // Username of who deleted it
}