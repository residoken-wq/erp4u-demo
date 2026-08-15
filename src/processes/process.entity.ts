import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('processes')
export class Process {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string; // Mã công đoạn (VD: P_MAY)

  @Column()
  name: string; // Tên công đoạn (VD: May vắt sổ)

  @Column()
  unit: string; // Đơn vị tính (VD: Cái, Giờ)

  // --- FIX: Thêm default: 0 để tránh lỗi not-null ---
  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  standard_cost: number; 
  // ------------------------------------------------

  @Column({ nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}