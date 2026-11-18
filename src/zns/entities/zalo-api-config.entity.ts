import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('zalo_api_configs')
export class ZaloApiConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  app_id: string;

  @Column({ nullable: true })
  secret_key: string;

  @Column({ nullable: true })
  oa_id: string;

  @Column({ type: 'text', nullable: true })
  access_token: string;

  @Column({ type: 'text', nullable: true })
  refresh_token: string;

  @Column({ type: 'int', nullable: true, default: 90000 })
  expires_in: number;

  @Column({ type: 'timestamp with time zone', nullable: true })
  access_token_expires_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  refresh_token_expires_at: Date;

  @Column({ default: '632184' })
  order_confirm_template_id: string;

  @Column({ nullable: true })
  delivery_notice_template_id: string;

  @Column({ default: false })
  auto_send_on_order_confirm: boolean;

  @Column({ default: false })
  auto_send_on_delivery_shipped: boolean;

  @Column({ default: 'https://localhost:3000' })
  portal_base_url: string;

  @Column({ default: true })
  is_active: boolean;

  @UpdateDateColumn()
  updated_at: Date;
}
