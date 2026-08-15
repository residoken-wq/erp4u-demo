import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';

@Entity('product_patterns')
export class ProductPattern {
  @PrimaryGeneratedColumn()
  id: number;

  @OneToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @Column({ nullable: true })
  image_url: string; // URL ảnh sơ đồ

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  fabric_width: number; // Khổ vải (cm)

  @Column('decimal', { precision: 10, scale: 4, default: 0 })
  fabric_yield: number; // Định mức tiêu hao (m/sp)

  @Column('jsonb', { nullable: true })
  details: any; // Lưu mảng chi tiết các miếng rập (Dài, Rộng, SL...)

  @Column({ nullable: true })
  note: string;
}