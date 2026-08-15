import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ai_learned_examples')
export class AiLearnedExample {
    @PrimaryGeneratedColumn()
    id: number;

    @Column('text')
    question_pattern: string;

    @Column({ length: 100 })
    expected_tool: string;

    @Column('json')
    expected_args: any;

    @Column('text', { nullable: true })
    example_answer: string;

    @Column({ length: 50, default: 'FEEDBACK' })
    source: 'FEEDBACK' | 'MANUAL';

    @Column({ default: 0 })
    usage_count: number;

    @Column('decimal', { precision: 3, scale: 2, default: 1.0 })
    effectiveness_score: number;

    @CreateDateColumn()
    created_at: Date;
}
