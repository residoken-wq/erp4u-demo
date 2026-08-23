import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { PurchaseOrder } from './purchase-order.entity';
import { Material } from '../../materials/material.entity';
import { Product } from '../../products/product.entity';
import type { PrintDesign } from '../../designs/entities/print-design.entity';
import type { DesignOrder } from '../../designs/entities/design-order.entity';

@Entity('purchase_order_items')
export class PurchaseOrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  // --- FIX: Đổi tên 'po' -> 'purchase_order' ---
  @ManyToOne(() => PurchaseOrder, (po) => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'po_id' })
  purchase_order: PurchaseOrder;
  // ---------------------------------------------

  // --- MỚI: Traceability - Link Item to specific PFO ---
  @Column({ nullable: true })
  pfo_id: number;
  // -----------------------------------------------------

  @ManyToOne(() => Material, { nullable: true })
  @JoinColumn({ name: 'material_id' })
  material: Material;

  @Column({ nullable: true })
  material_id: number;

  @ManyToOne(() => Product, { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ nullable: true })
  product_id: number;

  @Column({ nullable: true })
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  quantity: number;

  @Column('decimal', { precision: 15, scale: 2 })
  unit_price: number;

  @Column('decimal', { precision: 15, scale: 2 })
  subtotal: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  actual_quantity: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  actual_subtotal: number;

  @Column({ nullable: true })
  note: string;  // Ghi chu cho cac don gia cong

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  raw_quantity: number; // Tổng Cần (Gốc)

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  wastage_rate: number; // % Hao hụt

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  total_quantity: number; // Tổng (+Hao hụt) - This might be redundant with `quantity` but good for explicit storage

  // --- MỚI: Tích hợp Thiết kế & In ấn ---
  @ManyToOne('PrintDesign', { nullable: true })
  @JoinColumn({ name: 'print_design_id' })
  print_design: PrintDesign;

  @Column({ nullable: true })
  print_design_id: number;

  // --- MỚI: Liên kết Đơn thiết kế (từ Module Thiết kế & In ấn) ---
  @ManyToOne('DesignOrder', { nullable: true })
  @JoinColumn({ name: 'design_order_id' })
  design_order: DesignOrder;

  @Column({ nullable: true })
  design_order_id: number;

  // --- MỚI: Gán màu sắc sản phẩm cho NPL ---
  @Column({ nullable: true })
  front_color: string;

  @Column({ nullable: true })
  back_color: string;

  // --- MỚI: Ghi chú nội bộ ---
  @Column('text', { nullable: true })
  internal_note: string;
}