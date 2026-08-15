import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ai_feedbacks')
export class AiFeedback {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 255 })
    user_id: string;

    @Column({ length: 255, nullable: true })
    message_id: string;

    @Column({ length: 50 })
    rating: 'GOOD' | 'BAD';

    @Column('text', { nullable: true })
    user_correction: string;

    @Column('text')
    original_question: string;

    @Column('text')
    original_answer: string;

    @Column({ length: 100, nullable: true })
    tool_used: string;

    @Column({ default: false })
    resolved: boolean;

    @CreateDateColumn()
    created_at: Date;
}
