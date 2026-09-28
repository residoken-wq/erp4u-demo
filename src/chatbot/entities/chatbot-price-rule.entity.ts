import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('chatbot_price_rules')
@Unique('uq_chatbot_price_rules_key_version', ['item_key', 'version'])
export class ChatbotPriceRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
  item_key: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: string;

  @Column({ type: 'varchar', length: 80 })
  topic: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  source_refs: any[];

  @Column({ type: 'varchar', length: 4, nullable: true })
  conflict_code: string | null;

  @Column({ type: 'date', nullable: true })
  effective_from: string | null;

  @Column({ type: 'date', nullable: true })
  effective_to: string | null;

  @Column({ type: 'int', nullable: true })
  author_id: number | null;

  @Column({ type: 'int', nullable: true })
  approver_id: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @Index('idx_chatbot_price_rules_target')
  @Column({ type: 'varchar', length: 12 })
  target_type: string;

  @Column({ type: 'varchar', length: 100 })
  target_code: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  fabric: string | null;

  @Column({ type: 'int' })
  qty_min: number;

  @Column({ type: 'int', nullable: true })
  qty_max: number | null;

  @Column({ type: 'varchar', length: 12 })
  qty_scope: string;

  @Column({ type: 'bigint' })
  unit_price: number;

  @Column({ type: 'varchar', length: 3, default: 'VND' })
  currency: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  tax_rate: number | null;

  @Column({ type: 'boolean' })
  tax_included: boolean;

  @Column({ type: 'boolean', default: false })
  shipping_included: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  included_services: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  excluded_services: string[];

  @Column({ type: 'varchar', length: 40, default: 'PUBLIC' })
  customer_scope: string;

  @Column({ type: 'boolean', default: false })
  is_fixture: boolean;
}
