import { RateLimitService } from '../rate-limit.service';
import { MemoryRateLimitStore } from '../memory-rate-limit.store';
import { RateLimitedException } from '../rate-limit.exception';
import { TenantContext } from '../../../tenancy/tenant-context';

describe('RateLimitService (Unit)', () => {
  let store: MemoryRateLimitStore;
  let service: RateLimitService;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
    service = new RateLimitService(store);
  });

  afterEach(() => {
    store.onModuleDestroy();
  });

  it('normalizes identifiers (lowercase & trim)', () => {
    expect(service.normalizeIdentifier('  Admin@EXAMPLE.COM ')).toBe(
      'admin@example.com',
    );
    expect(service.normalizeIdentifier('  0900123456 ')).toBe('0900123456');
    expect(service.normalizeIdentifier(null)).toBe('');
    expect(service.normalizeIdentifier(undefined)).toBe('');
  });

  it('constructs composite tenant-isolated keys', () => {
    const keyDefault = service.buildKey('login:ip', '127.0.0.1');
    expect(keyDefault).toBe('rl:default:login:ip:127.0.0.1');

    const keyTenantA = service.buildKey('login:ip', '127.0.0.1', 'tenant_a');
    expect(keyTenantA).toBe('rl:tenant_a:login:ip:127.0.0.1');

    // Inside TenantContext.run
    TenantContext.run({ tenantId: 'tenant_xyz', schema: 'tenant_xyz' }, () => {
      const keyAuto = service.buildKey('login:user', 'user1');
      expect(keyAuto).toBe('rl:tenant_xyz:login:user:user1');
    });
  });

  it('detects when limit is exceeded and calculates retryAfter in seconds', async () => {
    const key = service.buildKey('test', '127.0.0.1');
    await service.recordFailure(key, 10_000);
    await service.recordFailure(key, 10_000);

    const checkNotBlocked = await service.checkLimit(key, 3);
    expect(checkNotBlocked.isBlocked).toBe(false);
    expect(checkNotBlocked.current).toBe(2);

    await service.recordFailure(key, 10_000);
    const checkBlocked = await service.checkLimit(key, 3);
    expect(checkBlocked.isBlocked).toBe(true);
    expect(checkBlocked.retryAfter).toBeGreaterThanOrEqual(1);
    expect(checkBlocked.retryAfter).toBeLessThanOrEqual(10);
  });

  it('assertNotRateLimited throws RateLimitedException when blocked', async () => {
    const key = service.buildKey('test', 'blocked_user');
    for (let i = 0; i < 5; i++) {
      await service.recordFailure(key, 5_000);
    }

    await expect(service.assertNotRateLimited(key, 5)).rejects.toThrow(
      RateLimitedException,
    );
    try {
      await service.assertNotRateLimited(key, 5);
    } catch (err: any) {
      expect(err.getStatus()).toBe(429);
      expect(err.getResponse()).toMatchObject({
        statusCode: 429,
        code: 'RATE_LIMITED',
      });
      expect(err.getResponse().retryAfter).toBeGreaterThanOrEqual(1);
    }
  });

  it('DEMO_MODE does not bypass rate limiting (Task 5 requirement)', async () => {
    const origDemo = process.env.DEMO_MODE;
    try {
      process.env.DEMO_MODE = 'true';
      const key = service.buildKey('demo', 'ip_demo');
      for (let i = 0; i < 2; i++) {
        await service.recordFailure(key, 5_000);
      }
      const check = await service.checkLimit(key, 2);
      expect(check.isBlocked).toBe(true);
      await expect(service.assertNotRateLimited(key, 2)).rejects.toThrow(
        RateLimitedException,
      );
    } finally {
      process.env.DEMO_MODE = origDemo;
    }
  });

  it('respects env overrides for thresholds and window sizes', () => {
    const origUserMax = process.env.RATE_LIMIT_LOGIN_USER_MAX;
    const origUserWin = process.env.RATE_LIMIT_LOGIN_USER_WINDOW_SEC;
    try {
      process.env.RATE_LIMIT_LOGIN_USER_MAX = '3';
      process.env.RATE_LIMIT_LOGIN_USER_WINDOW_SEC = '60';

      expect(service.getLoginUserMax()).toBe(3);
      expect(service.getLoginUserWindowMs()).toBe(60_000);
    } finally {
      process.env.RATE_LIMIT_LOGIN_USER_MAX = origUserMax;
      process.env.RATE_LIMIT_LOGIN_USER_WINDOW_SEC = origUserWin;
    }
  });
});
