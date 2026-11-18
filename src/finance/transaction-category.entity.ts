import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { Transaction } from './transaction.entity';

@Entity('transaction_categories')
export class TransactionCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // VD: "Tiền lương", "Tiền điện", "Thu bán hàng"

  @Column({ default: 'EXPENSE' })
  type: 'INCOME' | 'EXPENSE'; // Loại: Thu hay Chi

  @Column({ nullable: true })
  color: string; // Màu sắc hiển thị trên UI (VD: #f5222d)

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => Transaction, (t) => t.category)
  transactions: Transaction[];
}