import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PortalController } from '../portal.controller';
import { PublicController } from '../public.controller';
import { Customer } from '../../customers/customer.entity';
import { CustomerContact } from '../../customers/customer-contact.entity';
import { PortalOtp } from '../entities/portal-otp.entity';
import { PortalSession } from '../entities/portal-session.entity';
import { SalesOrder } from '../../sales/sales-order.entity';
import { SystemConfig } from '../../system/system-config.entity';
import { EmailService } from '../../common/services/email.service';
import { SalesService } from '../../sales/sales.service';
import { SystemService } from '../../system/system.service';
import { HrService } from '../../hr/hr.service';
import { DemoModeService } from '../../common/services/demo-mode.service';
import { RateLimitModule, RateLimitService } from '../../common/security/rate-limit';
import { configureCoreApp } from '../../bootstrap/configure-app';

describe('Portal & Recruitment Rate Limiting E2E (Task P7c6a)', () => {
  let app: INestApplication;
  let rateLimitService: RateLimitService;

  const mockCustomer = {
    id: 1,
    name: 'Khách hàng Demo',
    email: 'client@example.com',
    phone: '0900000001',
    code: 'CUST-01',
  };

  let otps: any[] = [];
  let nextOtpId = 1;

  const mockOtpRepo = {
    create: jest.fn((dto) => ({ id: nextOtpId++, ...dto })),
    save: jest.fn(async (otp) => {
      const idx = otps.findIndex((o) => o.id === otp.id);
      if (idx >= 0) {
        otps[idx] = { ...otp };
        return otps[idx];
      }
      otps.push(otp);
      return otp;
    }),
    findOne: jest.fn(async ({ where }) => {
      return (
        otps
          .slice()
          .reverse()
          .find((o) => {
            if (where.email && o.email !== where.email) return false;
            if (where.is_used !== undefined && o.is_used !== where.is_used) return false;
            return true;
          }) || null
      );
    }),
  };

  const mockCustomerRepo = {
    findOne: jest.fn(async ({ where }) => {
      if (where.email === 'client@example.com' || where.id === 1) {
        return mockCustomer;
      }
      return null;
    }),
  };

  const mockSessionRepo = {
    create: jest.fn((dto) => dto),
    save: jest.fn(async (s) => s),
  };

  const mockHrService = {
    createCandidate: jest.fn(async () => ({ portal_token: 'candidate-token-uuid' })),
    getCandidateByToken: jest.fn(async (token: string) =>
      token === 'valid-token' ? { id: 1, job_post: {} } : null,
    ),
    getAssessmentByCandidate: jest.fn(async () => ({ questions_json: [] })),
    findInterviews: jest.fn(async () => []),
    submitAssessment: jest.fn(async () => ({ success: true })),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [RateLimitModule],
      controllers: [PortalController, PublicController],
      providers: [
        { provide: getRepositoryToken(Customer), useValue: mockCustomerRepo },
        { provide: getRepositoryToken(CustomerContact), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(PortalOtp), useValue: mockOtpRepo },
        { provide: getRepositoryToken(PortalSession), useValue: mockSessionRepo },
        { provide: getRepositoryToken(SalesOrder), useValue: {} },
        { provide: getRepositoryToken(SystemConfig), useValue: {} },
        { provide: EmailService, useValue: { sendMail: jest.fn() } },
        { provide: SalesService, useValue: {} },
        { provide: SystemService, useValue: {} },
        { provide: HrService, useValue: mockHrService },
        { provide: DemoModeService, useValue: { isDemoMode: () => false } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await configureCoreApp(app as any, { skipSecurityValidation: true });
    await app.init();

    rateLimitService = moduleRef.get(RateLimitService);
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
    otps = [];
    nextOtpId = 1;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Portal request-otp rate limiting', () => {
    it('allows 5 requests per email/phone, 6th returns 429 with Retry-After', async () => {
      const email = 'client@example.com';

      for (let i = 1; i <= 5; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/public/portal/request-otp')
          .set('X-Forwarded-For', `10.1.1.${i}`) // Different IP each time to isolate identifier limit
          .send({ email });
        expect(res.status).toBe(201);
      }

      // 6th request with same email -> 429
      const res6 = await request(app.getHttpServer())
        .post('/api/public/portal/request-otp')
        .set('X-Forwarded-For', '10.1.1.99')
        .send({ email });

      expect(res6.status).toBe(429);
      expect(res6.headers['retry-after']).toBeDefined();
      expect(res6.body.code).toBe('RATE_LIMITED');
    });

    it('allows 20 requests per IP, 21st returns 429', async () => {
      const ip = '10.1.2.5';

      for (let i = 1; i <= 20; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/public/portal/request-otp')
          .set('X-Forwarded-For', ip)
          .send({ email: `user${i}@example.com` });
        // Email may not be found in DB (404), but rate limiter consumed the request
        expect([201, 404]).toContain(res.status);
      }

      // 21st request from same IP -> 429
      const res21 = await request(app.getHttpServer())
        .post('/api/public/portal/request-otp')
        .set('X-Forwarded-For', ip)
        .send({ email: 'another@example.com' });

      expect(res21.status).toBe(429);
      expect(res21.headers['retry-after']).toBeDefined();
      expect(res21.body.code).toBe('RATE_LIMITED');
    });
  });

  describe('Portal verify-otp: 5 failed attempts invalidates OTP', () => {
    it('5 failed attempts on an OTP marks is_used=true; subsequent attempt with correct code fails', async () => {
      const email = 'client@example.com';
      // Seed active OTP
      const seededOtp = {
        id: 10,
        email,
        otp_code: '123456',
        customer_id: 1,
        is_used: false,
        expires_at: new Date(Date.now() + 5 * 60 * 1000),
      };
      otps.push(seededOtp);

      // 4 failed attempts
      for (let i = 1; i <= 4; i++) {
        const res = await request(app.getHttpServer())
          .post('/api/public/portal/verify-otp')
          .send({ email, otp_code: '000000' });
        expect(res.status).toBe(401);
      }
      expect(seededOtp.is_used).toBe(false);

      // 5th failed attempt -> reaches threshold, marks OTP is_used = true
      const res5 = await request(app.getHttpServer())
        .post('/api/public/portal/verify-otp')
        .send({ email, otp_code: '000000' });
      expect(res5.status).toBe(401);
      expect(seededOtp.is_used).toBe(true);

      // 6th attempt: even with CORRECT otp_code '123456', fails because OTP is invalidated
      const res6 = await request(app.getHttpServer())
        .post('/api/public/portal/verify-otp')
        .send({ email, otp_code: '123456' });
      expect(res6.status).toBe(401);
      expect(res6.body.message).toContain('không hợp lệ hoặc đã hết hạn');
    });
  });

  describe('Recruitment portal & apply rate limiting', () => {
    it('allows 20 requests per IP, 21st returns 429', async () => {
      const ip = '10.2.3.4';

      for (let i = 1; i <= 20; i++) {
        const res = await request(app.getHttpServer())
          .get('/api/public/recruitment/portal/valid-token')
          .set('X-Forwarded-For', ip);
        expect(res.status).toBe(200);
      }

      // 21st request from same IP -> 429
      const res21 = await request(app.getHttpServer())
        .get('/api/public/recruitment/portal/valid-token')
        .set('X-Forwarded-For', ip);

      expect(res21.status).toBe(429);
      expect(res21.headers['retry-after']).toBeDefined();
      expect(res21.body.code).toBe('RATE_LIMITED');
    });
  });
});
