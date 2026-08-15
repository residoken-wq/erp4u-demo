import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany, UpdateDateColumn } from 'typeorm';
import { SupplierMaterial } from './supplier-material.entity';
import { SupplierContact } from './supplier-contact.entity';
import { ProductRouting } from '../products/product-routing.entity';
import { EncryptionTransformer } from '../common/encryption/encryption.transformer';

export enum SupplierType {
  MATERIAL = 'MATERIAL',
  PROCESSING = 'PROCESSING',
  MIX = 'MIX',
  SERVICE = 'SERVICE',
  LOGISTICS = 'LOGISTICS',
  OTHER = 'OTHER'
}

@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column('decimal', { default: 0 })
  debt: number;

  @Column({ type: 'enum', enum: SupplierType, default: SupplierType.MATERIAL })
  type: SupplierType;

  // --- ENCRYPTED PII & LEGAL FIELDS ---
  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  tax_code: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  legal_name: string;

  @Column({ nullable: true })
  vat_address: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  phone: string;

  @Column({ type: 'text', nullable: true, transformer: new EncryptionTransformer() })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column('text', { nullable: true })
  note: string;

  @Column('text', { nullable: true })
  po_template: string;

  @OneToMany(() => SupplierContact, (c) => c.supplier, { cascade: true })
  contacts: SupplierContact[];

  @OneToMany(() => SupplierMaterial, (sm) => sm.supplier)
  price_list: SupplierMaterial[];

  @OneToMany(() => ProductRouting, (routing) => routing.supplier)
  routings: ProductRouting[];

  @OneToMany('Transaction', (t: any) => t.supplier)
  transactions: any[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
