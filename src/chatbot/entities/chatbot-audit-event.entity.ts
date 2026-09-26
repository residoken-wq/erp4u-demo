import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('chatbot_audit_events')
@Index('idx_chatbot_audit_events_object', ['object_type', 'object_id'])
export class ChatbotAuditEvent {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', length: 12 })
  actor_type: string; // 'user' | 'customer' | 'system'

  @Column({ type: 'int', nullable: true })
  actor_user_id: number | null;

  @Column({ type: 'varchar', length: 40 })
  op: string;

  @Column({ type: 'varchar', length: 32 })
  object_type: string;

  @Column({ type: 'varchar', length: 64 })
  object_id: string;

  @Column({ type: 'jsonb', nullable: true })
  before_ref: any;

  @Column({ type: 'jsonb', nullable: true })
  after_ref: any;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
