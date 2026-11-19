import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('usage_counter')
@Unique(['tenant_id', 'metric', 'period'])
export class UsageCounter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'default' })
  tenant_id: string;

  @Column({ type: 'varchar' })
  metric: string;

  @Column({ type: 'varchar' })
  period: string;

  @Column({ type: 'bigint', default: 0 })
  value: string | number;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
