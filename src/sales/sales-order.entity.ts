import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, ManyToOne, JoinColumn, UpdateDateColumn, Generated } from 'typeorm';
import { SalesOrderItem } from './sales-order-item.entity';
import { Customer } from '../customers/customer.entity';
import { ProductionFulfillmentOrder } from '../planning/pfo.entity';
import { SalesComment } from './sales-comment.entity';
import { User } from '../users/entities/user.entity';

export enum SalesOrderStatus {
  QUOTATION = 'QUOTATION',
  SO_PENDING = 'SO_PENDING',
  SAMPLE_APPROVED = 'SAMPLE_APPROVED',
  DEPOSITED = 'DEPOSITED',
  IN_PRODUCTION = 'IN_PRODUCTION',
  PLANNED = 'PLANNED',
  PARTIAL_DELIVERY = 'PARTIAL_DELIVERY',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  PARTIAL_PAID = 'PARTIAL_PAID',
  PAID = 'PAID'
}

@Entity('sales_orders')
export class SalesOrder {
  [key: string]: any; // TS suppression
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Generated("uuid")
  uuid: string;

  @Column({ unique: true })
  order_code: string;

  @Column('int', { default: 1 })
  version: number;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @Column({ nullable: true })
  customer_id: number;

  @Column({ nullable: true })
  customer_name: string;

  @Column({ nullable: true }) vat_company_name: string;
  @Column({ nullable: true }) vat_tax_code: string;
  @Column({ nullable: true }) vat_address: string;
  @Column('int', { default: 0 }) vat_rate: number;
  @Column({ nullable: true }) vat_invoice_link: string;
  @Column({ nullable: true }) vat_email: string;

  @Column({ type: 'date', nullable: true }) delivery_date: Date;
  @Column({ nullable: true }) shipping_address: string;
  @Column({ nullable: true }) receiver_name: string;
  @Column({ nullable: true }) receiver_phone: string;
  
  @Column({ nullable: true }) contact_name: string;
  @Column({ nullable: true }) contact_phone: string;
  @Column({ nullable: true }) shipping_carrier: string;
  @Column({ nullable: true }) tracking_code: string;
  @Column('decimal', { default: 0 }) shipping_fee: number;

  // Source of order: ERP (manual), WEBSITE (from checkout), POS (point of sale)
  @Column({ nullable: true, default: 'ERP' }) order_source: string;

  @Column('text', { nullable: true }) note: string; // Internal note

  @Column('text', { nullable: true })
  cancel_reason: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_to_id' })
  assigned_to: User;

  @Column({ nullable: true })
  assigned_to_id: number;

  // --- ALLOW DISCOUNT ---
  @Column('float', { default: 0 }) discount_rate: number; // %
  @Column('decimal', { precision: 15, scale: 2, default: 0 }) discount_amount: number; // Fixed Amount
  // ----------------------

  // --- DEPOSIT REQUIREMENTS (FOR QUOTATION) ---
  @Column('float', { default: 0 }) deposit_percent: number; // % cọc yêu cầu
  @Column('decimal', { precision: 15, scale: 2, default: 0 }) deposit_amount: number; // Số tiền cọc yêu cầu
  // --------------------------------------------


  @Column('text', { nullable: true }) payment_note: string;
  @Column('decimal', { precision: 15, scale: 2, default: 0 }) paid_amount: number;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.UNPAID }) payment_status: PaymentStatus;

  @Column('text', { nullable: true }) sample_image_url: string;
  @Column('text', { nullable: true }) sample_note: string;

  @Column({ default: false }) is_production_sample_approved: boolean; // Duyệt mẫu sản xuất (trước khi chạy mass)

  // --- MẪU SX ĐƯỢC DUYỆT: Lưu URLs hình ảnh Google Drive (tối đa 10) ---
  @Column('simple-array', { nullable: true }) approved_sample_images: string[];

  // --- MỚI: CỘT LƯU ĐIỀU KHOẢN ---
  @Column('text', { nullable: true }) terms_content: string;

  // --- LẤY HÓA ĐƠN ---
  @Column({ type: 'boolean', default: true }) require_invoice: boolean;

  // --- DỮ LIỆU HÓA ĐƠN EASYINVOICE ---
  @Column('jsonb', { nullable: true }) vat_invoice_data: {
      ikey: string;           // = order_code
      invoiceNo: string;      // Số HĐ
      lookupCode: string;     // Mã tra cứu
      linkView: string;       // URL tra cứu (= vat_invoice_link)
      issueDate: string;      // Ngày phát hành
      invoiceStatus: number;  // Trạng thái (0: Nháp, 1: Đã ký, ...)
      pattern: string;        // Ký hiệu HĐ
      serial: string;         // Ký hiệu mẫu số
      issuedAt: string;       // Timestamp phát hành từ ERP
      lastEmailSentAt?: string; // Timestamp gửi email lần cuối
      lastEmailSentTo?: string; // Địa chỉ email gửi lần cuối
  };

  // --- DỮ LIỆU HỢP ĐỒNG KHÁCH HÀNG ---
  @Column('text', { nullable: true }) contract_html: string;
  @Column('jsonb', { nullable: true }) contract_variables: any;
  @Column({ nullable: true }) contract_template_id: number;
  @Column({ nullable: true }) contract_status: string;

  @OneToMany(() => ProductionFulfillmentOrder, (pfo) => pfo.sales_order)
  pfos: ProductionFulfillmentOrder[];

  // --- BOD FOLLOW UP ---
  @Column('jsonb', { nullable: true }) bod_follow_up: any;

  @Column({ type: 'enum', enum: SalesOrderStatus, default: SalesOrderStatus.QUOTATION }) status: SalesOrderStatus;

  @Column('decimal', { precision: 15, scale: 2, default: 0 }) total_amount: number;
  @Column('decimal', { precision: 15, scale: 2, default: 0 }) total_cost: number;

  @OneToMany(() => SalesOrderItem, (item) => item.order, { cascade: true })
  items: SalesOrderItem[];

  @OneToMany(() => SalesComment, (comment) => comment.order, { cascade: true })
  comments: SalesComment[];

  // --- RELATION FOR DELIVERY ---
  @OneToMany('SalesDelivery', (delivery: any) => delivery.sales_order)
  deliveries: any[];

  @CreateDateColumn() order_date: Date;
  @UpdateDateColumn() updated_at: Date;

  // --- PORTAL VIEW LOGS ---
  @Column('jsonb', { nullable: true }) portal_view_logs: any;
}