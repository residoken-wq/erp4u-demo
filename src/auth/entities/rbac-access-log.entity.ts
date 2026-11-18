import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('rbac_access_logs')
@Index(['route', 'decision'])
export class RbacAccessLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @CreateDateColumn({ type: 'timestamp' })
  @Index()
  created_at: Date;

  @Column({ type: 'varchar', length: 10 })
  mode: string;

  @Column({ type: 'varchar', length: 20 })
  decision: string;

  @Column({ type: 'varchar', length: 8 })
  method: string;

  @Column({ type: 'varchar', length: 255 })
  route: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  required: string | null;

  @Column({ type: 'int', nullable: true })
  user_id: number | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username: string | null;

  @Column({ type: 'int', nullable: true })
  group_id: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  user_agent: string | null;
}
