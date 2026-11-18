import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionFulfillmentOrder } from './pfo.entity';

export enum SupplyMethod {
  COMPANY_SUPPLIED = 'COMPANY_SUPPLIED',
  VENDOR_SUPPLIED = 'VENDOR_SUPPLIED',
  MIXED = 'MIXED'
}

@Entity('pfo_material_requirements')
export class PfoMaterialRequirement {
  [key: string]: any;

  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductionFulfillmentOrder, (pfo) => pfo.material_requirements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pfo_id' })
  pfo: ProductionFulfillmentOrder;

  @Column()
  pfo_id: number;

  @ManyToOne('Material', { nullable: true })
  @JoinColumn({ name: 'material_id' })
  material: any;

  @Column({ nullable: true })
  material_id: number;

  @ManyToOne('Product', { nullable: true })
  @JoinColumn({ name: 'product_id' })
  product: any;

  @Column({ nullable: true })
  product_id: number;

  @Column({ nullable: true })
  material_code: string;

  @Column({ nullable: true })
  material_name: string;

  @Column({
    type: 'enum',
    enum: SupplyMethod,
    default: SupplyMethod.COMPANY_SUPPLIED
  })
  supply_method: SupplyMethod;

  @Column('float', { default: 0 })
  planned_quantity: number;

  @Column('float', { default: 0 })
  actual_order_quantity: number;

  @Column('float', { default: 0 })
  issued_quantity: number; // Qty issued by ERP4U to Subcontractor

  @Column('float', { default: 0 })
  consumed_quantity: number;

  @Column('float', { default: 0 })
  returned_quantity: number;

  @Column('float', { default: 0 })
  scrap_quantity: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  unit_price: number;

  @Column({ nullable: true })
  supplier_id: number; // For vendor_supplied

  // --- MỚI: Dùng tồn kho ---
  @Column({ default: false })
  use_inventory: boolean;

  @Column('float', { default: 0 })
  available_stock: number;

  @Column('float', { default: 0 })
  inventory_used_quantity: number;

  @Column('text', { nullable: true })
  note: string;

  @Column('simple-json', { nullable: true })
  bom_details: any;
}
