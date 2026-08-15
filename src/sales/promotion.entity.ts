import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum DiscountType {
    PERCENTAGE = 'PERCENTAGE',
    FIXED_AMOUNT = 'FIXED_AMOUNT',
    BUY_X_GET_Y = 'BUY_X_GET_Y',
}

@Entity('promotions')
export class Promotion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    description: string;

    @Column({ type: 'enum', enum: DiscountType, default: DiscountType.PERCENTAGE })
    discount_type: DiscountType;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    discount_value: number; // % hoặc số tiền cố định

    @Column({ type: 'date' })
    start_date: Date;

    @Column({ type: 'date' })
    end_date: Date;

    @Column({ default: true })
    is_active: boolean;

    @Column('jsonb', { nullable: true, default: [] })
    applicable_customer_ids: number[]; // DS khách hàng áp dụng ([] = tất cả)

    @Column('jsonb', { nullable: true, default: [] })
    applicable_product_ids: number[]; // DS sản phẩm áp dụng ([] = tất cả)

    @Column('int', { nullable: true })
    min_quantity: number; // Số lượng tối thiểu

    @Column('decimal', { precision: 15, scale: 2, nullable: true })
    min_order_value: number; // Giá trị đơn tối thiểu

    @Column('int', { nullable: true })
    max_uses: number; // Số lần sử dụng tối đa

    @Column('int', { default: 0 })
    used_count: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
