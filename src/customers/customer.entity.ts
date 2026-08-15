import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { SalesOrder } from '../sales/sales-order.entity';
import { CustomerContact } from './customer-contact.entity';
import { CustomerCredit } from './customer-credit.entity';
import { User } from '../users/entities/user.entity';
import { EncryptionTransformer } from '../common/encryption/encryption.transformer';

export enum CustomerType {
  LEAD = 'LEAD',
  CUSTOMER = 'CUSTOMER'
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: CustomerType,
    default: CustomerType.LEAD
  })
  type: CustomerType;

  // --- CRM FIELDS ---
  @Column({ nullable: true })
  lead_status: string; // NEW, CONTACTED, QUALIFIED, NEGOTIATION, WON, LOST

  @Column({ nullable: true })
  lead_source: string; // OUTBOUND, REFERRAL, FACEBOOK, WEBSITE, OTHER

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  potential_value: number;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assigned_to: User;

  @Column({ nullable: true })
  assigned_to_id: number;

  // --- QUAN HỆ KHÁCH HÀNG (CHA - CON) ---
  @ManyToOne(() => Customer, (customer) => customer.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Customer;

  @Column({ nullable: true })
  parent_id: number;

  @OneToMany(() => Customer, (customer) => customer.parent)
  children: Customer[];

  // --- DANH SÁCH LIÊN HỆ ---
  @OneToMany(() => CustomerContact, (contact) => contact.customer, { cascade: true })
  contacts: CustomerContact[];

  // --- PHÁP NHÂN (ENCRYPTED) ---
  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  legal_name: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  legal_address: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  legal_representative: string; // Người đại diện

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  einvoice_email: string; // Email nhận hóa đơn

  // --- THÔNG TIN GIAO HÀNG ---
  @Column('jsonb', { nullable: true, default: [] })
  delivery_addresses: any[];

  @Column('jsonb', { nullable: true, default: [] })
  history: any;

  @Column('jsonb', { nullable: true })
  bod_follow_up: any;

  // --- GHI CHÚ CHÂN DUNG 360 (CKEditor HTML) ---
  @Column({ type: 'text', nullable: true })
  portrait_notes: string;

  // --- LIÊN HỆ & THUẾ (ENCRYPTED) ---
  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  tax_code: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  phone: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  email: string;

  @Column({ nullable: true })
  facebook: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  province: string;

  @Column({ nullable: true })
  district: string;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  credit_limit: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  current_debt: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  credit_balance: number;

  @OneToMany(() => CustomerCredit, (credit) => credit.customer)
  credits: CustomerCredit[];

  @OneToMany(() => SalesOrder, (order) => order.customer)
  orders: SalesOrder[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
