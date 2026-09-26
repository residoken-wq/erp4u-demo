export * from './chatbot-conversation.entity';
export * from './chatbot-session.entity';
export * from './chatbot-message.entity';
export * from './chatbot-brief.entity';
export * from './chatbot-consent.entity';
export * from './chatbot-attachment.entity';
export * from './chatbot-request.entity';
export * from './chatbot-ticket.entity';
export * from './chatbot-outbox.entity';
export * from './chatbot-audit-event.entity';

import { ChatbotConversation } from './chatbot-conversation.entity';
import { ChatbotSession } from './chatbot-session.entity';
import { ChatbotMessage } from './chatbot-message.entity';
import { ChatbotBrief } from './chatbot-brief.entity';
import { ChatbotConsent } from './chatbot-consent.entity';
import { ChatbotAttachment } from './chatbot-attachment.entity';
import { ChatbotRequest } from './chatbot-request.entity';
import { ChatbotTicket } from './chatbot-ticket.entity';
import { ChatbotOutbox } from './chatbot-outbox.entity';
import { ChatbotAuditEvent } from './chatbot-audit-event.entity';

export const CHATBOT_ENTITIES = [
  ChatbotConversation,
  ChatbotSession,
  ChatbotMessage,
  ChatbotBrief,
  ChatbotConsent,
  ChatbotAttachment,
  ChatbotRequest,
  ChatbotTicket,
  ChatbotOutbox,
  ChatbotAuditEvent,
];
