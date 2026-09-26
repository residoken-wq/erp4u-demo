import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotAuditEvent } from '../entities/chatbot-audit-event.entity';

export interface AuditEventParams {
  actor_type: 'user' | 'customer' | 'system';
  actor_user_id?: number | null;
  op: string;
  object_type: string;
  object_id: string;
  before_ref?: any;
  after_ref?: any;
}

@Injectable()
export class ChatbotAuditService {
  constructor(
    @InjectRepository(ChatbotAuditEvent)
    private readonly auditRepo: Repository<ChatbotAuditEvent>,
  ) {}

  async logEvent(params: AuditEventParams): Promise<ChatbotAuditEvent> {
    const event = this.auditRepo.create({
      actor_type: params.actor_type,
      actor_user_id: params.actor_user_id || null,
      op: params.op,
      object_type: params.object_type,
      object_id: params.object_id,
      before_ref: params.before_ref || null,
      after_ref: params.after_ref || null,
    });
    return await this.auditRepo.save(event);
  }
}
