import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('chatbot_product_facts')
@Unique('uq_chatbot_product_facts_key_version', ['item_key', 'version'])
export class ChatbotProductFact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
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

  @Index('idx_chatbot_product_facts_sku')
  @Column({ type: 'varchar', length: 100 })
  sku: string;

  @Column({ type: 'varchar', length: 32 })
  fact_key: string;

  @Column({ type: 'text' })
  value: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  unit: string | null;
}
