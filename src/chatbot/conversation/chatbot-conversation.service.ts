import {
  Injectable,
  Logger,
  BadRequestException,
  HttpException,
  HttpStatus,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import { randomUUID } from 'crypto';
import { ChatbotConversation } from '../entities/chatbot-conversation.entity';
import { ChatbotMessage } from '../entities/chatbot-message.entity';
import { ChatbotBrief } from '../entities/chatbot-brief.entity';
import { ChatbotRequest } from '../entities/chatbot-request.entity';
import { ChatbotConsent } from '../entities/chatbot-consent.entity';
import { ChatbotOutbox } from '../entities/chatbot-outbox.entity';
import { ChatbotAuditEvent } from '../entities/chatbot-audit-event.entity';
import { Customer, CustomerType } from '../../customers/customer.entity';
import { ChatbotConfigService } from '../config/chatbot-config.service';
import { ScriptedResponderService } from './scripted-responder.service';
import { TurnOrchestratorService } from './turn-orchestrator.service';
import { ChatSessionService } from '../session/chat-session.service';
import { ChatRateLimiter } from '../security/chat-rate-limiter';
import { ChatbotFlowService } from '../flow/chatbot-flow.service';
import { ChatbotFlowState } from '../entities/chatbot-flow.entity';

const ALLOWED_BRIEF_KEYS = [
  'segment',
  'items',
  'quantity',
  'colors',
  'fabric',
  'dimensions',
  'logo',
  'surface',
  'care',
  'storage',
  'budget',
  'region',
  'need_by',
  'school_name',
  'notes',
];

@Injectable()
export class ChatbotConversationService {
  private readonly logger = new Logger(ChatbotConversationService.name);

  constructor(
    @InjectRepository(ChatbotConversation)
    private readonly convRepo: Repository<ChatbotConversation>,
    @InjectRepository(ChatbotMessage)
    private readonly messageRepo: Repository<ChatbotMessage>,
    @InjectRepository(ChatbotBrief)
    private readonly briefRepo: Repository<ChatbotBrief>,
    @InjectRepository(ChatbotRequest)
    private readonly requestRepo: Repository<ChatbotRequest>,
    @InjectRepository(ChatbotConsent)
    private readonly consentRepo: Repository<ChatbotConsent>,
    @InjectRepository(ChatbotOutbox)
    private readonly outboxRepo: Repository<ChatbotOutbox>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly configService: ChatbotConfigService,
    private readonly responderService: ScriptedResponderService,
    private readonly turnOrchestrator: TurnOrchestratorService,
    private readonly sessionService: ChatSessionService,
    private readonly rateLimiter: ChatRateLimiter,
    private readonly dataSource: DataSource,
    private readonly flowService: ChatbotFlowService,
  ) {}

  private async getConvByToken(sessionToken: string): Promise<ChatbotConversation> {
    const session = await this.sessionService.validateSession(sessionToken);
    if (!session || !session.conversation) {
      throw new HttpException({ code: 'CHAT_SESSION_INVALID' }, HttpStatus.UNAUTHORIZED);
    }
    return session.conversation;
  }

  async getConversation(sessionToken: string, afterMessageId?: string) {
    const conv = await this.getConvByToken(sessionToken);
    const config = await this.configService.get();

    // Query messages
    const qb = this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversation_id = :convId', { convId: conv.id })
      .orderBy('m.created_at', 'ASC');

    if (afterMessageId) {
      const afterMsg = await this.messageRepo.findOne({ where: { id: afterMessageId } });
      if (afterMsg) {
        qb.andWhere('m.created_at > :afterDate', { afterDate: afterMsg.created_at });
      }
    }

    const messages = await qb.getMany();

    // Map messages without leaking staff user ids
    const mappedMessages = messages.map((m) => {
      let sender_label = '';
      if (m.role === 'ai') sender_label = config.short_name;
      else if (m.role === 'staff') sender_label = 'Nhân viên ERP4U';
      else if (m.role === 'customer') sender_label = 'Khách hàng';
      else sender_label = 'Hệ thống';

      return {
        id: m.id,
        role: m.role,
        text: m.text,
        payload: m.payload || null,
        created_at: m.created_at,
        sender_label,
      };
    });

    // Query latest brief
    const latestBrief = await this.briefRepo.findOne({
      where: { conversation_id: conv.id },
      order: { revision: 'DESC' },
    });

    const brief = latestBrief
      ? { revision: latestBrief.revision, data: latestBrief.data }
      : null;

    // Query requests (no leaks of contact, customer_id, owner_user_id, internal_note)
    const requests = await this.requestRepo.find({
      where: { conversation_id: conv.id },
      order: { created_at: 'ASC' },
      select: ['code', 'type', 'status'],
    });

    const poll_ms = conv.human_active || conv.state === 'waiting_sales' ? 4000 : 15000;

    return {
      conversation: {
        public_code: conv.public_code,
        state: conv.state,
        intent: conv.intent,
        segment: conv.segment,
        human_active: conv.human_active,
      },
      messages: mappedMessages,
      brief,
      requests: requests.map((r) => ({ code: r.code, type: r.type, status: r.status })),
      poll_ms,
    };
  }

  async postMessage(sessionToken: string, clientMsgId: string, rawText: string) {
    if (!rawText || !rawText.trim()) {
      throw new BadRequestException('Message text cannot be empty');
    }

    const config = await this.configService.get();
    if (rawText.length > config.limits.max_message_chars) {
      throw new HttpException(
        { code: 'MESSAGE_TOO_LONG', message: `Message exceeds ${config.limits.max_message_chars} characters` },
        HttpStatus.BAD_REQUEST,
      );
    }

    const conv = await this.getConvByToken(sessionToken);

    // 1. Idempotency check: same (conversation_id, client_msg_id)
    if (clientMsgId) {
      const existing = await this.messageRepo.findOne({
        where: { conversation_id: conv.id, client_msg_id: clientMsgId },
      });
      if (existing) {
        // Query replies that were sent in response to this message
        const nextReplies = await this.messageRepo.find({
          where: {
            conversation_id: conv.id,
            created_at: MoreThan(existing.created_at),
          },
          order: { created_at: 'ASC' },
          take: 2,
        });

        const replies = nextReplies.filter((m) => m.role === 'ai' || m.role === 'system');

        return {
          message: this.formatMsg(existing, config),
          replies: replies.map((r) => this.formatMsg(r, config)),
          conversation: {
            state: conv.state,
            human_active: conv.human_active,
          },
        };
      }
    }

    // 2. Delegate turn execution to TurnOrchestrator
    const result = await this.turnOrchestrator.handleTurn(conv, rawText, clientMsgId);

    return {
      message: this.formatMsg(result.customerMsg, config),
      replies: result.replies.map((r) => this.formatMsg(r, config)),
      conversation: {
        state: result.conversation.state,
        human_active: result.conversation.human_active,
      },
    };
  }

  async postAction(sessionToken: string, clientMsgId: string, action: string, value: any) {
    const conv = await this.getConvByToken(sessionToken);
    const config = await this.configService.get();

    let aiReplies: ChatbotMessage[] = [];
    let updatedConv: ChatbotConversation = conv;
    // A published conversation flow may own this start button (CMS "Sơ đồ kịch bản").
    const flowStart = action === 'start' ? await this.flowService.startByAction(String(value || ''), config) : null;

    await this.dataSource.transaction(async (manager) => {
      const currentConv = await manager.findOne(ChatbotConversation, {
        where: { id: conv.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!currentConv) return;
      updatedConv = currentConv;

      if (action === 'start') {
        const { replyText, segment, intent } = this.responderService.generateStartReply(
          String(value || ''),
          config,
        );
        currentConv.segment = segment;
        currentConv.intent = intent;
        currentConv.last_message_at = new Date();
        await manager.save(ChatbotConversation, currentConv);

        const useFlow = flowStart && !currentConv.human_active ? flowStart : null;
        const aiMsg = manager.create(ChatbotMessage, {
          conversation_id: currentConv.id,
          role: 'ai',
          text: useFlow ? useFlow.text : replyText,
          payload: useFlow ? useFlow.payload : null,
          llm_meta: useFlow
            ? { route: 'flow', model: 'flow', flow_id: useFlow.flow_id, flow_version: useFlow.flow_version, node_ids: useFlow.node_ids }
            : null,
        });
        await manager.save(ChatbotMessage, aiMsg);
        aiReplies.push(aiMsg);
        if (useFlow) {
          await this.flowService.applyState(manager, currentConv.id, useFlow);
        } else {
          await manager.delete(ChatbotFlowState, { conversation_id: currentConv.id });
        }
      } else if (action === 'human') {
        await manager.delete(ChatbotFlowState, { conversation_id: currentConv.id });
        currentConv.state = 'waiting_sales';
        currentConv.last_message_at = new Date();
        await manager.save(ChatbotConversation, currentConv);

        const outboxInapp = manager.create(ChatbotOutbox, {
          event: 'human.requested',
          channel: 'inapp',
          ref_id: currentConv.id,
          payload: { conversation_id: currentConv.id, action: 'human' },
        });
        await manager.save(ChatbotOutbox, outboxInapp);

        if (config.notify_emails && config.notify_emails.length > 0) {
          const outboxEmail = manager.create(ChatbotOutbox, {
            event: 'human.requested',
            channel: 'email',
            ref_id: currentConv.id,
            payload: { conversation_id: currentConv.id, action: 'human', emails: config.notify_emails },
          });
          await manager.save(ChatbotOutbox, outboxEmail);
        }

        const replyText = this.responderService.generateHumanReply(config);
        const aiMsg = manager.create(ChatbotMessage, {
          conversation_id: currentConv.id,
          role: 'ai',
          text: replyText,
          payload: null,
        });
        await manager.save(ChatbotMessage, aiMsg);
        aiReplies.push(aiMsg);
      } else if (action === 'set_slot') {
        if (!value || typeof value !== 'object' || !value.key) {
          throw new BadRequestException('Invalid slot value');
        }
        if (!ALLOWED_BRIEF_KEYS.includes(value.key)) {
          throw new BadRequestException(`Unknown brief field: ${value.key}`);
        }
        this.validateBriefField(value.key, value.value);

        const latestBrief = await manager.findOne(ChatbotBrief, {
          where: { conversation_id: currentConv.id },
          order: { revision: 'DESC' },
        });
        const currentRevision = latestBrief ? latestBrief.revision : 0;
        const currentData = latestBrief ? { ...latestBrief.data } : {};

        const newRevision = currentRevision + 1;
        const newData = { ...currentData, [value.key]: value.value };
        const newBrief = manager.create(ChatbotBrief, {
          conversation_id: currentConv.id,
          revision: newRevision,
          data: newData,
          changed_by: 'customer',
        });
        await manager.save(ChatbotBrief, newBrief);

        const response = this.responderService.generateResponse(
          '',
          newData,
          newRevision,
          config,
        );
        if (response.newState) {
          currentConv.state = response.newState;
          await manager.save(ChatbotConversation, currentConv);
        }

        if (response.replyText) {
          const aiMsg = manager.create(ChatbotMessage, {
            conversation_id: currentConv.id,
            role: 'ai',
            text: response.replyText,
            payload: response.payload || null,
          });
          await manager.save(ChatbotMessage, aiMsg);
          aiReplies.push(aiMsg);
        }
      }
    });

    return {
      message: null,
      replies: aiReplies.map((r) => this.formatMsg(r, config)),
      conversation: {
        state: updatedConv.state,
        human_active: updatedConv.human_active,
      },
    };
  }

  async putBrief(sessionToken: string, baseRevision: number, patch: Record<string, any>) {
    if (!patch || typeof patch !== 'object') {
      throw new BadRequestException('Patch must be an object');
    }

    // 1. Check whitelist
    for (const key of Object.keys(patch)) {
      if (!ALLOWED_BRIEF_KEYS.includes(key)) {
        throw new BadRequestException(`Unknown brief field: ${key}`);
      }
      this.validateBriefField(key, patch[key]);
    }

    const conv = await this.getConvByToken(sessionToken);

    // 2. Check base_revision matches current revision
    const latestBrief = await this.briefRepo.findOne({
      where: { conversation_id: conv.id },
      order: { revision: 'DESC' },
    });

    const currentRevision = latestBrief ? latestBrief.revision : 0;
    const currentData = latestBrief ? { ...latestBrief.data } : {};

    if (baseRevision !== currentRevision) {
      throw new HttpException(
        {
          code: 'BRIEF_STALE',
          message: 'Brief revision is stale',
          brief: { revision: currentRevision, data: currentData },
        },
        HttpStatus.CONFLICT,
      );
    }

    // 3. Save new revision
    const newRevision = currentRevision + 1;
    const newData = { ...currentData, ...patch };

    const newBrief = this.briefRepo.create({
      conversation_id: conv.id,
      revision: newRevision,
      data: newData,
      changed_by: 'customer',
    });
    await this.briefRepo.save(newBrief);

    return {
      brief: {
        revision: newRevision,
        data: newData,
      },
    };
  }

  private validateBriefField(key: string, val: any) {
    if (val === undefined || val === null) return;
    if (key === 'segment') {
      if (!['parent', 'school', 'business', 'after_sale'].includes(val)) {
        throw new BadRequestException(`Invalid segment: ${val}`);
      }
    } else if (key === 'quantity') {
      if (typeof val !== 'number' || !Number.isInteger(val) || val < 1 || val > 100000) {
        throw new BadRequestException('Quantity must be an integer between 1 and 100,000');
      }
    } else if (key === 'items') {
      if (!Array.isArray(val) || !val.every((x) => typeof x === 'string')) {
        throw new BadRequestException('Items must be an array of strings');
      }
    } else if (key === 'need_by') {
      if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        throw new BadRequestException('need_by must be YYYY-MM-DD');
      }
    } else if (key === 'notes') {
      if (typeof val !== 'string' || val.length > 1000) {
        throw new BadRequestException('notes must be string <= 1000 chars');
      }
    }
  }

  async createRequest(sessionToken: string, body: any, sessionId?: string) {
    const { idempotency_key, type, brief_revision, contact, consent } = body || {};

    if (!idempotency_key) {
      throw new BadRequestException('idempotency_key is required');
    }

    // 1. Idempotency: return existing if found
    const existing = await this.requestRepo.findOne({
      where: { idempotency_key },
    });
    if (existing) {
      return { code: existing.code, status: 'received', isDuplicate: true };
    }

    // 2. Consent check
    if (!consent || consent.contact !== true) {
      throw new HttpException(
        { code: 'CONSENT_REQUIRED', message: 'Contact consent is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 3. Contact check
    if (!contact || typeof contact !== 'object') {
      throw new HttpException(
        { code: 'CONTACT_REQUIRED', message: 'Contact information is required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    const { phone, email, zalo, preferred_channel } = contact;
    if (!phone && !email && !zalo) {
      throw new HttpException(
        { code: 'CONTACT_REQUIRED', message: 'At least one contact channel is required' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!preferred_channel || !['phone', 'zalo', 'email'].includes(preferred_channel)) {
      throw new HttpException(
        { code: 'CONTACT_REQUIRED', message: 'preferred_channel must be phone, zalo, or email' },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!contact[preferred_channel]) {
      throw new HttpException(
        { code: 'CONTACT_REQUIRED', message: `Preferred channel ${preferred_channel} is empty` },
        HttpStatus.BAD_REQUEST,
      );
    }

    // 4. Phone validation
    let cleanPhone = '';
    if (phone) {
      cleanPhone = String(phone).replace(/\D/g, '');
      if (cleanPhone.startsWith('84')) {
        cleanPhone = '0' + cleanPhone.slice(2);
      }
      if (!/^0\d{9}$/.test(cleanPhone)) {
        throw new HttpException(
          { code: 'PHONE_INVALID', message: 'Phone must be a valid 10-digit Vietnamese number' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const conv = await this.getConvByToken(sessionToken);

    // 5. Brief revision check
    const latestBrief = await this.briefRepo.findOne({
      where: { conversation_id: conv.id },
      order: { revision: 'DESC' },
    });
    const currentRev = latestBrief ? latestBrief.revision : 0;
    if (brief_revision !== currentRev) {
      throw new HttpException(
        { code: 'BRIEF_STALE', message: 'Brief revision is stale' },
        HttpStatus.CONFLICT,
      );
    }

    // 6. Incomplete brief check
    const briefData = latestBrief ? latestBrief.data : {};
    if (type === 'quote') {
      const hasQty = typeof briefData.quantity === 'number' && briefData.quantity > 0;
      const hasItemsOrSchool = (Array.isArray(briefData.items) && briefData.items.length > 0) || briefData.segment === 'school';
      if (!hasQty || !hasItemsOrSchool) {
        throw new HttpException(
          { code: 'BRIEF_INCOMPLETE', message: 'Brief is incomplete for quote request' },
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    const config = await this.configService.get();

    // Rate limit check on submit (after validation passes, so 400s don't exhaust user tokens)
    if (sessionId) {
      const ONE_HOUR_MS = 60 * 60 * 1000;
      this.rateLimiter.consume(
        'submit:session',
        sessionId,
        config.limits.submit_per_session_hour,
        ONE_HOUR_MS,
      );
    }

    // 7. Transaction
    let requestCode = '';
    try {
      await this.dataSource.transaction(async (manager) => {
        // Generate sequence code YC-YYMMDD-XXXX in VN timezone
        const seqResult = await manager.query("SELECT nextval('chatbot_request_seq') as seq");
        const seqNum = String(seqResult[0]?.seq || 1).padStart(4, '0');
        const nowVn = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
        const yy = String(nowVn.getFullYear()).slice(-2);
        const mm = String(nowVn.getMonth() + 1).padStart(2, '0');
        const dd = String(nowVn.getDate()).padStart(2, '0');
        requestCode = `YC-${yy}${mm}${dd}-${seqNum}`;

        // Consents
        const consentRow = manager.create(ChatbotConsent, {
          conversation_id: conv.id,
          purpose: 'contact',
          channel: preferred_channel,
          notice_version: consent.notice_version || 'v1',
          granted_at: new Date(),
        });
        await manager.save(ChatbotConsent, consentRow);

        if (consent.marketing === true) {
          const marketingRow = manager.create(ChatbotConsent, {
            conversation_id: conv.id,
            purpose: 'marketing',
            channel: preferred_channel,
            notice_version: consent.notice_version || 'v1',
            granted_at: new Date(),
          });
          await manager.save(ChatbotConsent, marketingRow);
        }

        // Summary
        const summary = `${briefData.quantity || 0} bộ${briefData.items?.length ? ' ' + briefData.items.join(', ') : ''}${briefData.colors ? ' - màu ' + briefData.colors : ''}${briefData.school_name ? ' - ' + briefData.school_name : ''}`;

        // Find or create Customer (LEAD)
        let customerId: number | null = null;
        if (cleanPhone) {
          const existingCust = await manager.query(
            `SELECT id, history FROM customers WHERE regexp_replace(coalesce(phone,''),'[^0-9]','','g') IN ($1, $2) LIMIT 1`,
            [cleanPhone, '84' + cleanPhone.slice(1)],
          );

          if (existingCust && existingCust.length > 0) {
            customerId = existingCust[0].id;
            let historyList: any[] = [];
            if (Array.isArray(existingCust[0].history)) {
              historyList = [...existingCust[0].history];
            } else if (typeof existingCust[0].history === 'string') {
              try {
                const parsed = JSON.parse(existingCust[0].history);
                if (Array.isArray(parsed)) historyList = parsed;
              } catch {}
            }
            historyList.push({
              action: 'CHATBOT_REQUEST',
              timestamp: new Date().toISOString(),
              data: {
                request_code: requestCode,
                conversation_public_code: conv.public_code,
                summary,
              },
            });
            await manager.query(
              `UPDATE customers SET history = $1::jsonb WHERE id = $2`,
              [JSON.stringify(historyList), customerId],
            );
          } else {
            const leadName =
              briefData.school_name || contact.name || `Khách chat ${conv.public_code}`;
            const newHistory = [
              {
                action: 'CREATED_FROM_CHATBOT',
                timestamp: new Date().toISOString(),
                data: {
                  request_code: requestCode,
                  conversation_public_code: conv.public_code,
                  contact_person: contact.name || null,
                  summary,
                  preferred_channel,
                },
              },
            ];

            const insertResult = await manager.query(
              `INSERT INTO customers (code, name, type, lead_status, lead_source, phone, email, history, created_at, updated_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now(), now())
               RETURNING id`,
              [
                `LEAD-${requestCode}`,
                leadName,
                CustomerType.LEAD,
                'NEW',
                'CHATBOT',
                cleanPhone,
                email || null,
                JSON.stringify(newHistory),
              ],
            );
            customerId = insertResult[0]?.id;
          }
        }

        // Insert Request
        const reqRow = manager.create(ChatbotRequest, {
          code: requestCode,
          type: type || 'quote',
          conversation_id: conv.id,
          brief_revision: currentRev,
          contact,
          consent_id: consentRow.id,
          status: 'received',
          customer_id: customerId,
          idempotency_key,
          summary,
        });
        await manager.save(ChatbotRequest, reqRow);

        // Test Hook: DB failure simulation (T26)
        if (process.env.CHATBOT_TEST_HOOKS === 'true' && contact.name === '[[fail:db]]') {
          throw new Error('SIMULATED_DB_FAILURE');
        }

        // Outbox event
        const outboxInapp = manager.create(ChatbotOutbox, {
          event: 'request.created',
          channel: 'inapp',
          ref_id: reqRow.id,
          payload: {
            request_id: reqRow.id,
            code: requestCode,
            type,
            summary,
            customer_id: customerId,
          },
        });
        await manager.save(ChatbotOutbox, outboxInapp);

        if (config.notify_emails && config.notify_emails.length > 0) {
          const outboxEmail = manager.create(ChatbotOutbox, {
            event: 'request.created',
            channel: 'email',
            ref_id: reqRow.id,
            payload: {
              request_id: reqRow.id,
              code: requestCode,
              type,
              summary,
              customer_id: customerId,
              emails: config.notify_emails,
            },
          });
          await manager.save(ChatbotOutbox, outboxEmail);
        }

        // Update conversation state
        await manager.update(ChatbotConversation, conv.id, {
          state: 'submitted',
          last_message_at: new Date(),
        });

        // Add System message:
        // "Dạ em đã tiếp nhận yêu cầu {code}. Nhân viên ERP4U sẽ liên hệ qua {kênh} trong giờ làm việc."
        const channelText =
          preferred_channel === 'phone'
            ? 'số điện thoại'
            : preferred_channel === 'zalo'
            ? 'Zalo'
            : 'email';

        const sysMsg = manager.create(ChatbotMessage, {
          conversation_id: conv.id,
          role: 'system',
          text: `Dạ em đã tiếp nhận yêu cầu ${requestCode}. Nhân viên ERP4U sẽ liên hệ qua ${channelText} trong giờ làm việc.`,
        });
        await manager.save(ChatbotMessage, sysMsg);

        // Audit event
        const auditEvent = manager.create(ChatbotAuditEvent, {
          actor_type: 'customer',
          actor_user_id: null,
          op: 'request.create',
          object_type: 'request',
          object_id: reqRow.id,
          before_ref: null,
          after_ref: { code: requestCode, type },
        });
        await manager.save(ChatbotAuditEvent, auditEvent);
      });
    } catch (err: any) {
      if (err?.message === 'SIMULATED_DB_FAILURE') {
        // Update conversation state after rollback
        await this.convRepo.update(conv.id, { state: 'submission_failed' });
        throw new HttpException(
          { code: 'SUBMIT_FAILED', message: 'Simulated submission failure' },
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
      this.logger.error(`Failed to create chatbot request: ${err?.message}`);
      throw err;
    }

    return { code: requestCode, status: 'received', isDuplicate: false };
  }

  private formatMsg(m: ChatbotMessage, config: any) {
    let sender_label = '';
    if (m.role === 'ai') sender_label = config.short_name;
    else if (m.role === 'staff') sender_label = 'Nhân viên ERP4U';
    else if (m.role === 'customer') sender_label = 'Khách hàng';
    else sender_label = 'Hệ thống';

    return {
      id: m.id,
      role: m.role,
      text: m.text,
      payload: m.payload || null,
      created_at: m.created_at,
      sender_label,
    };
  }
}
