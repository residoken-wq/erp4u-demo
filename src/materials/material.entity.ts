import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { SupplierMaterial } from '../suppliers/supplier-material.entity';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn() id: number;
  @Column({ unique: true }) code: string;
  @Column() name: string;
  @Column({ nullable: true }) category: string;
  @Column({ nullable: true }) material_type: string;
  @Column() unit: string; 
  @Column({ nullable: true }) purchase_unit: string;
  @Column('decimal', { precision: 10, scale: 4, default: 1 }) conversion_factor: number;
  @Column('decimal', { precision: 15, scale: 2, default: 0 }) cost_per_unit: number; 
  @Column('decimal', { precision: 15, scale: 2, default: 0 }) quantity_in_stock: number;
  @Column({ nullable: true }) supplier_name: string;

  // --- MỚI: GIÁ VỐN TÍNH BOM (Auto update) ---
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  cost_price: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  reserved_stock: number;

  @OneToMany(() => SupplierMaterial, (sm) => sm.material)
  supplier_prices: SupplierMaterial[];

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}