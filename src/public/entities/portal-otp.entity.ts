import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('portal_otps')
export class PortalOtp {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    email: string;

    @Column()
    otp_code: string; // 6 digits

    @Column()
    customer_id: number;

    @Column({ default: false })
    is_used: boolean;

    @Column({ type: 'timestamp' })
    expires_at: Date;

    @CreateDateColumn()
    created_at: Date;
}
