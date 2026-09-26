import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('chatbot_outbox')
@Index('idx_chatbot_outbox_status_next', ['status', 'next_attempt_at'])
export class ChatbotOutbox {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 40 })
  event: string;

  @Column({ type: 'jsonb' })
  payload: any;

  @Column({ type: 'varchar', length: 12, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  next_attempt_at: Date;

  @Column({ type: 'varchar', length: 300, nullable: true })
  last_error: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
