import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SegmentType {
    STATIC = 'STATIC',
    DYNAMIC = 'DYNAMIC'
}

@Entity('customer_segments')
export class CustomerSegment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    description: string;

    @Column({ type: 'enum', enum: SegmentType, default: SegmentType.DYNAMIC })
    type: SegmentType;

    // Criteria for dynamic segments
    @Column('jsonb', { default: {} })
    criteria: {
        // RFM Analysis
        rfm?: {
            recency_days?: { min?: number; max?: number };
            frequency?: { min?: number; max?: number };
            monetary?: { min?: number; max?: number };
        };
        // Purchase behavior
        purchase?: {
            category_ids?: number[];
            product_ids?: number[];
            min_orders?: number;
            max_orders?: number;
            min_total_spent?: number;
            max_total_spent?: number;
        };
        // Customer attributes
        attributes?: {
            type?: string[];
            lead_status?: string[];
            assigned_to_ids?: number[];
        };
        // Time-based
        time?: {
            last_order_days_ago?: { min?: number; max?: number };
            customer_since_days?: { min?: number; max?: number };
        };
    };

    // For static segments - manually added customer IDs
    @Column('jsonb', { nullable: true, default: [] })
    customer_ids: number[];

    @Column('int', { default: 0 })
    customer_count: number;

    @Column({ nullable: true })
    last_calculated_at: Date;

    @Column({ default: true })
    is_active: boolean;

    @Column('jsonb', { nullable: true })
    metadata: {
        color?: string;
        icon?: string;
    };

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
