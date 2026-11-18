import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Product } from '../products/product.entity';
import { Material } from '../materials/material.entity';

@Entity('product_bom')
export class BOM {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column()
  product_id: number;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column()
  material_id: number;

  @Column('decimal', { precision: 10, scale: 4 })
  quantity: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  waste_percent: number;

  @Column({ nullable: true })
  note: string;
}
