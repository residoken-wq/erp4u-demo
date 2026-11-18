import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_comments')
export class CustomerComment {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customer_id' })
    customer: Customer;

    @Column()
    customer_id: number;

    @Column()
    sender_type: 'STAFF' | 'CUSTOMER';

    @Column({ nullable: true })
    sender_name: string;

    @Column('text')
    content: string;

    @Column({ default: 'CUSTOMER' })
    comment_type: 'CUSTOMER' | 'INTERNAL';

    @Column('simple-array', { nullable: true })
    mentioned_user_ids: string;

    @CreateDateColumn()
    created_at: Date;
}
