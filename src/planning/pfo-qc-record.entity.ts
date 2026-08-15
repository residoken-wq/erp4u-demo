import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductionFulfillmentOrder } from './pfo.entity';

export enum QcStage {
  MATERIAL_FIRST_ARTICLE = 'MATERIAL_FIRST_ARTICLE',
  IN_PROCESS = 'IN_PROCESS',
  FINAL_INCOMING = 'FINAL_INCOMING'
}

export enum QcResult {
  PASS = 'PASS',
  CONDITIONAL_PASS = 'CONDITIONAL_PASS',
  REWORK = 'REWORK',
  REJECT = 'REJECT',
  CONCESSION_APPROVED = 'CONCESSION_APPROVED'
}

@Entity('pfo_qc_records')
export class PfoQcRecord {
  [key: string]: any; // TS suppression
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductionFulfillmentOrder, (pfo) => pfo.qc_records, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pfo_id' })
  pfo: ProductionFulfillmentOrder;

  @Column()
  pfo_id: number;

  @Column({
    type: 'enum',
    enum: QcStage
  })
  qc_stage: QcStage;

  @Column({
    type: 'enum',
    enum: QcResult,
    nullable: true
  })
  result: QcResult;

  @Column('float', { default: 0 })
  inspected_quantity: number;

  @Column('float', { default: 0 })
  passed_quantity: number;

  @Column('float', { default: 0 })
  rejected_quantity: number;

  @Column('text', { nullable: true })
  inspector_note: string;

  @Column({ nullable: true })
  inspector_id: number;

  @Column('simple-json', { nullable: true })
  defects: any; // e.g. [{ defect_code: 'SEWING_01', severity: 'MAJOR', quantity: 5, photo_url: '...' }]

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
