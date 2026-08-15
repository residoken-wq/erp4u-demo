import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from '../customers/customer.entity';

export enum SampleStatus {
  REQUESTED = 'REQUESTED',   // Khách yêu cầu
  MAKING = 'MAKING',         // Đang may mẫu
  SENT = 'SENT',             // Đã gửi khách
  APPROVED = 'APPROVED',     // Khách duyệt
  REJECTED = 'REJECTED'      // Khách từ chối (Phải sửa)
}

@Entity('product_samples')
export class ProductSample {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  sample_code: string; // Mã mẫu

  @Column()
  product_name: string; // Tên mẫu

  @ManyToOne(() => Customer)
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ nullable: true })
  customer_id: number;

  @Column({
    type: 'enum',
    enum: SampleStatus,
    default: SampleStatus.REQUESTED
  })
  status: SampleStatus;

  @Column({ type: 'date', nullable: true })
  request_date: Date; // Ngày yêu cầu

  @Column({ type: 'date', nullable: true })
  deadline_date: Date; // Hạn chót gửi mẫu

  @Column({ nullable: true })
  feedback: string; // Ý kiến khách hàng

  @Column({ nullable: true })
  image_url: string; // Ảnh mẫu

  @CreateDateColumn()
  created_at: Date;
}