import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ChatSessionService } from './chat-session.service';
import { ChatbotConfigService } from '../config/chatbot-config.service';

@Injectable()
export class ChatSessionGuard implements CanActivate {
  constructor(
    private readonly chatSessionService: ChatSessionService,
    private readonly configService: ChatbotConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = await this.configService.get();
    if (!config.enabled) {
      throw new HttpException({ code: 'CHATBOT_DISABLED' }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const req = context.switchToHttp().getRequest();
    const tokenHeader =
      req.headers['x-chat-session'] || req.headers['X-Chat-Session'] || req.headers['X-CHAT-SESSION'];

    if (!tokenHeader || typeof tokenHeader !== 'string') {
      throw new HttpException({ code: 'CHAT_SESSION_INVALID' }, HttpStatus.UNAUTHORIZED);
    }

    const session = await this.chatSessionService.validateSession(tokenHeader);
    if (!session) {
      throw new HttpException({ code: 'CHAT_SESSION_INVALID' }, HttpStatus.UNAUTHORIZED);
    }

    req.chatSession = {
      sessionId: session.id,
      conversationId: session.conversation_id,
      publicCode: session.conversation?.public_code,
    };
    req.sessionToken = tokenHeader;

    return true;
  }
}
