import { MemoryRateLimitStore } from '../memory-rate-limit.store';

describe('MemoryRateLimitStore (Unit)', () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  afterEach(() => {
    store.onModuleDestroy();
  });

  it('increments counter from 0 to 1 and keeps window', () => {
    const key = 'test:key:1';
    const rec1 = store.increment(key, 10_000);
    expect(rec1.count).toBe(1);
    expect(rec1.resetAt).toBeGreaterThan(Date.now());

    const rec2 = store.increment(key, 10_000);
    expect(rec2.count).toBe(2);
    expect(rec2.resetAt).toBe(rec1.resetAt); // Same window
  });

  it('retrieves active record and returns null for non-existent or expired', async () => {
    const key = 'test:key:2';
    expect(store.get(key)).toBeNull();

    store.increment(key, 50); // 50ms TTL
    expect(store.get(key)?.count).toBe(1);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, 60));
    expect(store.get(key)).toBeNull();
  });

  it('starts fresh window after TTL expires', async () => {
    const key = 'test:key:3';
    store.increment(key, 50);
    store.increment(key, 50);
    expect(store.get(key)?.count).toBe(2);

    await new Promise((r) => setTimeout(r, 60));
    const fresh = store.increment(key, 10_000);
    expect(fresh.count).toBe(1);
  });

  it('resets a specific key without affecting other keys', () => {
    store.increment('k1', 10_000);
    store.increment('k2', 10_000);

    store.reset('k1');
    expect(store.get('k1')).toBeNull();
    expect(store.get('k2')?.count).toBe(1);
  });

  it('clears all records', () => {
    store.increment('k1', 10_000);
    store.increment('k2', 10_000);
    store.clear();

    expect(store.get('k1')).toBeNull();
    expect(store.get('k2')).toBeNull();
  });
});
