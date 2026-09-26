import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('chatbot_requests')
@Unique('uq_chatbot_requests_code', ['code'])
@Unique('uq_chatbot_requests_idempotency_key', ['idempotency_key'])
export class ChatbotRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  code: string;

  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'int', nullable: true })
  brief_revision: number | null;

  @Column({ type: 'jsonb' })
  contact: any;

  @Column({ type: 'uuid', nullable: true })
  consent_id: string | null;

  @Column({ type: 'varchar', length: 20, default: 'received' })
  status: string;

  @Column({ type: 'int', nullable: true })
  owner_user_id: number | null;

  @Column({ type: 'int', nullable: true })
  customer_id: number | null;

  @Column({ type: 'uuid' })
  idempotency_key: string;

  @Column({ type: 'date', nullable: true })
  customer_requested_due_at: string | null;

  @Column({ type: 'date', nullable: true })
  promised_due_at: string | null;

  @Column({ type: 'text', nullable: true })
  internal_note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
