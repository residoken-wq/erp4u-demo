import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum QuestionType {
    RATING = 'RATING',
    TEXT = 'TEXT',
}

@Entity('review_questions')
export class ReviewQuestion {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'text' })
    content: string;

    @Column()
    category: string;

    @Column({ type: 'enum', enum: QuestionType, default: QuestionType.RATING })
    type: QuestionType;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
