import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChatbotConfigDto } from '../config/chatbot-config.dto';
import { renderTemplate } from '../config/chatbot-config.service';
import { CHATBOT_DEFAULTS } from '../chatbot.defaults';

describe('Chatbot Config & Validation (CB0-10, CB0-12, CB0-14)', () => {
  it('renderTemplate replaces placeholders and escapes HTML characters', () => {
    const template = 'Xin chào {short_name} - {display_name}!';
    const rendered = renderTemplate(template, {
      short_name: 'Trợ lý <AI> & "Special"',
      display_name: 'ERP4U Support',
    });
    expect(rendered).toBe('Xin chào Trợ lý &lt;AI&gt; &amp; &quot;Special&quot; - ERP4U Support!');
  });

  it('validates a valid ChatbotConfigDto successfully', async () => {
    const validData = {
      ...CHATBOT_DEFAULTS,
      display_name: 'Trợ lý AI ERP4U Test',
      short_name: 'Trợ lý Test',
      avatar_url: '/images/chatbot/cuu-erp4u-192.webp',
      greeting: 'Xin chào {short_name} hỗ trợ bạn.',
      notify_emails: ['test@example.com'],
      notify_user_ids: [1, 2],
    };

    const instance = plainToInstance(ChatbotConfigDto, validData);
    const errors = await validate(instance);
    expect(errors.length).toBe(0);
  });

  it('rejects display_name containing <, >, {, } (CB0-10)', async () => {
    const invalidData = {
      ...CHATBOT_DEFAULTS,
      display_name: 'Trợ lý <AI>',
    };
    const instance = plainToInstance(ChatbotConfigDto, invalidData);
    const errors = await validate(instance);
    expect(errors.some((e) => e.property === 'display_name')).toBe(true);
  });

  it('rejects display_name with length < 2 (CB0-10)', async () => {
    const invalidData = {
      ...CHATBOT_DEFAULTS,
      display_name: 'A',
    };
    const instance = plainToInstance(ChatbotConfigDto, invalidData);
    const errors = await validate(instance);
    expect(errors.some((e) => e.property === 'display_name')).toBe(true);
  });

  it('rejects greeting with unallowed placeholders like {abc} (CB0-10)', async () => {
    const invalidData = {
      ...CHATBOT_DEFAULTS,
      greeting: 'Chào mừng bạn đến với {abc}',
    };
    const instance = plainToInstance(ChatbotConfigDto, invalidData);
    const errors = await validate(instance);
    expect(errors.some((e) => e.property === 'greeting')).toBe(true);
  });

  it('rejects invalid email in notify_emails (CB0-10)', async () => {
    const invalidData = {
      ...CHATBOT_DEFAULTS,
      notify_emails: ['not-an-email'],
    };
    const instance = plainToInstance(ChatbotConfigDto, invalidData);
    const errors = await validate(instance);
    expect(errors.some((e) => e.property === 'notify_emails')).toBe(true);
  });

  it('rejects secrets in text fields like AIza... or sk-...', async () => {
    const secretData = {
      ...CHATBOT_DEFAULTS,
      response_sla_text: 'Key is ' + ['AIza', 'SyD3x91abcdefghijk123456'].join(''),
    };
    const instance = plainToInstance(ChatbotConfigDto, secretData);
    const errors = await validate(instance);
    expect(errors.some((e) => e.property === 'response_sla_text')).toBe(true);
  });

  describe('Hostile values rejection on write via ChatbotConfigDto (M1, m1)', () => {
    it('rejects avatar_url starting with //evil.example (m1)', async () => {
      const data = {
        ...CHATBOT_DEFAULTS,
        avatar_url: '//evil.example/a.png',
      };
      const instance = plainToInstance(ChatbotConfigDto, data);
      const errors = await validate(instance);
      expect(errors.some((e) => e.property === 'avatar_url')).toBe(true);
    });

    it('rejects contact channels with javascript:, http://, HTML, or invalid email', async () => {
      const data = {
        ...CHATBOT_DEFAULTS,
        contact_channels: {
          hotline: '<img src=x onerror=alert(1)>',
          zalo_url: 'javascript:alert(1)',
          email_public: 'x',
          messenger_url: 'http://phish.example',
        },
      };
      const instance = plainToInstance(ChatbotConfigDto, data);
      const errors = await validate(instance);
      const contactErr = errors.find((e) => e.property === 'contact_channels');
      expect(contactErr).toBeDefined();
      const children = contactErr?.children || [];
      expect(children.some((c) => c.property === 'hotline')).toBe(true);
      expect(children.some((c) => c.property === 'zalo_url')).toBe(true);
      expect(children.some((c) => c.property === 'email_public')).toBe(true);
      expect(children.some((c) => c.property === 'messenger_url')).toBe(true);
    });

    it('rejects response_sla_text exceeding 300 characters', async () => {
      const data = {
        ...CHATBOT_DEFAULTS,
        response_sla_text: 'A'.repeat(5000),
      };
      const instance = plainToInstance(ChatbotConfigDto, data);
      const errors = await validate(instance);
      expect(errors.some((e) => e.property === 'response_sla_text')).toBe(true);
    });

    it('rejects working_hours when from >= to', async () => {
      const data = {
        ...CHATBOT_DEFAULTS,
        working_hours: {
          ...CHATBOT_DEFAULTS.working_hours,
          days: {
            ...CHATBOT_DEFAULTS.working_hours.days,
            tue: { off: false, from: '18:00', to: '08:00' },
          },
        },
      };
      const instance = plainToInstance(ChatbotConfigDto, data);
      const errors = await validate(instance);
      const whErr = errors.find((e) => e.property === 'working_hours');
      expect(whErr).toBeDefined();
    });
  });

  describe('Hostile values sanitization on read via ChatbotConfigService (M1, m1, CB0-24)', () => {
    it('sanitizes all hostile fields injected anonymously into DB and falls back to safe defaults', async () => {
      const hostileDbPayload = {
        enabled: true,
        short_name: 'ERP4U',
        display_name: 'ERP4U AI',
        avatar_url: '//evil.example/a.png',
        greeting: 'Xin chào',
        contact_channels: {
          hotline: '<img src=x onerror=alert(1)>',
          zalo_url: 'javascript:alert(1)',
          email_public: 'x',
          messenger_url: 'http://phish.example',
        },
        response_sla_text: 'A'.repeat(5000),
        working_hours: {
          days: {
            mon: { off: 'yes', from: '99:99', to: '00:00' },
            tue: { off: false, from: '18:00', to: '08:00' },
          },
        },
      };

      const mockRepo = {
        findOne: jest.fn().mockResolvedValue({
          key: 'CHATBOT_CONFIG',
          value: JSON.stringify(hostileDbPayload),
        }),
        find: jest.fn().mockResolvedValue([
          { key: 'contact_phone', value: '0983123456' },
        ]),
      };
      const mockDataSource = {} as any;

      const { ChatbotConfigService } = require('../config/chatbot-config.service');
      const service = new ChatbotConfigService(mockRepo as any, mockDataSource);

      const config = await service.get();

      // Verify hostile fields were rejected and safe fallbacks applied
      expect(config.avatar_url).toBe(CHATBOT_DEFAULTS.avatar_url);
      expect(config.avatar_url).not.toContain('//evil.example');
      expect(config.contact_channels.hotline).toBe('');
      expect(config.contact_channels.zalo_url).toBe('');
      expect(config.contact_channels.email_public).toBe('');
      expect(config.contact_channels.messenger_url).toBe('');
      expect(config.response_sla_text).toBe(CHATBOT_DEFAULTS.response_sla_text);
      expect(config.working_hours.days.mon).toEqual(CHATBOT_DEFAULTS.working_hours.days.mon);
      expect(config.working_hours.days.tue).toEqual(CHATBOT_DEFAULTS.working_hours.days.tue);

      // Verify publicView() falls back to valid phone and does not leak hostile data
      const pubView = await service.publicView();
      expect(pubView.enabled).toBe(true);
      expect(pubView.avatar_url).toBe(CHATBOT_DEFAULTS.avatar_url);
      expect(pubView.contact_channels.hotline).toBe('0983123456');
      expect(pubView.contact_channels.zalo_url).toBe('');
      expect(pubView.contact_channels.messenger_url).toBe('');
      expect(pubView.response_sla_text).toBe(CHATBOT_DEFAULTS.response_sla_text);
      expect(pubView.working_hours.days.mon.off).toBe(false);
      expect(pubView.working_hours.days.mon.from).toBe('08:00');
    });
  });
});
