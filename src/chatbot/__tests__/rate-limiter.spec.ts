import { ChatRateLimiter } from '../security/chat-rate-limiter';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('ChatRateLimiter (CB0-06, CB0-07)', () => {
  let limiter: ChatRateLimiter;

  beforeEach(() => {
    limiter = new ChatRateLimiter();
  });

  afterEach(() => {
    limiter.onModuleDestroy();
  });

  it('allows calls within the limit', () => {
    const key = 'test-session-1';
    for (let i = 0; i < 5; i++) {
      expect(() => limiter.consume('test', key, 5, 60000)).not.toThrow();
    }
  });

  it('throws 429 when limit is exceeded', () => {
    const key = 'test-session-exceeded';
    for (let i = 0; i < 20; i++) {
      limiter.consume('msg', key, 20, 5 * 60 * 1000);
    }

    try {
      limiter.consume('msg', key, 20, 5 * 60 * 1000);
      fail('Expected HttpException 429');
    } catch (err: any) {
      expect(err).toBeInstanceOf(HttpException);
      expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      const res = err.getResponse();
      expect(res.code).toBe('RATE_LIMITED');
      expect(res.retry_after_s).toBeGreaterThanOrEqual(1);
    }
  });

  it('shared IP rate limit does not block different sessions under their individual limits (CB0-07)', () => {
    const ipKey = 'shared-ip-hash';
    const session1 = 'session-1';
    const session2 = 'session-2';

    // 15 calls for session 1
    for (let i = 0; i < 15; i++) {
      expect(() => limiter.consume('msg:session', session1, 20, 300000)).not.toThrow();
      expect(() => limiter.consume('msg:ip', ipKey, 150, 300000)).not.toThrow();
    }

    // 15 calls for session 2
    for (let i = 0; i < 15; i++) {
      expect(() => limiter.consume('msg:session', session2, 20, 300000)).not.toThrow();
      expect(() => limiter.consume('msg:ip', ipKey, 150, 300000)).not.toThrow();
    }
  });
});
