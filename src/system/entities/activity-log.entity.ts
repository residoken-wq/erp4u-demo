import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('activity_logs')
export class ActivityLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    user_id: number; // ID of the user who performed the action (can be null if system action)

    @Column({ nullable: true })
    username: string; // Cache username for display

    @Column({ nullable: true })
    full_name: string; // Họ và tên người dùng

    @Column()
    action: string; // e.g., 'CREATE', 'UPDATE', 'DELETE', 'LOGIN'

    @Column()
    module: string; // e.g., 'SALES', 'INVENTORY', 'SYSTEM'

    @Column({ nullable: true })
    entity_id: string; // ID of the affected entity (can be string or number)

    @Column('text', { nullable: true })
    description: string; // Details of the action

    @Column('jsonb', { nullable: true })
    details: any; // JSON Diff: { old: ..., new: ... }

    @Column('jsonb', { nullable: true })
    metadata: any; // IP, OS, Browser, etc.

    @CreateDateColumn()
    timestamp: Date;
}
