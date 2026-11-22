import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AiAuditLog } from './ai-audit-log.entity';

@Entity('ai_drafts')
@Check(`"status" IN ('pending', 'confirmed', 'rejected', 'expired')`)
@Index(['created_by', 'status'])
@Index(['status', 'expires_at'])
export class AiDraft {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  kind: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'pending' | 'confirmed' | 'rejected' | 'expired' | string;

  @Column({ type: 'int' })
  created_by: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ type: 'int', nullable: true })
  confirmed_by: number | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'confirmed_by' })
  confirmer: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  result_ref: { entity: string; id: string | number } | null;

  @Column({ type: 'uuid', nullable: true })
  audit_log_id: string | null;

  @ManyToOne(() => AiAuditLog, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'audit_log_id' })
  audit_log: AiAuditLog | null;

  @Column({ type: 'timestamptz' })
  expires_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
