import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('api_tokens')
export class ApiToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Tên gợi nhớ cho bot/service (VD: Daily Report Bot)

  @Column()
  token_hash: string; // Hash của token (bcrypt) để bảo mật

  @Column({ nullable: true })
  token_hint: string; // Vài ký tự cuối để hiển thị (VD: ...aB4c)

  @Column('jsonb', { nullable: true, default: [] })
  permissions: string[]; // Các quyền của token (VD: ['orders:read', 'inventory:read'])

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date; // Thời điểm sử dụng cuối cùng

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date; // Thời hạn (nếu null là vĩnh viễn)

  @Column({ default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
