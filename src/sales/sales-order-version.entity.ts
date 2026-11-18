import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SalesOrder } from './sales-order.entity';

@Entity('sales_order_versions')
export class SalesOrderVersion {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => SalesOrder, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order: SalesOrder;

    @Column()
    order_id: number;

    @Column()
    version_number: number;

    @Column('simple-json')
    data_snapshot: any; // Full JSON snapshot of the order at this version

    @CreateDateColumn()
    created_at: Date;

    @Column({ nullable: true })
    created_by: string; // Username or User ID
}
