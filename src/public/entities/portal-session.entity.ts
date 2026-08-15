import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('portal_sessions')
export class PortalSession {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    customer_id: number;

    @Column({ unique: true })
    token: string; // JWT or UUID token

    @Column()
    slug: string; // URL slug = tên trường viết thường + ID

    @Column({ type: 'timestamp' })
    expires_at: Date; // Session hết hạn sau 24h

    @CreateDateColumn()
    created_at: Date;
}
