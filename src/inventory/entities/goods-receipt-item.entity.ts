import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { GoodsReceipt } from './goods-receipt.entity';
import { Material } from '../../materials/material.entity';
import { Product } from '../../products/product.entity';
import { PurchaseOrderItem } from '../../purchasing/entities/purchase-order-item.entity';

@Entity('goods_receipt_items')
export class GoodsReceiptItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => GoodsReceipt, receipt => receipt.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'receipt_id' })
    receipt: GoodsReceipt;

    @Column()
    receipt_id: number;

    @ManyToOne(() => Material, { nullable: true })
    @JoinColumn({ name: 'material_id' })
    material: Material;

    @Column({ nullable: true })
    material_id: number;

    @ManyToOne(() => Product, { nullable: true })
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column({ nullable: true })
    product_id: number;

    @ManyToOne(() => PurchaseOrderItem, { nullable: true })
    @JoinColumn({ name: 'po_item_id' })
    po_item: PurchaseOrderItem;

    @Column({ nullable: true })
    po_item_id: number;

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    quantity: number; // Quantity received

    @Column({ type: 'simple-json', nullable: true })
    packing_data: any;
}
