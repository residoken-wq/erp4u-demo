import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('analytics_visitors')
export class AnalyticsVisitor {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255, unique: true })
    session_id: string;

    @Column({ type: 'varchar', length: 45, nullable: true })
    ip_address: string;

    @Column({ type: 'varchar', length: 500, nullable: true })
    user_agent: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    last_active: Date;

    @Column({ type: 'varchar', length: 100, nullable: true })
    country: string;

    @CreateDateColumn()
    created_at: Date;
}
