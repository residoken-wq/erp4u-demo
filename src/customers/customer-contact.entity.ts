import { EncryptionTransformer } from '../common/encryption/encryption.transformer';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_contacts')
export class CustomerContact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', transformer: new EncryptionTransformer() }) full_name: string;

  @Column({ nullable: true })
  job_title: string; // Chức danh: Giám đốc, Kế toán...

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) email: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) phone: string;

  @ManyToOne(() => Customer, (customer) => customer.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;
}