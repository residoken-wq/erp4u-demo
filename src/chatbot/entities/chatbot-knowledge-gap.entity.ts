import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, Unique } from 'typeorm';

@Entity('chatbot_knowledge_gaps')
@Unique('uq_chatbot_knowledge_gaps_norm', ['question_norm'])
export class ChatbotKnowledgeGap {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  question_norm: string;

  @Column({ type: 'text', nullable: true })
  sample_text: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  intent: string | null;

  @Index('idx_chatbot_knowledge_gaps_count')
  @Column({ type: 'int', default: 1 })
  count: number;

  @Index('idx_chatbot_knowledge_gaps_status')
  @Column({ type: 'varchar', length: 12, default: 'open' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  first_seen_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  last_seen_at: Date;
}
