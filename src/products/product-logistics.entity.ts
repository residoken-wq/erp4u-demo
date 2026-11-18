import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_logistics')
export class ProductLogistics {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @Column()
  name: string; // Tên khoản mục (Khớp với Frontend)

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  cost: number; 

  @Column({ nullable: true })
  note: string;
}