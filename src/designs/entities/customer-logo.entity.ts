import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from '../../customers/customer.entity';

export enum LogoStatus {
    DRAFT = 'DRAFT',
    APPROVED = 'APPROVED'
}

@Entity('customer_logos')
export class CustomerLogo {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Customer, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column({ nullable: true })
    customer_id: number;

    @Column()
    name: string;

    @Column('text', { nullable: true })
    image_url: string;

    @Column({ nullable: true })
    dimensions: string; // e.g. 10x5 cm

    @Column('simple-array', { nullable: true })
    colors: string[]; // e.g. pantone colors

    @Column('text', { nullable: true })
    note: string;

    @Column({
        type: 'enum',
        enum: LogoStatus,
        default: LogoStatus.APPROVED
    })
    status: LogoStatus;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
