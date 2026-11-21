import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, UnauthorizedException } from '@nestjs/common';
import * as request from 'supertest';
import { AuthController } from '../auth.controller';
import { AuthService } from '../auth.service';
import { RateLimitModule, RateLimitService } from '../../common/security/rate-limit';
import { configureCoreApp } from '../../bootstrap/configure-app';

describe('Auth Login Rate Limiting E2E (Task P7c6a)', () => {
  let app: INestApplication;
  let rateLimitService: RateLimitService;

  const mockAuthService = {
    validateUser: jest.fn(async (username: string, pass: string) => {
      if (username === 'admin' && pass === 'correct_pass') {
        return { id: 1, username: 'admin', role: 'admin' };
      }
      if (username === 'demo_user' && pass === 'demo_pass') {
        return { id: 2, username: 'demo_user', role: 'user' };
      }
      return null;
    }),
    login: jest.fn(async (user: any) => ({
      access_token: 'mock_jwt_token',
      user,
    })),
    me: jest.fn(async (user: any) => user),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [RateLimitModule],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await configureCoreApp(app as any, { skipSecurityValidation: true });
    await app.init();

    rateLimitService = moduleRef.get(RateLimitService);
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    await app.close();
  });

  it('10 failed logins -> 11th returns 429 with Retry-After; login with correct credentials afterwards still 429 until window expires', async () => {
    const ip = '10.0.0.10';

    // 10 failed login attempts with wrong password
    for (let i = 1; i <= 10; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: 'admin', password: 'wrong_password' });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Sai tên đăng nhập hoặc mật khẩu');
    }

    // 11th attempt: blocked with 429 Too Many Requests
    const res11 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username: 'admin', password: 'wrong_password' });

    expect(res11.status).toBe(429);
    expect(res11.headers['retry-after']).toBeDefined();
    expect(res11.body).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMITED',
    });
    expect(typeof res11.body.retryAfter).toBe('number');
    expect(res11.body.retryAfter).toBeGreaterThanOrEqual(1);

    // 12th attempt: even with CORRECT password, it is still 429 until window expires
    const resCorrect = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username: 'admin', password: 'correct_pass' });

    expect(resCorrect.status).toBe(429);
    expect(resCorrect.headers['retry-after']).toBeDefined();
    expect(resCorrect.body.code).toBe('RATE_LIMITED');
  });

  it('a different IP is NOT blocked for the same username when first IP is locked out', async () => {
    const ip1 = '10.0.0.11';
    const ip2 = '10.0.0.12';

    // Lock out ip1 on 'admin'
    for (let i = 1; i <= 10; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip1)
        .send({ username: 'admin', password: 'wrong_password' });
    }

    // Verify ip1 is blocked
    const resIp1 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip1)
      .send({ username: 'admin', password: 'correct_pass' });
    expect(resIp1.status).toBe(429);

    // ip2 trying the SAME username with correct password succeeds (200/201)
    const resIp2 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip2)
      .send({ username: 'admin', password: 'correct_pass' });

    expect(resIp2.status).toBe(201);
    expect(resIp2.body.access_token).toBe('mock_jwt_token');
  });

  it('IP general limit: 50 failed attempts from one IP across different usernames locks the IP (51st = 429)', async () => {
    const ip = '10.0.0.50';

    // 50 failed logins across different accounts
    for (let i = 1; i <= 50; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: `user_${i}`, password: 'wrong_password' });
      expect(res.status).toBe(401);
    }

    // 51st attempt from this IP: blocked on IP level (429)
    const res51 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username: 'user_51', password: 'wrong_password' });

    expect(res51.status).toBe(429);
    expect(res51.headers['retry-after']).toBeDefined();
    expect(res51.body.code).toBe('RATE_LIMITED');
  });

  it('successful login resets the IP+username failure counter', async () => {
    const ip = '10.0.0.70';

    // 5 failed attempts (< 10)
    for (let i = 1; i <= 5; i++) {
      await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: 'demo_user', password: 'wrong_password' });
    }

    // Successful login -> resets IP+username failure count
    const loginOk = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ username: 'demo_user', password: 'demo_pass' });
    expect(loginOk.status).toBe(201);

    // Can fail another 5 times without being blocked (since counter was reset to 0)
    for (let i = 1; i <= 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ username: 'demo_user', password: 'wrong_password' });
      expect(res.status).toBe(401); // Not 429
    }
  });
});
