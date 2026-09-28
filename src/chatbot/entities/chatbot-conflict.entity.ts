import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('chatbot_conflicts')
export class ChatbotConflict {
  @PrimaryColumn({ type: 'varchar', length: 4 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  risk: string;

  @Column({ type: 'text', array: true, default: '{}' })
  locked_topics: string[];

  @Column({ type: 'varchar', length: 40 })
  owner_role: string;

  @Column({ type: 'varchar', length: 10, default: 'open' })
  status: string;

  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  @Column({ type: 'int', nullable: true })
  resolved_by: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;
}
