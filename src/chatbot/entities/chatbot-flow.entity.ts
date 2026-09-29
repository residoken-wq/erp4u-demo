import { Entity, Column, PrimaryGeneratedColumn, PrimaryColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('chatbot_flows')
export class ChatbotFlow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index('idx_chatbot_flows_enabled')
  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  /** Higher wins when several published flows match the same trigger. */
  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'jsonb', default: () => `'{"nodes":[],"edges":[]}'::jsonb` })
  draft_graph: any;

  @Column({ type: 'jsonb', nullable: true })
  published_graph: any | null;

  @Column({ type: 'int', default: 0 })
  published_version: number;

  @Column({ type: 'timestamptz', nullable: true })
  published_at: Date | null;

  @Column({ type: 'int', nullable: true })
  published_by: number | null;

  @Column({ type: 'int', nullable: true })
  author_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

/** Where a conversation currently is inside a flow (one row per conversation). */
@Entity('chatbot_flow_states')
export class ChatbotFlowState {
  @PrimaryColumn({ type: 'uuid' })
  conversation_id: string;

  @Column({ type: 'uuid' })
  flow_id: string;

  @Column({ type: 'int' })
  flow_version: number;

  @Column({ type: 'varchar', length: 64 })
  node_id: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
