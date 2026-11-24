import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('alert_runs')
export class AlertRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  counts: Record<string, any> | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  error_code: string | null;
}
