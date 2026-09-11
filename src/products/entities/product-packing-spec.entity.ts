import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Category } from '../../categories/category.entity';
import { Product } from '../product.entity';

@Entity('product_packing_specs')
export class ProductPackingSpec {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: true })
  category_id: number;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Index()
  @Column({ nullable: true })
  product_id: number;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  name: string; // Tên quy cách: "01 bộ/kiện", "05 bộ/kiện", "10 bộ/kiện", "15 bộ/kiện"...

  @Column({ nullable: true, default: 'Bao tải' })
  package_type: string; // Bao tải, Thùng carton, Màng PE quấn, Túi PE...

  @Column('int', { default: 1 })
  quantity_per_package: number; // Số lượng sản phẩm/bộ trong 1 kiện đóng gói

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  length_cm: number; // Chiều dài kiện (cm)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  width_cm: number; // Chiều rộng kiện (cm)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  height_cm: number; // Chiều cao kiện (cm)

  @Column('int', { default: 0 })
  weight_gram: number; // Cân nặng thực tế ước tính của kiện (gram)

  @Column('int', { default: 0 })
  volumetric_weight_gram: number; // Khối lượng quy đổi thể tích (D x R x C / 6) (gram)

  @Column({ nullable: true })
  note: string; // Hướng dẫn hoặc lưu ý đóng gói

  @Column({ default: false })
  is_default: boolean; // Quy cách mặc định

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
