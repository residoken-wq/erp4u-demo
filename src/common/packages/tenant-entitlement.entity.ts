import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Entity('tenant_entitlement')
@Unique(['tenant_id', 'package_key'])
export class TenantEntitlement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'default' })
  tenant_id: string;

  @Column({ type: 'varchar' })
  package_key: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  valid_until: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  limits: Record<string, number> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
