import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { SalesOrder } from '../sales/sales-order.entity';
import { PfoMaterialRequirement } from './pfo-material-requirement.entity';
import { PfoMilestone } from './pfo-milestone.entity';
import { PfoQcRecord } from './pfo-qc-record.entity';

export enum PfoStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  WAITING_VENDOR = 'WAITING_VENDOR',
  MATERIAL_PREP = 'MATERIAL_PREP',
  IN_PRODUCTION = 'IN_PRODUCTION',
  QC = 'QC',
  READY_TO_SHIP = 'READY_TO_SHIP',
  RECEIVING = 'RECEIVING',
  RECONCILIATION = 'RECONCILIATION',
  CLOSED = 'CLOSED'
}

export enum PfoRiskStatus {
  GREEN = 'GREEN',
  AMBER = 'AMBER',
  RED = 'RED'
}

@Entity('production_fulfillment_orders')
export class ProductionFulfillmentOrder {
  [key: string]: any; // Bỏ qua lỗi biên dịch các thuộc tính cũ

  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // PFO-xxx

  @ManyToOne(() => SalesOrder, (so) => so.pfos)
  @JoinColumn({ name: 'sales_order_id' })
  sales_order: SalesOrder;

  @Column({ nullable: true })
  sales_order_id: number;

  @Column({ nullable: true })
  vendor_id: number; // Subcontractor (Supplier)

  @Column({ nullable: true })
  product_id: number; 

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'json', nullable: true })
  custom_quantities: Record<string, number>;

  @Column({ type: 'json', nullable: true })
  mrp_data: any;

  @Column({ type: 'json', nullable: true })
  outsourcing_data: any;

  @Column({ type: 'json', nullable: true })
  logistics_data: any;

  @Column({ type: 'date', nullable: true })
  planned_start_date: Date;

  @Column({ type: 'date', nullable: true })
  committed_finish_date: Date;

  @Column({
    type: 'enum',
    enum: PfoStatus,
    default: PfoStatus.DRAFT
  })
  status: PfoStatus;

  @Column({
    type: 'enum',
    enum: PfoRiskStatus,
    default: PfoRiskStatus.GREEN
  })
  risk_status: PfoRiskStatus;

  @Column('float', { default: 0 })
  progress: number;

  @OneToMany(() => PfoMaterialRequirement, (req) => req.pfo, { cascade: true })
  material_requirements: PfoMaterialRequirement[];

  @OneToMany(() => PfoMilestone, (ms) => ms.pfo, { cascade: true })
  milestones: PfoMilestone[];

  @OneToMany(() => PfoQcRecord, (qc) => qc.pfo, { cascade: true })
  qc_records: PfoQcRecord[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
