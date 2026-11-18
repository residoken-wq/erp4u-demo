import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ai_messages')
export class AiMessage {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ length: 255 })
    user_id: string;

    @Column({ length: 50 })
    role: string; // 'user' or 'model' (or 'system')

    @Column('text')
    content: string;

    @CreateDateColumn()
    created_at: Date;
}
