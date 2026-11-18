import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { ChatbotSession } from '../entities/chatbot-session.entity';
import { ChatbotConversation } from '../entities/chatbot-conversation.entity';
import { ChatbotConfigService } from '../config/chatbot-config.service';
import { ChatRateLimiter } from '../security/chat-rate-limiter';
import { hashIp, hashToken } from '../security/pii';

const PUBLIC_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePublicCode(length = 8): string {
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += PUBLIC_CODE_ALPHABET[bytes[i] % PUBLIC_CODE_ALPHABET.length];
  }
  return code;
}

@Injectable()
export class ChatSessionService {
  constructor(
    @InjectRepository(ChatbotSession)
    private readonly sessionRepo: Repository<ChatbotSession>,
    @InjectRepository(ChatbotConversation)
    private readonly conversationRepo: Repository<ChatbotConversation>,
    private readonly configService: ChatbotConfigService,
    private readonly rateLimiter: ChatRateLimiter,
    private readonly dataSource: DataSource,
  ) {}

  async createSession(
    ip: string,
    userAgent: string,
    analyticsSessionId?: string,
  ): Promise<{
    session_token: string;
    conversation: { public_code: string; state: string };
  }> {
    const config = await this.configService.get();
    if (!config.enabled) {
      throw new HttpException({ code: 'CHATBOT_DISABLED' }, HttpStatus.SERVICE_UNAVAILABLE);
    }

    const ipHash = hashIp(ip);
    this.rateLimiter.consume(
      'session:create',
      ipHash,
      config.limits.session_per_ip_hour,
      60 * 60 * 1000,
    );

    // Generate token
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashToken(token);

    // Sanitize analytics_session_id
    let safeAnalyticsId: string | null = null;
    if (analyticsSessionId && typeof analyticsSessionId === 'string') {
      const trimmed = analyticsSessionId.slice(0, 64);
      if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
        safeAnalyticsId = trimmed;
      }
    }

    const safeUserAgent = (userAgent || '').slice(0, 300);

    return await this.dataSource.transaction(async (manager) => {
      // Generate unique public_code
      let publicCode = '';
      let attempts = 0;
      while (attempts < 10) {
        publicCode = generatePublicCode(8);
        const existing = await manager.findOne(ChatbotConversation, {
          where: { public_code: publicCode },
        });
        if (!existing) break;
        attempts++;
      }

      const conversation = manager.create(ChatbotConversation, {
        public_code: publicCode,
        state: 'new',
        unread_staff: 0,
      });
      const savedConv = await manager.save(ChatbotConversation, conversation);

      const session = manager.create(ChatbotSession, {
        token_hash: tokenHash,
        conversation_id: savedConv.id,
        ip_hash: ipHash,
        user_agent: safeUserAgent,
        analytics_session_id: safeAnalyticsId,
        last_seen_at: new Date(),
      });
      await manager.save(ChatbotSession, session);

      return {
        session_token: token,
        conversation: {
          public_code: savedConv.public_code,
          state: savedConv.state,
        },
      };
    });
  }

  async validateSession(token: string): Promise<ChatbotSession | null> {
    if (!token || typeof token !== 'string') return null;

    const tokenHash = hashToken(token);
    const session = await this.sessionRepo.findOne({
      where: { token_hash: tokenHash },
      relations: ['conversation'],
    });

    if (!session || session.revoked_at !== null) {
      return null;
    }

    // Check last_seen_at within 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const lastSeenTime = new Date(session.last_seen_at).getTime();

    if (now - lastSeenTime > THIRTY_DAYS_MS) {
      return null;
    }

    // Throttled update of last_seen_at: max once per minute
    if (now - lastSeenTime > 60 * 1000) {
      session.last_seen_at = new Date();
      await this.sessionRepo.update(session.id, { last_seen_at: session.last_seen_at });
    }

    return session;
  }
}
