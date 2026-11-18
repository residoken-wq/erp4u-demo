import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('chatbot_bundles')
@Unique('uq_chatbot_bundles_key_version', ['item_key', 'version'])
export class ChatbotBundle {
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

  @Index('idx_chatbot_bundles_code')
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'jsonb' })
  items: Array<{ sku: string; qty: number }>;
}
