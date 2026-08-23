import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Customer } from '../../customers/customer.entity';
import { Product } from '../../products/product.entity';
import { User } from '../../users/entities/user.entity';
import type { SalesOrder } from '../../sales/sales-order.entity';
import type { PurchaseOrder } from '../../purchasing/entities/purchase-order.entity';
import type { DesignOrderItem } from './design-order-item.entity';

export enum DesignOrderStatus {
    INFO_COLLECTED = 'INFO_COLLECTED',
    DESIGN_ASSIGNED = 'DESIGN_ASSIGNED',
    DESIGNING = 'DESIGNING',
    DEMO_SENT = 'DEMO_SENT',
    CUSTOMER_REVIEWING = 'CUSTOMER_REVIEWING',
    CUSTOMER_APPROVED = 'CUSTOMER_APPROVED',
    SENT_TO_PRINT = 'SENT_TO_PRINT',
    PRINTING = 'PRINTING',
    PRINT_DONE = 'PRINT_DONE',
    DELIVERED = 'DELIVERED'
}

export enum LogoSource {
    SELF_CHECK = 'SELF_CHECK',
    DESIGN_TEAM = 'DESIGN_TEAM'
}

@Entity('design_orders')
export class DesignOrder {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string;

    @Column({ type: 'uuid', unique: true, default: () => 'gen_random_uuid()' })
    uuid: string;

    // --- Thông tin trường/khách hàng ---
    @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column({ nullable: true })
    customer_id: number;

    @Column({ nullable: true })
    school_name: string;

    @Column({ nullable: true })
    contact_person: string;

    @Column({ nullable: true })
    contact_phone: string;

    @Column('text', { nullable: true })
    address: string;

    // --- Thông tin sản phẩm ---
    @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column({ nullable: true })
    product_id: number;

    @Column({ nullable: true })
    product_type: string;

    @Column({ nullable: true })
    product_style: string;

    @Column('decimal', { precision: 10, scale: 2, default: 0 })
    quantity: number;

    @Column({ nullable: true })
    dimensions: string;

    // --- Thông tin thiết kế in ---
    @Column({
        type: 'enum',
        enum: LogoSource,
        nullable: true
    })
    logo_source: LogoSource;

    @Column({ nullable: true })
    background_color: string;

    @Column('jsonb', { nullable: true })
    print_content: any;

    @Column({ nullable: true })
    print_text_color: string;

    @Column({ default: 0 })
    test_color_count: number;

    // --- File management ---
    @Column('jsonb', { nullable: true })
    design_files: any;

    @Column('text', { nullable: true })
    final_design_file: string;

    // --- Trạng thái & Deadline ---
    @Column({
        type: 'enum',
        enum: DesignOrderStatus,
        default: DesignOrderStatus.INFO_COLLECTED
    })
    status: DesignOrderStatus;

    @Column({ type: 'date', nullable: true })
    design_deadline: Date;

    @Column({ type: 'date', nullable: true })
    print_deadline: Date;

    @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'assigned_designer' })
    designer: User;

    @Column({ nullable: true })
    assigned_designer: number;

    @Column({ default: 1 })
    quote_version: number;

    // --- Liên kết ---
    @ManyToOne('SalesOrder', { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'sales_order_id' })
    sales_order: SalesOrder;

    @Column({ nullable: true })
    sales_order_id: number;

    @ManyToOne('PurchaseOrder', { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'purchase_order_id' })
    purchase_order: PurchaseOrder;

    @Column({ nullable: true })
    purchase_order_id: number;

    @Column('text', { nullable: true })
    notes: string;

    @OneToMany('DesignOrderItem', (item: any) => item.design_order, { cascade: true })
    items: DesignOrderItem[];

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
