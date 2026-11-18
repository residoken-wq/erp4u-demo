import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('stock_history')
export class StockHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: 'IMPORT' | 'EXPORT'; 

  @Column()
  item_type: 'PRODUCT' | 'MATERIAL'; 

  @Column()
  item_id: number; 

  @Column({ nullable: true })
  item_code: string; 

  // --- MỚI: GHI NHẬN KHO NÀO ---
  @Column({ default: 'KHO_TONG' })
  warehouse: string;
  // ----------------------------

  @Column('decimal', { precision: 15, scale: 2 })
  quantity: number; 

  @Column('decimal', { precision: 15, scale: 2 })
  balance_after: number; // Tồn của KHO ĐÓ sau giao dịch

  @Column({ nullable: true })
  reference_code: string; 

  @Column({ nullable: true })
  note: string;

  // --- MỚI: NGƯỜI CẬP NHẬT ---
  @Column({ nullable: true })
  updated_by: string;

  @CreateDateColumn()
  created_at: Date;
}