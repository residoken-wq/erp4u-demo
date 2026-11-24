import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { AiConversation } from './ai-conversation.entity';
import { AiAuditLog } from './ai-audit-log.entity';

export interface CopilotSourceItem {
  type: string;
  id: string;
  label: string;
  path: string;
}

export interface CopilotToolStep {
  tool: string;
  label: string;
}

export interface CopilotDraftItem {
  id: string;
  kind: string;
  title: string;
  summary: string;
}

@Entity('ai_conversation_messages')
@Check(`"role" IN ('user', 'assistant')`)
@Check(`"input_mode" IN ('text', 'voice')`)
@Index(['conversation_id', 'created_at'])
@Index(['created_at'])
export class AiConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversation_id: string;

  @ManyToOne(() => AiConversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: AiConversation;

  @Column({ type: 'varchar', length: 20 })
  role: 'user' | 'assistant' | string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  tool_steps: CopilotToolStep[] | null;

  @Column({ type: 'jsonb', nullable: true })
  sources: CopilotSourceItem[] | null;

  @Column({ type: 'uuid', nullable: true })
  audit_log_id: string | null;

  @ManyToOne(() => AiAuditLog, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'audit_log_id' })
  audit_log?: AiAuditLog | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  error_code: string | null;

  @Column({ type: 'varchar', length: 10, default: 'text' })
  input_mode: 'text' | 'voice' | string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'jsonb', nullable: true })
  drafts: CopilotDraftItem[] | null;
}
