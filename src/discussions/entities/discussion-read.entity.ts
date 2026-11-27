import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { Discussion } from './discussion.entity';
import { User } from '../../users/entities/user.entity';

@Entity('discussion_reads')
@Unique(['discussion_id', 'user_id'])
export class DiscussionRead {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => Discussion, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'discussion_id' })
    discussion: Discussion;

    @Index()
    @Column()
    discussion_id: number;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Index()
    @Column()
    user_id: number;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    last_read_at: Date;
}
