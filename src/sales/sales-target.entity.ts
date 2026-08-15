import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Entity('sales_targets')
export class SalesTarget {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: number;

    @Column()
    year: number;

    @Column()
    month: number; // 1-12, 0 = full year target

    @Column('decimal', { precision: 15, scale: 2, default: 0 })
    target_revenue: number;

    @Column({ default: 0 })
    target_leads: number;

    @Column({ default: 0 })
    target_activities: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
