import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SampleTransaction } from './sample-transaction.entity';
import { Product } from '../../products/product.entity';

@Entity('inventory_sample_transaction_items')
export class SampleTransactionItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => SampleTransaction, transaction => transaction.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'transaction_id' })
    transaction: SampleTransaction;

    @Column()
    transaction_id: number;

    @ManyToOne(() => Product)
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column()
    product_id: number;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    quantity: number;

    @Column({ nullable: true })
    note: string;
}
