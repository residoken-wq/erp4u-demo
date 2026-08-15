import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from './product.entity';
import { Supplier } from '../suppliers/supplier.entity';
import { Process } from '../processes/process.entity';

@Entity('product_routings')
export class ProductRouting {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, (product) => product.routings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ nullable: true })
  product_id: number;

  @ManyToOne(() => Process, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_id' })
  process: Process;

  @Column({ nullable: true })
  process_id: number;
  
  @ManyToOne(() => Supplier, (supplier) => supplier.routings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ nullable: true })
  supplier_id: number;

  // --- FIX: Cho phép trường này là NULL ---
  @Column({ nullable: true })
  step_name: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  cost: number;

  @Column({ default: 1 })
  step_order: number;
  
  @Column({ default: false })
  is_required: boolean;
}