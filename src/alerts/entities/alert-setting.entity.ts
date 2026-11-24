import {
  Entity,
  PrimaryColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('alert_settings')
export class AlertSetting {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  type: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  params: Record<string, any>;

  @Column({ type: 'int', nullable: true })
  updated_by: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updater: User | null;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
