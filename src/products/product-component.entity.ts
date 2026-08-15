import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_components')
export class ProductComponent {
  @PrimaryGeneratedColumn()
  id: number;

  // Sửa: Bỏ tham số thứ 2 sai cú pháp
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_product_id' })
  parent_product: Product;

  // Sửa: Bỏ tham số thứ 2 sai cú pháp
  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'child_product_id' })
  child_product: Product;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column({ default: 0 })
  sort_order: number;
}