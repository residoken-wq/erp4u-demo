import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/permissions.guard';
import { RequirePermission, Perm } from '../../auth/permissions.decorator';
import { ChatbotConversation } from '../entities/chatbot-conversation.entity';
import { ChatbotMessage } from '../entities/chatbot-message.entity';
import { ChatbotBrief } from '../entities/chatbot-brief.entity';
import { ChatbotRequest } from '../entities/chatbot-request.entity';
import { ChatbotOutbox } from '../entities/chatbot-outbox.entity';
import { ChatbotAuditEvent } from '../entities/chatbot-audit-event.entity';
import { Customer } from '../../customers/customer.entity';
import { ChatbotOutboxService } from '../outbox/chatbot-outbox.service';

const STATUS_PROGRESSION = ['received', 'assigned', 'contacted', 'quoted', 'closed'];

@Controller('chatbot/admin/inbox')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotInboxController {
  constructor(
    @InjectRepository(ChatbotConversation)
    private readonly convRepo: Repository<ChatbotConversation>,
    @InjectRepository(ChatbotMessage)
    private readonly messageRepo: Repository<ChatbotMessage>,
    @InjectRepository(ChatbotBrief)
    private readonly briefRepo: Repository<ChatbotBrief>,
    @InjectRepository(ChatbotRequest)
    private readonly requestRepo: Repository<ChatbotRequest>,
    @InjectRepository(ChatbotOutbox)
    private readonly outboxRepo: Repository<ChatbotOutbox>,
    @InjectRepository(ChatbotAuditEvent)
    private readonly auditRepo: Repository<ChatbotAuditEvent>,
    @InjectRepository(Customer)
    private readonly customerRepo: Repository<Customer>,
    private readonly outboxService: ChatbotOutboxService,
    private readonly dataSource: DataSource,
  ) {}

  // CB-210: GET /conversations?state=&unassigned=&human_active=&q=&page=&limit=
  @RequirePermission('CHATBOT', 'can_view')
  @Perm('CHATBOT', 'view')
  @Get('conversations')
  async listConversations(
    @Query('state') state?: string,
    @Query('unassigned') unassigned?: string,
    @Query('human_active') humanActive?: string,
    @Query('q') q?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(parseInt(pageStr || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const qb = this.convRepo.createQueryBuilder('c');

    if (state) {
      qb.andWhere('c.state = :state', { state });
    }
    if (unassigned === 'true' || unassigned === '1') {
      qb.andWhere('c.assigned_user_id IS NULL');
    }
    if (humanActive !== undefined && humanActive !== '') {
      qb.andWhere('c.human_active = :ha', { ha: humanActive === 'true' || humanActive === '1' });
    }

    if (q) {
      const qTrim = q.trim();
      qb.andWhere(
        '(c.public_code ILIKE :q OR c.id IN (SELECT r.conversation_id FROM chatbot_requests r WHERE r.code ILIKE :q))',
        { q: `%${qTrim}%` },
      );
    }

    qb.orderBy('c.last_message_at', 'DESC', 'NULLS LAST');
    qb.skip(skip).take(limit);

    const [convs, total] = await qb.getManyAndCount();

    // Fetch request codes for these conversations
    const convIds = convs.map((c) => c.id);
    let requestCodesMap: Record<string, string[]> = {};
    if (convIds.length > 0) {
      const reqRows = await this.requestRepo.find({
        where: { conversation_id: In(convIds) },
        select: ['conversation_id', 'code'],
      });
      for (const r of reqRows) {
        if (!requestCodesMap[r.conversation_id]) {
          requestCodesMap[r.conversation_id] = [];
        }
        requestCodesMap[r.conversation_id].push(r.code);
      }
    }

    const items = convs.map((c) => ({
      id: c.id,
      public_code: c.public_code,
      state: c.state,
      intent: c.intent,
      segment: c.segment,
      human_active: c.human_active,
      assigned_user_id: c.assigned_user_id,
      unread_staff: c.unread_staff,
      last_message_at: c.last_message_at,
      request_codes: requestCodesMap[c.id] || [],
    }));

    return { items, total };
  }

  // CB-211: GET /conversations/:id
  @RequirePermission('CHATBOT', 'can_view')
  @Perm('CHATBOT', 'view')
  @Get('conversations/:id')
  async getConversationDetail(@Param('id') id: string, @Req() req: any) {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const messages = await this.messageRepo.find({
      where: { conversation_id: id },
      order: { created_at: 'ASC' },
    });

    const briefs = await this.briefRepo.find({
      where: { conversation_id: id },
      order: { revision: 'ASC' },
    });

    const requests = await this.requestRepo.find({
      where: { conversation_id: id },
      order: { created_at: 'ASC' },
    });

    // Record audit: view_contact
    const userId = req.user?.id || req.user?.userId;
    const audit = this.auditRepo.create({
      actor_type: 'user',
      actor_user_id: userId,
      op: 'view_contact',
      object_type: 'conversation',
      object_id: id,
    });
    await this.auditRepo.save(audit);

    return {
      conversation: conv,
      messages,
      briefs,
      requests,
    };
  }

  // CB-212: POST /conversations/:id/take
  @RequirePermission('CHATBOT', 'can_update')
  @Perm('CHATBOT', 'update')
  @Post('conversations/:id/take')
  async takeConversation(@Param('id') id: string, @Req() req: any) {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const userId = req.user?.id || req.user?.userId;

    conv.human_active = true;
    conv.assigned_user_id = userId;
    conv.unread_staff = 0;
    conv.last_message_at = new Date();
    await this.convRepo.save(conv);

    const sysMsg = this.messageRepo.create({
      conversation_id: id,
      role: 'system',
      text: 'Nhân viên ERP4U đang hỗ trợ anh/chị',
    });
    await this.messageRepo.save(sysMsg);

    const audit = this.auditRepo.create({
      actor_type: 'user',
      actor_user_id: userId,
      op: 'conversation.take',
      object_type: 'conversation',
      object_id: id,
    });
    await this.auditRepo.save(audit);

    return { ok: true, conversation: conv };
  }

  // CB-213: POST /conversations/:id/release
  @RequirePermission('CHATBOT', 'can_update')
  @Perm('CHATBOT', 'update')
  @Post('conversations/:id/release')
  async releaseConversation(@Param('id') id: string, @Req() req: any) {
    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    const userId = req.user?.id || req.user?.userId;

    conv.human_active = false;
    conv.last_message_at = new Date();
    await this.convRepo.save(conv);

    const sysMsg = this.messageRepo.create({
      conversation_id: id,
      role: 'system',
      text: 'Cuộc trò chuyện đã được chuyển lại cho Trợ lý AI',
    });
    await this.messageRepo.save(sysMsg);

    const audit = this.auditRepo.create({
      actor_type: 'user',
      actor_user_id: userId,
      op: 'conversation.release',
      object_type: 'conversation',
      object_id: id,
    });
    await this.auditRepo.save(audit);

    return { ok: true, conversation: conv };
  }

  // CB-214: POST /conversations/:id/messages
  @RequirePermission('CHATBOT', 'can_update')
  @Perm('CHATBOT', 'update')
  @Post('conversations/:id/messages')
  async sendStaffMessage(
    @Param('id') id: string,
    @Body() body: { text: string },
    @Req() req: any,
  ) {
    if (!body?.text || !body.text.trim()) {
      throw new BadRequestException('Message text cannot be empty');
    }

    const conv = await this.convRepo.findOne({ where: { id } });
    if (!conv) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }

    if (!conv.human_active) {
      throw new HttpException(
        { code: 'NOT_TAKEN', message: 'Conversation must be taken before staff can send messages' },
        HttpStatus.CONFLICT,
      );
    }

    const userId = req.user?.id || req.user?.userId;

    const msg = this.messageRepo.create({
      conversation_id: id,
      role: 'staff',
      text: body.text,
      sender_user_id: userId,
    });
    await this.messageRepo.save(msg);

    conv.last_message_at = new Date();
    await this.convRepo.save(conv);

    const audit = this.auditRepo.create({
      actor_type: 'user',
      actor_user_id: userId,
      op: 'message.staff',
      object_type: 'conversation',
      object_id: id,
      after_ref: { message_id: msg.id },
    });
    await this.auditRepo.save(audit);

    return msg;
  }

  // CB-215: GET /requests?status=&owner=&q=&page=&limit=
  @RequirePermission('CHATBOT', 'can_view')
  @Perm('CHATBOT', 'view')
  @Get('requests')
  async listRequests(
    @Query('status') status?: string,
    @Query('owner') owner?: string,
    @Query('q') q?: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    const page = Math.max(parseInt(pageStr || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10), 1), 100);
    const skip = (page - 1) * limit;

    const qb = this.requestRepo.createQueryBuilder('r');

    if (status) {
      qb.andWhere('r.status = :status', { status });
    }
    if (owner) {
      qb.andWhere('r.owner_user_id = :owner', { owner: parseInt(owner, 10) });
    }
    if (q) {
      const qTrim = q.trim();
      qb.andWhere('(r.code ILIKE :q OR r.summary ILIKE :q)', { q: `%${qTrim}%` });
    }

    qb.orderBy('r.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items: items.map((r) => ({
        id: r.id,
        code: r.code,
        type: r.type,
        status: r.status,
        owner_user_id: r.owner_user_id,
        customer_id: r.customer_id,
        summary: r.summary,
        created_at: r.created_at,
      })),
      total,
    };
  }

  // CB-216: GET /requests/:id
  @RequirePermission('CHATBOT', 'can_view')
  @Perm('CHATBOT', 'view')
  @Get('requests/:id')
  async getRequestDetail(@Param('id') id: string) {
    const reqItem = await this.requestRepo.findOne({ where: { id } });
    if (!reqItem) {
      throw new NotFoundException(`Request ${id} not found`);
    }

    let customerInfo: { id: number; code: string; name: string } | null = null;
    if (reqItem.customer_id) {
      const cust = await this.customerRepo.findOne({
        where: { id: reqItem.customer_id },
        select: ['id', 'code', 'name'],
      });
      if (cust) {
        customerInfo = { id: cust.id, code: cust.code, name: cust.name };
      }
    }

    return {
      ...reqItem,
      customer: customerInfo,
      conversation_id: reqItem.conversation_id,
    };
  }

  // CB-217: PUT /requests/:id
  @RequirePermission('CHATBOT', 'can_update')
  @Perm('CHATBOT', 'update')
  @Put('requests/:id')
  async updateRequest(
    @Param('id') id: string,
    @Body()
    body: {
      status?: string;
      owner_user_id?: number;
      internal_note?: string;
      promised_due_at?: string;
    },
    @Req() req: any,
  ) {
    const reqItem = await this.requestRepo.findOne({ where: { id } });
    if (!reqItem) {
      throw new NotFoundException(`Request ${id} not found`);
    }

    // Status transition validation
    if (body.status && body.status !== reqItem.status) {
      const currentStatus = reqItem.status;
      const targetStatus = body.status;

      if (targetStatus === 'cancelled') {
        // Cancelled is allowed from any status
        reqItem.status = 'cancelled';
      } else {
        const curIdx = STATUS_PROGRESSION.indexOf(currentStatus);
        const tgtIdx = STATUS_PROGRESSION.indexOf(targetStatus);

        if (curIdx === -1 || tgtIdx === -1 || tgtIdx <= curIdx) {
          throw new HttpException(
            {
              code: 'INVALID_TRANSITION',
              message: `Cannot transition request from ${currentStatus} to ${targetStatus}`,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        reqItem.status = targetStatus;
      }
    }

    if (body.owner_user_id !== undefined) {
      reqItem.owner_user_id = body.owner_user_id;
    }
    if (body.internal_note !== undefined) {
      reqItem.internal_note = body.internal_note;
    }
    if (body.promised_due_at !== undefined) {
      reqItem.promised_due_at = body.promised_due_at;
    }

    await this.requestRepo.save(reqItem);

    const userId = req.user?.id || req.user?.userId;
    const audit = this.auditRepo.create({
      actor_type: 'user',
      actor_user_id: userId,
      op: 'request.update',
      object_type: 'request',
      object_id: id,
      after_ref: { status: reqItem.status, owner_user_id: reqItem.owner_user_id },
    });
    await this.auditRepo.save(audit);

    return reqItem;
  }

  // CB-218: GET /outbox?status=
  @RequirePermission('CHATBOT', 'can_view')
  @Perm('CHATBOT', 'view')
  @Get('outbox')
  async listOutbox(@Query('status') status?: string) {
    const where: any = {};
    if (status) {
      where.status = status;
    }

    const items = await this.outboxRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: 100,
    });

    const failedCount = await this.outboxRepo.count({
      where: { status: 'failed' },
    });

    return {
      items: items.map((o) => ({
        id: o.id,
        event: o.event,
        channel: o.channel,
        status: o.status,
        attempts: o.attempts,
        last_error: o.last_error,
        created_at: o.created_at,
      })),
      failed_count: failedCount,
    };
  }

  // CB-219: POST /outbox/run
  @RequirePermission('CHATBOT', 'can_update')
  @Perm('CHATBOT', 'update')
  @Post('outbox/run')
  async runOutbox() {
    return this.outboxService.run();
  }
}
