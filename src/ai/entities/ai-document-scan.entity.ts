import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('ai_document_scans')
@Check(`"kind" IN ('supplier_quote', 'delivery_note', 'expense_invoice')`)
@Check(`"source" IN ('xml', 'image', 'pdf')`)
@Check(`"status" IN ('processing', 'ready', 'failed', 'linked')`)
@Index(['created_by', 'created_at'])
@Index(['result_type', 'result_id'])
@Index(['expires_at'])
@Index(['sha256'])
export class AiDocumentScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  kind: 'supplier_quote' | 'delivery_note' | 'expense_invoice' | string;

  @Column({ type: 'varchar', length: 20 })
  source: 'xml' | 'image' | 'pdf' | string;

  @Column({ type: 'varchar', length: 20, default: 'processing' })
  status: 'processing' | 'ready' | 'failed' | 'linked' | string;

  @Column({ type: 'varchar', length: 255 })
  file_key: string;

  @Column({ type: 'varchar', length: 100 })
  mime: string;

  @Column({ type: 'int' })
  size_bytes: number;

  @Column({ type: 'int', default: 1 })
  page_count: number;

  @Column({ type: 'varchar', length: 64 })
  sha256: string;

  @Column({ type: 'jsonb', nullable: true })
  extracted: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  field_confidence: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  warnings: Array<Record<string, any>> | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  error_code: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  result_type: 'purchase_order' | 'goods_receipt' | 'transaction' | string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  result_id: string | null;

  @Column({ type: 'int', nullable: true })
  created_by: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz' })
  expires_at: Date;
}
