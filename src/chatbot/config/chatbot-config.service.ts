import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SystemConfig } from '../../system/system-config.entity';
import { User } from '../../users/entities/user.entity';
import { ChatbotAuditEvent } from '../entities/chatbot-audit-event.entity';
import { CHATBOT_DEFAULTS, ChatbotConfigType } from '../chatbot.defaults';
import { ChatbotConfigDto } from './chatbot-config.dto';
import { isWithinWorkingHours, parseTimeToMinutes } from './working-hours';
import {
  checkAvatarUrl,
  checkDaySchedule,
  checkDisplayName,
  checkEmail,
  checkGreeting,
  checkHolidayNote,
  checkHotline,
  checkMessengerUrl,
  checkNoSecret,
  checkResponseSlaText,
  checkShortName,
  checkTimezone,
  checkZaloUrl,
} from './chatbot-config.validator';

export function renderTemplate(template: string, vars: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/{([^}]+)}/g, (_, key) => {
    const val = vars[key];
    if (val === undefined) return `{${key}}`;
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  });
}

function deepMerge(target: any, source: any): any {
  if (!source || typeof source !== 'object') return target;
  const output = Array.isArray(target) ? [...target] : { ...target };
  for (const key of Object.keys(source)) {
    const sVal = source[key];
    const tVal = target[key];
    if (sVal !== undefined) {
      if (
        sVal &&
        typeof sVal === 'object' &&
        !Array.isArray(sVal) &&
        tVal &&
        typeof tVal === 'object' &&
        !Array.isArray(tVal)
      ) {
        output[key] = deepMerge(tVal, sVal);
      } else {
        output[key] = sVal;
      }
    }
  }
  return output;
}

@Injectable()
export class ChatbotConfigService {
  private readonly logger = new Logger(ChatbotConfigService.name);
  private cachedConfig: ChatbotConfigType | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 30 * 1000;

  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepo: Repository<SystemConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  clearCache() {
    this.cachedConfig = null;
    this.cacheExpiresAt = 0;
  }

  async get(): Promise<ChatbotConfigType> {
    const now = Date.now();
    if (this.cachedConfig && now < this.cacheExpiresAt) {
      return this.cachedConfig;
    }

    let parsedConfig: any = null;
    try {
      const record = await this.systemConfigRepo.findOne({
        where: { key: 'CHATBOT_CONFIG' },
      });
      if (record && record.value) {
        try {
          parsedConfig = JSON.parse(record.value);
        } catch (e) {
          this.logger.warn('chatbot config invalid field CHATBOT_CONFIG (parse error)');
        }
      }
    } catch (e: any) {
      this.logger.error(`Error loading CHATBOT_CONFIG: ${e?.message}`);
    }

    const merged = deepMerge(CHATBOT_DEFAULTS, parsedConfig || {});

    // Validate merged fields against defaults
    const validated = this.validateAndSanitize(merged);

    this.cachedConfig = validated;
    this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    return validated;
  }

  private validateAndSanitize(raw: any): ChatbotConfigType {
    const defaults = CHATBOT_DEFAULTS;
    const result: any = { ...defaults };

    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    // Boolean fields
    result.enabled = typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled;

    // String fields with strict validation
    if (checkDisplayName(raw.display_name)) {
      result.display_name = raw.display_name;
    } else {
      if (raw.display_name !== undefined) {
        this.logger.warn('chatbot config invalid field display_name');
      }
      result.display_name = defaults.display_name;
    }

    if (checkShortName(raw.short_name)) {
      result.short_name = raw.short_name;
    } else {
      if (raw.short_name !== undefined) {
        this.logger.warn('chatbot config invalid field short_name');
      }
      result.short_name = defaults.short_name;
    }

    if (checkAvatarUrl(raw.avatar_url)) {
      result.avatar_url = raw.avatar_url;
    } else {
      if (raw.avatar_url !== undefined) {
        this.logger.warn('chatbot config invalid field avatar_url');
      }
      result.avatar_url = defaults.avatar_url;
    }

    if (checkGreeting(raw.greeting)) {
      result.greeting = raw.greeting;
    } else {
      if (raw.greeting !== undefined) {
        this.logger.warn('chatbot config invalid field greeting');
      }
      result.greeting = defaults.greeting;
    }

    // Contact channels: strictly validate URL scheme and hotline characters
    const rawContact = raw.contact_channels;
    const hotlineVal = rawContact?.hotline;
    const zaloVal = rawContact?.zalo_url;
    const emailVal = rawContact?.email_public;
    const messengerVal = rawContact?.messenger_url;

    result.contact_channels = {
      hotline: checkHotline(hotlineVal) ? (hotlineVal || '') : '',
      zalo_url: checkZaloUrl(zaloVal) ? (zaloVal || '') : '',
      email_public: checkEmail(emailVal) ? (emailVal || '') : '',
      messenger_url: checkMessengerUrl(messengerVal) ? (messengerVal || '') : '',
    };
    if (hotlineVal && !checkHotline(hotlineVal)) {
      this.logger.warn('chatbot config invalid field contact_channels.hotline');
    }
    if (zaloVal && !checkZaloUrl(zaloVal)) {
      this.logger.warn('chatbot config invalid field contact_channels.zalo_url');
    }
    if (emailVal && !checkEmail(emailVal)) {
      this.logger.warn('chatbot config invalid field contact_channels.email_public');
    }
    if (messengerVal && !checkMessengerUrl(messengerVal)) {
      this.logger.warn('chatbot config invalid field contact_channels.messenger_url');
    }

    // Working hours: validate timezone, each day schedule, holiday_note
    const rawWh = raw.working_hours;
    if (rawWh && typeof rawWh === 'object') {
      const daysList = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
      const validDays: any = {};
      for (const d of daysList) {
        const rawDay = rawWh.days?.[d];
        if (checkDaySchedule(rawDay)) {
          validDays[d] = {
            off: rawDay.off,
            ...(rawDay.from ? { from: rawDay.from } : {}),
            ...(rawDay.to ? { to: rawDay.to } : {}),
          };
        } else {
          if (rawDay !== undefined) {
            this.logger.warn(`chatbot config invalid field working_hours.days.${d}`);
          }
          validDays[d] = defaults.working_hours.days[d];
        }
      }

      result.working_hours = {
        tz: checkTimezone(rawWh.tz) ? (rawWh.tz || defaults.working_hours.tz) : defaults.working_hours.tz,
        days: validDays,
        holiday_note: checkHolidayNote(rawWh.holiday_note) ? (rawWh.holiday_note || '') : '',
      };
      if (rawWh.tz && !checkTimezone(rawWh.tz)) {
        this.logger.warn('chatbot config invalid field working_hours.tz');
      }
      if (rawWh.holiday_note && !checkHolidayNote(rawWh.holiday_note)) {
        this.logger.warn('chatbot config invalid field working_hours.holiday_note');
      }
    } else {
      if (rawWh !== undefined) {
        this.logger.warn('chatbot config invalid field working_hours');
      }
      result.working_hours = defaults.working_hours;
    }

    // Response SLA text: max 300 chars, no secrets
    if (checkResponseSlaText(raw.response_sla_text)) {
      result.response_sla_text =
        raw.response_sla_text !== undefined ? raw.response_sla_text : defaults.response_sla_text;
    } else {
      this.logger.warn('chatbot config invalid field response_sla_text');
      result.response_sla_text = defaults.response_sla_text;
    }

    // Notification lists
    if (Array.isArray(raw.notify_emails)) {
      const validEmails = raw.notify_emails
        .filter((e: any) => typeof e === 'string' && checkEmail(e) && e.length > 0 && checkNoSecret(e))
        .slice(0, 10);
      result.notify_emails = validEmails;
      if (validEmails.length !== raw.notify_emails.length) {
        this.logger.warn('chatbot config invalid field notify_emails');
      }
    } else {
      if (raw.notify_emails !== undefined) {
        this.logger.warn('chatbot config invalid field notify_emails');
      }
      result.notify_emails = defaults.notify_emails;
    }

    if (Array.isArray(raw.notify_user_ids)) {
      const validIds = raw.notify_user_ids.filter(
        (id: any) => typeof id === 'number' && Number.isInteger(id) && id > 0,
      );
      result.notify_user_ids = validIds;
      if (validIds.length !== raw.notify_user_ids.length) {
        this.logger.warn('chatbot config invalid field notify_user_ids');
      }
    } else {
      if (raw.notify_user_ids !== undefined) {
        this.logger.warn('chatbot config invalid field notify_user_ids');
      }
      result.notify_user_ids = defaults.notify_user_ids;
    }

    // Limits
    result.limits = { ...defaults.limits };
    if (raw.limits && typeof raw.limits === 'object') {
      const limitBounds: Record<string, [number, number]> = {
        session_per_ip_hour: [1, 500],
        msg_per_session_5m: [1, 200],
        msg_per_ip_5m: [1, 1000],
        submit_per_session_hour: [1, 100],
        upload_per_session_hour: [1, 100],
        llm_concurrency: [1, 50],
        unassigned_alert_min: [1, 1440],
        max_message_chars: [100, 10000],
      };
      for (const [k, [min, max]] of Object.entries(limitBounds)) {
        const val = raw.limits[k];
        if (typeof val === 'number' && Number.isInteger(val) && val >= min && val <= max) {
          result.limits[k] = val;
        } else if (val !== undefined) {
          this.logger.warn(`chatbot config invalid field limits.${k}`);
        }
      }
    }

    // Retention days
    result.retention_days = { ...defaults.retention_days };
    if (raw.retention_days && typeof raw.retention_days === 'object') {
      const retentionKeys = ['chat', 'attachment', 'request', 'ticket', 'audit'];
      for (const k of retentionKeys) {
        const val = raw.retention_days[k];
        if (typeof val === 'number' && Number.isInteger(val) && val >= 1 && val <= 3650) {
          result.retention_days[k] = val;
        } else if (val !== undefined) {
          this.logger.warn(`chatbot config invalid field retention_days.${k}`);
        }
      }
    }

    // LLM
    result.llm = { ...defaults.llm };
    if (raw.llm && typeof raw.llm === 'object') {
      if (
        typeof raw.llm.daily_call_budget === 'number' &&
        Number.isInteger(raw.llm.daily_call_budget) &&
        raw.llm.daily_call_budget >= 1 &&
        raw.llm.daily_call_budget <= 100000
      ) {
        result.llm.daily_call_budget = raw.llm.daily_call_budget;
      } else if (raw.llm.daily_call_budget !== undefined) {
        this.logger.warn('chatbot config invalid field llm.daily_call_budget');
      }
      if (
        typeof raw.llm.timeout_ms === 'number' &&
        Number.isInteger(raw.llm.timeout_ms) &&
        raw.llm.timeout_ms >= 1000 &&
        raw.llm.timeout_ms <= 120000
      ) {
        result.llm.timeout_ms = raw.llm.timeout_ms;
      } else if (raw.llm.timeout_ms !== undefined) {
        this.logger.warn('chatbot config invalid field llm.timeout_ms');
      }
    }

    // Features: forced false in P0
    result.features = {
      price_estimate: false,
      order_lookup: false,
      attachments: false,
      sample_request: false,
    };

    return result as ChatbotConfigType;
  }

  async save(dto: any, userId?: number): Promise<ChatbotConfigType> {
    // 1. Check for unknown fields or secret patterns in raw payload
    const rawKeys = Object.keys(dto || {});
    const allowedRootKeys = [
      'enabled',
      'display_name',
      'short_name',
      'avatar_url',
      'greeting',
      'contact_channels',
      'working_hours',
      'response_sla_text',
      'notify_emails',
      'notify_user_ids',
      'features',
      'limits',
      'retention_days',
      'llm',
    ];

    for (const key of rawKeys) {
      if (!allowedRootKeys.includes(key)) {
        throw new BadRequestException(`Unknown field: ${key}`);
      }
    }

    // 2. Validate using class-validator
    const instance = plainToInstance(ChatbotConfigDto, dto);
    const errors = await validate(instance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });

    if (errors.length > 0) {
      const messages = errors
        .map((e) => Object.values(e.constraints || {}).join(', '))
        .join('; ');
      throw new BadRequestException(messages || 'Validation failed');
    }

    // 3. Validate working hours: from < to for non-off days
    if (instance.working_hours?.days) {
      for (const [dayName, day] of Object.entries(instance.working_hours.days)) {
        if (!day.off && day.from && day.to) {
          const fromM = parseTimeToMinutes(day.from);
          const toM = parseTimeToMinutes(day.to);
          if (fromM >= toM) {
            throw new BadRequestException(
              `working_hours.${dayName}: 'from' (${day.from}) must be earlier than 'to' (${day.to})`,
            );
          }
        }
      }
    }

    // 4. Validate notify_user_ids exist and are active
    if (instance.notify_user_ids && instance.notify_user_ids.length > 0) {
      const users = await this.userRepo.find({
        where: { id: In(instance.notify_user_ids) },
        select: ['id', 'is_active'],
      });
      if (users.length !== instance.notify_user_ids.length) {
        throw new BadRequestException('One or more notify_user_ids do not exist');
      }
      for (const u of users) {
        if (u.is_active === false) {
          throw new BadRequestException(`User ${u.id} is not active`);
        }
      }
    }

    // 5. Force features to false in P0
    instance.features = {
      price_estimate: false,
      order_lookup: false,
      attachments: false,
      sample_request: false,
    };

    // 6. Execute save in transaction and record audit event
    const oldConfig = await this.get();

    // Determine changed field names
    const changedFields: string[] = [];
    for (const key of allowedRootKeys) {
      if (JSON.stringify((oldConfig as any)[key]) !== JSON.stringify((instance as any)[key])) {
        changedFields.push(key);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      let configRecord = await manager.findOne(SystemConfig, {
        where: { key: 'CHATBOT_CONFIG' },
      });
      if (!configRecord) {
        configRecord = manager.create(SystemConfig, {
          key: 'CHATBOT_CONFIG',
          value: JSON.stringify(instance),
          description: 'Cấu hình Trợ lý AI website',
        });
      } else {
        configRecord.value = JSON.stringify(instance);
      }
      await manager.save(SystemConfig, configRecord);

      // Audit event
      const auditEvent = manager.create(ChatbotAuditEvent, {
        actor_type: userId ? 'user' : 'system',
        actor_user_id: userId || null,
        op: 'config.update',
        object_type: 'system_config',
        object_id: 'CHATBOT_CONFIG',
        before_ref: null,
        after_ref: { changed_fields: changedFields },
      });
      await manager.save(ChatbotAuditEvent, auditEvent);
    });

    this.clearCache();
    return this.get();
  }

  async publicView(): Promise<any> {
    const config = await this.get();

    // If disabled, public endpoint can return { enabled: false }
    if (!config.enabled) {
      return { enabled: false };
    }

    // Resolving fallback contact channels
    const channels = { ...config.contact_channels };
    const neededFallbacks = [];
    if (!channels.hotline) neededFallbacks.push('contact_phone');
    if (!channels.zalo_url) neededFallbacks.push('zalo_url');
    if (!channels.email_public) neededFallbacks.push('contact_email');
    if (!channels.messenger_url) neededFallbacks.push('facebook_url', 'facebook_page_url');

    if (neededFallbacks.length > 0) {
      try {
        const fallbacks = await this.systemConfigRepo.find({
          where: { key: In(neededFallbacks) },
        });
        const getVal = (k: string) => fallbacks.find((f) => f.key === k)?.value || '';

        if (!channels.hotline) {
          const ph = getVal('contact_phone');
          if (checkHotline(ph)) channels.hotline = ph;
        }
        if (!channels.zalo_url) {
          const z = getVal('zalo_url');
          if (checkZaloUrl(z)) channels.zalo_url = z;
        }
        if (!channels.email_public) {
          const em = getVal('contact_email');
          if (checkEmail(em)) channels.email_public = em;
        }
        if (!channels.messenger_url) {
          const fb = getVal('facebook_url') || getVal('facebook_page_url');
          if (checkMessengerUrl(fb)) channels.messenger_url = fb;
        }
      } catch (e: any) {
        this.logger.warn(`Could not load contact channels fallback: ${e?.message}`);
      }
    }

    // Render greeting with template variables
    const renderedGreeting = renderTemplate(config.greeting, {
      short_name: config.short_name,
      display_name: config.display_name,
    });

    const isOpenNow = isWithinWorkingHours(new Date(), config.working_hours);

    return {
      enabled: config.enabled,
      display_name: config.display_name,
      short_name: config.short_name,
      avatar_url: config.avatar_url,
      greeting: renderedGreeting,
      contact_channels: channels,
      working_hours: config.working_hours,
      is_open_now: isOpenNow,
      response_sla_text: config.response_sla_text || '',
      features: config.features,
    };
  }
}
