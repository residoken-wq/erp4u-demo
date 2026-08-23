import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import type { DesignOrder } from './design-order.entity';

export enum PrintItemStatus {
    PENDING = 'PENDING',
    PRINTING = 'PRINTING',
    DONE = 'DONE'
}

@Entity('design_order_items')
export class DesignOrderItem {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne('DesignOrder', (order: any) => order.items, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'design_order_id' })
    design_order: DesignOrder;

    @Column()
    design_order_id: number;

    @Column({ nullable: true })
    face_name: string;

    @Column('text', { nullable: true })
    finalized_design_file: string;

    @Column({ nullable: true })
    background_color: string;

    @Column({ nullable: true })
    text_color: string;

    @Column({ nullable: true })
    dimensions: string;

    @Column({ nullable: true })
    print_type: string;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    quantity: number;

    @Column('text', { nullable: true })
    technical_notes: string;

    @Column({
        type: 'enum',
        enum: PrintItemStatus,
        default: PrintItemStatus.PENDING
    })
    print_status: PrintItemStatus;

    @Column({ type: 'date', nullable: true })
    deadline: Date;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
