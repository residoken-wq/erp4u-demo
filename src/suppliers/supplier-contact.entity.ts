import { EncryptionTransformer } from '../common/encryption/encryption.transformer';
import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Supplier } from './supplier.entity';

@Entity('supplier_contacts')
export class SupplierContact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', transformer: new EncryptionTransformer() }) full_name: string; // Ten nguoi lien he

  @Column({ nullable: true })
  job_title: string; // Chuc danh: Sale Admin, Giam doc...

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) phone_number: string; // So di dong

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() }) email: string;

  @ManyToOne(() => Supplier, (s) => s.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
