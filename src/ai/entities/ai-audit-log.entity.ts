import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ai_audit_log')
@Index(['created_at'])
@Index(['user_id', 'created_at'])
export class AiAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ type: 'varchar', length: 50 })
  feature: string;

  @Column({ type: 'varchar', length: 30 })
  provider: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model: string | null;

  @Column({ type: 'int', default: 0 })
  input_tokens: number;

  @Column({ type: 'int', default: 0 })
  output_tokens: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  units: number;

  @Column({ type: 'int', nullable: true })
  latency_ms: number | null;

  @Column({ type: 'varchar', length: 20 })
  status: 'ok' | 'error' | 'quota_exceeded' | 'blocked' | string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  error_code: string | null;

  @Column({ type: 'text', nullable: true })
  prompt_redacted: string | null;

  @Column({ type: 'text', nullable: true })
  response_redacted: string | null;

  @Column({ type: 'jsonb', nullable: true })
  tool_calls: Record<string, any> | any[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
