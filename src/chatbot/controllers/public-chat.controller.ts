import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Ip,
  Headers,
} from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { ChatSessionGuard } from '../session/chat-session.guard';
import { ChatSessionService } from '../session/chat-session.service';
import { ChatbotConfigService } from '../config/chatbot-config.service';
import { ChatRateLimiter } from '../security/chat-rate-limiter';
import { hashIp } from '../security/pii';

@Controller('public/chat')
export class PublicChatController {
  constructor(
    private readonly configService: ChatbotConfigService,
    private readonly sessionService: ChatSessionService,
    private readonly rateLimiter: ChatRateLimiter,
  ) {}

  @Public()
  @Get('config')
  async getConfig() {
    return this.configService.publicView();
  }

  @Public()
  @Post('sessions')
  async createSession(
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
    @Body() body: { analytics_session_id?: string },
  ) {
    const rawIp = ip || '127.0.0.1';
    return this.sessionService.createSession(
      rawIp,
      userAgent || '',
      body?.analytics_session_id,
    );
  }

  @Public()
  @UseGuards(ChatSessionGuard)
  @Get('ping')
  async ping(@Req() req: any, @Ip() ip: string) {
    const config = await this.configService.get();
    const sessionId = req.chatSession.sessionId;
    const ipHash = hashIp(ip || '127.0.0.1');

    // Rate limit bucket 'msg': both by session and by IP hash (5 minutes window)
    const FIVE_MIN_MS = 5 * 60 * 1000;
    this.rateLimiter.consume(
      'msg:session',
      sessionId,
      config.limits.msg_per_session_5m,
      FIVE_MIN_MS,
    );
    this.rateLimiter.consume(
      'msg:ip',
      ipHash,
      config.limits.msg_per_ip_5m,
      FIVE_MIN_MS,
    );

    return {
      ok: true,
      public_code: req.chatSession.publicCode,
    };
  }
}
