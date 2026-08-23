import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable } from 'typeorm';
import { Customer } from '../../customers/customer.entity';
import { Product } from '../../products/product.entity';
import { CustomerLogo } from './customer-logo.entity';
import { DesignOrder } from './design-order.entity';

export enum PrintDesignType {
    PRINT = 'PRINT',
    EMBROIDERY = 'EMBROIDERY'
}

export enum PrintDesignStatus {
    DRAFT = 'DRAFT',
    IN_REVIEW = 'IN_REVIEW',
    APPROVED = 'APPROVED'
}

@Entity('print_designs')
export class PrintDesign {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    code: string;

    @Column()
    name: string;

    @Column({
        type: 'enum',
        enum: PrintDesignType,
        default: PrintDesignType.PRINT
    })
    type: PrintDesignType;

    @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column({ nullable: true })
    customer_id: number;

    @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'product_id' })
    product: Product;

    @Column({ nullable: true })
    product_id: number;

    @Column('text', { nullable: true })
    layout_image_url: string; // Link ảnh sơ đồ in

    @ManyToMany(() => CustomerLogo, { cascade: true })
    @JoinTable({
        name: 'print_design_logos',
        joinColumn: { name: 'print_design_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'logo_id', referencedColumnName: 'id' }
    })
    customer_logos: CustomerLogo[];

    @Column('jsonb', { nullable: true })
    tech_pack: any; // JSON lưu thông số kỹ thuật: loại mực, lưới in, vị trí in...

    @ManyToOne(() => DesignOrder, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn({ name: 'design_order_id' })
    design_order: DesignOrder;

    @Column({ nullable: true })
    design_order_id: number;

    @Column({ nullable: true })
    print_type: string;

    @Column({ nullable: true })
    background_color: string;

    @Column({ nullable: true })
    text_color: string;

    @Column('text', { nullable: true })
    notes: string;

    @Column({
        type: 'enum',
        enum: PrintDesignStatus,
        default: PrintDesignStatus.DRAFT
    })
    status: PrintDesignStatus;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
