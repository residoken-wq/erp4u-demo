import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Product } from '../products/product.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // VD: AO_THUN, NEM

  @Index() // <--- Optimize Search
  @Column()
  name: string; // VD: Áo Thun, Nệm Mầm Non

  // % Biên lợi nhuận mong muốn (VD: 30%)
  @Column('decimal', { precision: 5, scale: 2, default: 30 })
  profit_margin: number;

  @OneToMany(() => Product, (product) => product.category_link)
  products: Product[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}