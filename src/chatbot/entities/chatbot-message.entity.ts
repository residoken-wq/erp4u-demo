import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { ChatbotConversation } from './chatbot-conversation.entity';

@Entity('chatbot_messages')
@Index('idx_chatbot_messages_conv_created', ['conversation_id', 'created_at'])
@Unique('uq_chatbot_messages_conv_client_msg', ['conversation_id', 'client_msg_id'])
export class ChatbotMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  conversation_id: string;

  @ManyToOne(() => ChatbotConversation, (conv) => conv.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation?: ChatbotConversation;

  @Column({ type: 'varchar', length: 12 })
  role: string; // 'customer' | 'ai' | 'staff' | 'system'

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: any;

  @Column({ type: 'jsonb', nullable: true })
  source_refs: any;

  @Column({ type: 'jsonb', nullable: true })
  llm_meta: any;

  @Column({ type: 'uuid', nullable: true })
  client_msg_id: string | null;

  @Column({ type: 'int', nullable: true })
  sender_user_id: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
