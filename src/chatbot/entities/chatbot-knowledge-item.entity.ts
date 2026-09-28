import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('chatbot_knowledge_items')
@Unique('uq_chatbot_knowledge_items_key_version', ['item_key', 'version'])
export class ChatbotKnowledgeItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', default: () => 'gen_random_uuid()' })
  item_key: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: 'varchar', length: 16, default: 'draft' })
  status: string;

  @Index('idx_chatbot_knowledge_items_topic')
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

  @Column({ type: 'varchar', length: 32, nullable: true })
  intent: string | null;

  @Column({ type: 'text', nullable: true })
  question: string | null;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  product_sku: string | null;

  @Column({ type: 'boolean', default: false })
  public_allowed: boolean;

  @Column({ type: 'text' })
  search_text: string;

  @Index('idx_chatbot_knowledge_items_seed_key', { where: '"seed_key" IS NOT NULL', unique: true })
  @Column({ type: 'varchar', length: 80, nullable: true })
  seed_key: string | null;
}
