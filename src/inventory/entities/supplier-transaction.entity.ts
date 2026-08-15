import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from '../../suppliers/supplier.entity';
import { Material } from '../../materials/material.entity';

export enum SupplierTransactionType {
  RECEIVE_NPL = 'RECEIVE_NPL', // Nhận NPL từ Cty (Cộng tồn)
  CONSUME_NPL = 'CONSUME_NPL', // Khấu trừ NPL do trả thành phẩm (Trừ tồn)
  ADJUSTMENT = 'ADJUSTMENT'    // Điều chỉnh
}

@Entity('supplier_transactions')
export class SupplierTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Supplier, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column()
  supplier_id: number;

  @ManyToOne(() => Material, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column()
  material_id: number;

  @Column({ type: 'enum', enum: SupplierTransactionType })
  type: SupplierTransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 3 })
  balance_after: number;

  @Column({ nullable: true })
  reference_code: string;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  created_at: Date;
}
