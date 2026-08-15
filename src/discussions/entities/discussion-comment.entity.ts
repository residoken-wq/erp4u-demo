import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Discussion } from './discussion.entity';

@Entity('discussion_comments')
export class DiscussionComment {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text' })
    content: string;

    @ManyToOne(() => Discussion, (discussion) => discussion.comments, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'discussion_id' })
    discussion: Discussion;

    @Column()
    discussion_id: number;

    @ManyToOne(() => User)
    @JoinColumn({ name: 'user_id' })
    user: User;

    @Column()
    user_id: number;

    @CreateDateColumn() created_at: Date;
}
