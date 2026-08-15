import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from '../users/entities/user.entity';

export enum AnnouncementType {
    INFO = 'INFO',
    WARNING = 'WARNING',
    IMPORTANT = 'IMPORTANT'
}

export enum AnnouncementPriority {
    LOW = 'LOW',
    NORMAL = 'NORMAL',
    HIGH = 'HIGH'
}

@Entity('announcements')
export class Announcement {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'enum', enum: AnnouncementType, default: AnnouncementType.INFO })
    type: AnnouncementType;

    @Column({ type: 'enum', enum: AnnouncementPriority, default: AnnouncementPriority.NORMAL })
    priority: AnnouncementPriority;

    @Column({ default: true })
    is_active: boolean;

    @Column({ default: false })
    is_pinned: boolean;

    // Target theo department (null = tất cả)
    @Column({ type: 'simple-array', nullable: true })
    target_departments: string[];

    @Index()
    @Column({ type: 'timestamp', nullable: true })
    start_date: Date;

    @Column({ type: 'timestamp', nullable: true })
    end_date: Date;

    // Người tạo
    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'created_by' })
    creator: User;

    @Column({ nullable: true })
    created_by: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
