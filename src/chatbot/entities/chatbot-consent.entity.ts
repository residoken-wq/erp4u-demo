import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('chatbot_consents')
export class ChatbotConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_chatbot_consents_conversation_id')
  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'varchar', length: 16 })
  purpose: string; // 'contact' | 'marketing'

  @Column({ type: 'varchar', length: 16 })
  channel: string;

  @Column({ type: 'varchar', length: 16 })
  notice_version: string;

  @Column({ type: 'timestamptz' })
  granted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  withdrawn_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
