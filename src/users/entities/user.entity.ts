import { EncryptionTransformer } from '../../common/encryption/encryption.transformer';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserGroup } from './user-group.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ select: false }) // Không trả về password khi query thường
  password: string;

  @Column()
  full_name: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) email: string;

  @Column({ default: true })
  is_active: boolean;

  @ManyToOne(() => UserGroup, (group) => group.users)
  @JoinColumn({ name: 'group_id' })
  group: UserGroup;

  @Column({ nullable: true })
  group_id: number;

  @Column({ type: 'timestamp', nullable: true })
  last_activity_at: Date;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) ip_address: string;

  @Column({ nullable: true })
  device_info: string;

  @CreateDateColumn() created_at: Date;
  @UpdateDateColumn() updated_at: Date;
}