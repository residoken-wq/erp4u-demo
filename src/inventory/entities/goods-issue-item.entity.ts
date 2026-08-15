import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GoodsIssue } from './goods-issue.entity';
import { Material } from '../../materials/material.entity';
import { Supplier } from '../../suppliers/supplier.entity';

@Entity('goods_issue_items')
export class GoodsIssueItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => GoodsIssue, gi => gi.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'issue_id' })
    issue: GoodsIssue;

    @Column()
    issue_id: number;

    @ManyToOne(() => Material, { nullable: true })
    @JoinColumn({ name: 'material_id' })
    material: Material;

    @Column({ nullable: true })
    material_id: number;

    @ManyToOne('Product', { nullable: true })
    @JoinColumn({ name: 'product_id' })
    product: any;

    @Column({ nullable: true })
    product_id: number;

    // Phân bổ nhà gia công từng NPL
    @ManyToOne(() => Supplier, { nullable: true })
    @JoinColumn({ name: 'supplier_id' })
    supplier: Supplier;

    @Column({ nullable: true })
    supplier_id: number;

    @Column('decimal', { precision: 15, scale: 2 })
    quantity: number;

    // Phân biệt logic: FABRIC (vải, giao theo đơn) vs ACCESSORY (phụ kiện, giao khoán)
    @Column({ nullable: true })
    material_category: string;

    @Column({ nullable: true })
    note: string;
}
