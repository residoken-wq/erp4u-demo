import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Product } from '../products/product.entity';

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // VD: SP_MAU_A, LINH_KIEN

  @Index() // <--- Optimize Search
  @Column()
  name: string; // VD: Sản phẩm Mẫu A, Linh kiện

  // % Biên lợi nhuận mong muốn (VD: 30%)
  @Column('decimal', { precision: 5, scale: 2, default: 30 })
  profit_margin: number;

  @Column({ nullable: true })
  outsourcing_category_name: string; // Tên danh mục theo GC

  @Column({ nullable: true })
  size: string; // Kích thước áp dụng cho toàn bộ danh mục

  @OneToMany(() => Product, (product) => product.category_link)
  products: Product[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}