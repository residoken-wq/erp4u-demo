import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('chatbot_attachments')
export class ChatbotAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_chatbot_attachments_conversation_id')
  @Column({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'uuid', nullable: true })
  request_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  ticket_id: string | null;

  @Column({ type: 'varchar', length: 200 })
  original_name: string;

  @Column({ type: 'varchar', length: 40 })
  detected_mime: string;

  @Column({ type: 'int' })
  size_bytes: number;

  @Column({ type: 'char', length: 64 })
  sha256: string;

  @Column({ type: 'bytea' })
  content: Buffer;

  @Column({ type: 'varchar', length: 16, default: 'stored' })
  status: string;

  @Column({ type: 'timestamptz' })
  purge_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
