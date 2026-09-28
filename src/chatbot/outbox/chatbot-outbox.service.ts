import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { ChatbotOutbox } from '../entities/chatbot-outbox.entity';
import { ChatbotConfigService } from '../config/chatbot-config.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../common/services/email.service';
import { User } from '../../users/entities/user.entity';

const BACKOFF_MINS = [1, 2, 5, 10, 30, 60, 120, 240];

@Injectable()
export class ChatbotOutboxService {
  private readonly logger = new Logger(ChatbotOutboxService.name);

  constructor(
    @InjectRepository(ChatbotOutbox)
    private readonly outboxRepo: Repository<ChatbotOutbox>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ChatbotConfigService,
    private readonly notificationsService: NotificationsService,
    private readonly emailService: EmailService,
    private readonly dataSource: DataSource,
  ) {}

  @Cron('*/1 * * * *')
  async handleCron() {
    try {
      await this.run();
    } catch (err: any) {
      this.logger.error(`Outbox cron failed: ${err?.message}`);
    }
  }

  async run(): Promise<{ processed: number; sent: number; failed: number }> {
    let processed = 0;
    let sent = 0;
    let failed = 0;

    const config = await this.configService.get();

    // Query up to 20 pending rows with next_attempt_at <= now()
    const rows = await this.dataSource.transaction(async (manager) => {
      return manager
        .createQueryBuilder(ChatbotOutbox, 'o')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where("o.status = 'pending'")
        .andWhere('o.next_attempt_at <= now()')
        .orderBy('o.id', 'ASC')
        .take(20)
        .getMany();
    });

    for (const row of rows) {
      processed++;
      try {
        if (row.channel === 'inapp') {
          // Resolve users to notify
          let userIds: number[] = config.notify_user_ids || [];
          if (!userIds || userIds.length === 0) {
            // Find active users with role that has CHATBOT permission
            const activeUsers = await this.userRepo.find({
              where: { is_active: true },
              select: ['id'],
              take: 5,
            });
            userIds = activeUsers.map((u) => u.id);
          }

          const isRequest = row.event.startsWith('request');
          const link = isRequest
            ? `/chatbot/requests/${row.ref_id}`
            : `/chatbot/inbox/${row.ref_id}`;

          const title = `[${config.short_name}] ${
            row.event === 'human.requested'
              ? 'Khách hàng yêu cầu hỗ trợ'
              : `Yêu cầu mới ${row.payload?.code || ''}`
          }`;

          const message = row.payload?.summary || 'Có yêu cầu mới từ khách hàng website';

          for (const uId of userIds) {
            await this.notificationsService.create({
              user_id: uId,
              title,
              message,
              link,
              type: 'INFO',
            });
          }

          row.status = 'sent';
          sent++;
          await this.outboxRepo.save(row);
        } else if (row.channel === 'email') {
          const emails = row.payload?.emails || config.notify_emails || [];
          if (!emails || emails.length === 0) {
            row.status = 'sent';
            sent++;
            await this.outboxRepo.save(row);
            continue;
          }

          const code = row.payload?.code || row.ref_id || '';
          const type = row.payload?.type || 'quote';
          const summary = row.payload?.summary || '';
          const erpBaseUrl = process.env.ERP_PUBLIC_URL || 'https://localhost:3000';
          const reqLink = `${erpBaseUrl}/chatbot/requests/${row.ref_id}`;

          const subject = `[${config.short_name}] Yêu cầu mới ${code} — ${type} — ${summary}`;
          const html = `
            <h2>${config.short_name} — Thông báo yêu cầu mới</h2>
            <p><strong>Mã yêu cầu:</strong> ${code}</p>
            <p><strong>Loại yêu cầu:</strong> ${type}</p>
            <p><strong>Tóm tắt nhu cầu:</strong> ${summary}</p>
            <p><a href="${reqLink}" style="display:inline-block;padding:8px 16px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:4px;">Xem chi tiết trong ERP</a></p>
          `;

          let emailOk = false;
          let emailErrorMsg = '';

          try {
            // Attempt to send
            for (const email of emails) {
              const res = await this.emailService.sendMail(email, subject, html);
              if (res === true) {
                emailOk = true;
              } else {
                emailErrorMsg = 'Email transport returned false';
              }
            }
          } catch (e: any) {
            emailErrorMsg = e?.message || 'SMTP Connection Error';
          }

          if (emailOk) {
            row.status = 'sent';
            sent++;
            await this.outboxRepo.save(row);
          } else {
            // Failure and retry backoff
            row.attempts += 1;
            const backoffIndex = Math.min(row.attempts - 1, BACKOFF_MINS.length - 1);
            const delayMin = BACKOFF_MINS[backoffIndex];
            row.next_attempt_at = new Date(Date.now() + delayMin * 60 * 1000);

            // Strip out any email addresses or @ symbols from last_error
            const cleanErr = (emailErrorMsg || 'Email delivery failed')
              .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
              .replace(/@/g, '_at_')
              .slice(0, 300);

            row.last_error = cleanErr;
            if (row.attempts >= 8) {
              row.status = 'failed';
              failed++;
            } else {
              row.status = 'pending';
            }

            await this.outboxRepo.save(row);
          }
        }
      } catch (err: any) {
        this.logger.error(`Error processing outbox row ${row.id}: ${err?.message}`);
        row.attempts += 1;
        const cleanErr = (err?.message || 'Processing error')
          .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]')
          .replace(/@/g, '_at_')
          .slice(0, 300);
        row.last_error = cleanErr;
        await this.outboxRepo.save(row);
      }
    }

    return { processed, sent, failed };
  }
}
