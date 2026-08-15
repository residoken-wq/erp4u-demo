import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TransactionCategory } from './transaction-category.entity';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date' })
  date: string; // Ngày ghi nhận giao dịch

  @Column()
  type: 'INCOME' | 'EXPENSE';

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @ManyToOne(() => TransactionCategory, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: TransactionCategory;

  @Column({ nullable: true })
  category_id: number;

  @Column({ nullable: true })
  description: string;

  @Column('simple-json', { nullable: true })
  attachments: string[];

  @Column({ nullable: true })
  partner_name: string; // Khách hàng hoặc Nhà cung cấp

  // --- MỚI: LIÊN KẾT CHẶT VỚI SUPPLIER ---
  @Column({ nullable: true })
  supplier_id: number;

  @ManyToOne('Supplier', 'transactions', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: any; // Dùng any hoặc import Supplier để tránh circular dependency nếu cần
  // ---------------------------------------

  // --- LIÊN KẾT TỰ ĐỘNG ---
  @Column({ nullable: true })
  reference_code: string; // Mã đơn hàng (PO-..., SO-...)

  @Column({ nullable: true })
  reference_type: string; // SALES, PURCHASE

  @Column({ nullable: true })
  project_id: number;

  @Column({ nullable: true })
  task_id: number;

  // --- MỚI: THÔNG TIN HÓA ĐƠN VAT ---
  @Column({ nullable: true })
  vat_invoice_code: string; // Số hóa đơn VAT

  @Column({ nullable: true })
  vat_invoice_url: string; // Link ảnh/file hóa đơn
  // ---------------------------------

  // --- MỚI: HẠCH TOÁN BÁO CÁO TÀI CHÍNH ---
  @Column({ default: false })
  is_accounting: boolean; // Đã hạch toán vào BCTC chưa?

  @Column({ nullable: true })
  accounting_invoice_code: string; // Mã hóa đơn (khi hạch toán)

  @Column({ nullable: true })
  accounting_note: string; // Ghi chú hạch toán
  // ----------------------------------------

  // --- MỚI: LƯU TRỮ PHÂN BỔ (CHO NHIỀU SO/PO) ---
  @Column('jsonb', { nullable: true })
  allocations: any; 
  // Ví dụ: [{ refCode: 'SO-001', amount: 5000 }, { refCode: 'SO-002', amount: 3000 }]
  // ----------------------------------------------

  @CreateDateColumn()
  created_at: Date;
}