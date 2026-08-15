import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SalesChecklist } from './sales-checklist.entity';

@Entity('sales_checklist_items')
export class SalesChecklistItem {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    checklist_id: number;

    @ManyToOne(() => SalesChecklist, checklist => checklist.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'checklist_id' })
    checklist: SalesChecklist;

    @Column({ length: 50 })
    task_code: string; // e.g., 'QUOTE_CONTACT', 'POST_THANKYOU'

    @Column({ length: 255 })
    task_name: string;

    @Column({ length: 50 })
    stage: string; // QUOTATION, SO_PENDING, IN_PRODUCTION, DELIVERED, POST_SALE

    @Column({ default: false })
    is_completed: boolean;

    @Column({ type: 'timestamp', nullable: true })
    completed_at: Date;

    @Column({ nullable: true })
    completed_by: string;

    @Column({ type: 'date', nullable: true })
    due_date: Date;

    @Column('text', { nullable: true })
    note: string;

    @Column({ default: 0 })
    sort_order: number;

    @CreateDateColumn()
    created_at: Date;
}
