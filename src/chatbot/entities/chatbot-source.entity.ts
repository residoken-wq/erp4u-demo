import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('chatbot_sources')
export class ChatbotSource {
  @PrimaryColumn({ type: 'varchar', length: 10 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  internal_ref: string;

  @Column({ type: 'varchar', length: 16 })
  sensitivity: string;

  @CreateDateColumn({ type: 'timestamptz' })
  imported_at: Date;
}
