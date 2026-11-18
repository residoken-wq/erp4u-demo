import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { QualityInspection } from './quality-inspection.entity';

export enum DefectSeverity {
  MINOR = 'MINOR',       // Nhẹ — chấp nhận được
  MAJOR = 'MAJOR',       // Nặng — cần sửa
  CRITICAL = 'CRITICAL'  // Nghiêm trọng — từ chối
}

@Entity('qc_defect_items')
export class QCDefectItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => QualityInspection, qi => qi.defect_items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inspection_id' })
  inspection: QualityInspection;

  @Column()
  inspection_id: number;

  // Loại lỗi
  @Column()
  defect_type: string; // VD: "Đường may lệch", "Vải khác màu", "Thiếu phụ kiện"

  @Column({ type: 'enum', enum: DefectSeverity, default: DefectSeverity.MINOR })
  severity: DefectSeverity;

  @Column('int', { default: 0 })
  quantity: number; // SL sản phẩm bị lỗi loại này

  @Column({ type: 'text', nullable: true })
  description: string; // Mô tả chi tiết

  @Column({ type: 'text', nullable: true })
  image_url: string; // Ảnh minh chứng

  @Column({ type: 'text', nullable: true })
  action_taken: string; // Hành động xử lý: Sửa lại / Bỏ / Chấp nhận
}
