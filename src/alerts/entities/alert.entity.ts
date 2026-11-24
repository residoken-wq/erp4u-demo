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

@Entity('alerts')
@Check(`"status" IN ('open', 'acknowledged', 'snoozed', 'resolved')`)
@Check(`"severity" IN ('low', 'medium', 'high')`)
@Index(['status', 'type'])
@Index(['last_seen_at'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'varchar', length: 20 })
  severity: 'low' | 'medium' | 'high' | string;

  @Column({ type: 'varchar', length: 50 })
  entity_type: string;

  @Column({ type: 'varchar', length: 100 })
  entity_id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  fingerprint: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  detail: Record<string, any>;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: 'open' | 'acknowledged' | 'snoozed' | 'resolved' | string;

  @Column({ type: 'timestamptz', nullable: true })
  snoozed_until: Date | null;

  @Column({ type: 'int', nullable: true })
  acknowledged_by: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acknowledged_by' })
  acknowledger: User | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  first_seen_at: Date;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  last_seen_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolved_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
