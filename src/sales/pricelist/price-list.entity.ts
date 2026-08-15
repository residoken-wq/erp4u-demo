import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { PriceListRule } from './price-list-rule.entity';

@Entity('price_lists')
export class PriceList {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; 

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  group_id: number; 

  @Column({ type: 'date' })
  valid_from: Date; 

  @Column({ type: 'date' })
  valid_to: Date; 

  @Column({ default: true })
  is_active: boolean;

  @OneToMany(() => PriceListRule, (rule) => rule.price_list, { cascade: true })
  rules: PriceListRule[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}