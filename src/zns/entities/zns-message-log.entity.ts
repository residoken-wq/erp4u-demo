import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('zns_message_logs')
export class ZnsMessageLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ nullable: true })
  order_id: number;

  @Index()
  @Column({ nullable: true })
  delivery_id: number;

  @Column({ nullable: true })
  template_id: string;

  @Column({ default: 'ORDER_CONFIRM' })
  template_type: string; // ORDER_CONFIRM, DELIVERY_NOTICE, TEST, CUSTOM

  @Column()
  phone: string; // Formatted 84...

  @Column({ nullable: true })
  recipient_name: string;

  @Column({ nullable: true })
  tracking_id: string; // SO code or DO code

  @Column({ nullable: true })
  msg_id: string; // Zalo message ID from response

  @Column({ default: 'PENDING' })
  status: string; // SUCCESS, FAILED, PENDING

  @Column({ type: 'int', default: 0 })
  error_code: number;

  @Column({ type: 'text', nullable: true })
  error_message: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @Column({ type: 'jsonb', nullable: true })
  response_data: any;

  @Column({ nullable: true })
  sent_by: string; // Username or 'SYSTEM'

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
