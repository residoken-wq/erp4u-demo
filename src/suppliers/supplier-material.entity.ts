import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Supplier } from './supplier.entity';
import { Material } from '../materials/material.entity';
import { Process } from '../processes/process.entity';
import { Product } from '../products/product.entity'; // MOI

@Entity('supplier_materials')
export class SupplierMaterial {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Supplier, (s) => s.price_list, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column()
  supplier_id: number;

  // --- LOẠI 1: GIÁ NPL ---
  @ManyToOne(() => Material, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column({ nullable: true })
  material_id: number;

  // --- LOẠI 2: GIÁ GIA CÔNG ---
  @ManyToOne(() => Process, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'process_id' })
  process: Process;

  @Column({ nullable: true })
  process_id: number;

  // --- MỚI: LIÊN KẾT SẢN PHẨM (Chỉ dùng cho Giá gia công) ---
  @ManyToOne(() => Product, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ nullable: true })
  product_id: number;
  // -------------------------------------------------------

  @Column('decimal', { precision: 15, scale: 2 })
  price: number;

  @Column({ default: 'VND' })
  currency: string;

  @Column({ default: false })
  is_preferred: boolean;

  @Column({ type: 'date', nullable: true })
  valid_from: Date;

  @Column({ type: 'date', nullable: true })
  valid_to: Date;

  @CreateDateColumn()
  updated_at: Date;
}