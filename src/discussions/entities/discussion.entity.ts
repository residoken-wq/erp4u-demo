import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { UserGroup } from '../../users/entities/user-group.entity';
import { DiscussionComment } from './discussion-comment.entity';

@Entity('discussions')
export class Discussion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column({ type: 'text' })
    content: string; // HTML allowed

    @ManyToOne(() => UserGroup, { nullable: true })
    @JoinColumn({ name: 'group_id' })
    group: UserGroup;

    @Column({ nullable: true })
    group_id: number; // If null, it's a public discussion or general

    @ManyToOne(() => User)
    @JoinColumn({ name: 'creator_id' })
    creator: User;

    @Column()
    creator_id: number;

    @Column({ default: 0 })
    views_count: number;

    @Column({ default: false })
    is_reviewed: boolean;

    @Column({ default: false })
    is_pinned: boolean;

    @Column({ default: 'GENERAL' })
    type: string; // 'GENERAL' or 'ANNOUNCEMENT'

    @OneToMany(() => DiscussionComment, (comment) => comment.discussion)
    comments: DiscussionComment[];

    @Column({ default: true })
    is_active: boolean;

    @CreateDateColumn() created_at: Date;
    @UpdateDateColumn() updated_at: Date;
}
