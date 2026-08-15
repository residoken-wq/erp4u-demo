import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Announcement } from './announcement.entity';
import { User } from '../users/entities/user.entity';

@Entity('announcement_reads')
@Unique(['announcement_id', 'user_id'])
export class AnnouncementRead {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Announcement, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'announcement_id' })
    announcement: Announcement;

    @Index()
    @Column()
    announcement_id: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Index()
    @Column()
    user_id: number;

    @CreateDateColumn()
    read_at: Date;
}
