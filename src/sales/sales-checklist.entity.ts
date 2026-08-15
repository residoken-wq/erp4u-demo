import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { SalesOrder } from './sales-order.entity';
import { SalesChecklistItem } from './sales-checklist-item.entity';

@Entity('sales_checklists')
export class SalesChecklist {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    order_id: number;

    @ManyToOne(() => SalesOrder, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'order_id' })
    order: SalesOrder;

    @OneToMany(() => SalesChecklistItem, item => item.checklist, { cascade: true, eager: true })
    items: SalesChecklistItem[];

    @CreateDateColumn()
    created_at: Date;
}
