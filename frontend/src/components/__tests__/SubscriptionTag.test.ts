import test from 'node:test';
import assert from 'node:assert';
import {
  getSubscriptionTagConfig,
  loadSubscriptionOnce,
  resetSubscriptionCache,
  getCachedSubscription,
} from '../../hooks/subscriptionStore.ts';
import type { SubscriptionInfo } from '../../hooks/subscriptionStore.ts';

test('SubscriptionTag and useSubscription unit tests (Task P10a)', async (t) => {
  t.beforeEach(() => {
    resetSubscriptionCache();
  });

  await t.test('null subscription returns null (does not render tag)', () => {
    const config = getSubscriptionTagConfig(null);
    assert.strictEqual(config, null);
  });

  await t.test('trialing with 12 days remaining: blue tag', () => {
    const nowMs = new Date('2026-11-23T00:00:00.000Z').getTime();
    const sub: SubscriptionInfo = {
      plan_id: 'pro-monthly',
      plan_name: 'Pro',
      status: 'trialing',
      trial_ends_at: new Date('2026-12-05T00:00:00.000Z').toISOString(), // 12 days
      current_period_end: null,
    };

    const config = getSubscriptionTagConfig(sub, nowMs);
    assert.notStrictEqual(config, null);
    assert.strictEqual(config?.label, 'Gói Pro · Dùng thử còn 12 ngày');
    assert.strictEqual(config?.color, 'blue');
    assert.strictEqual(config?.daysRemaining, 12);
  });

  await t.test('trialing with 7 days remaining: orange tag (N <= 7)', () => {
    const nowMs = new Date('2026-11-23T00:00:00.000Z').getTime();
    const sub: SubscriptionInfo = {
      plan_id: 'pro-monthly',
      plan_name: 'Pro',
      status: 'trialing',
      trial_ends_at: new Date('2026-11-30T00:00:00.000Z').toISOString(), // 7 days
      current_period_end: null,
    };

    const config = getSubscriptionTagConfig(sub, nowMs);
    assert.notStrictEqual(config, null);
    assert.strictEqual(config?.label, 'Gói Pro · Dùng thử còn 7 ngày');
    assert.strictEqual(config?.color, 'orange');
    assert.strictEqual(config?.daysRemaining, 7);
  });

  await t.test('trialing with 1 day remaining: red tag (N <= 1)', () => {
    const nowMs = new Date('2026-11-23T00:00:00.000Z').getTime();
    const sub: SubscriptionInfo = {
      plan_id: 'pro-monthly',
      plan_name: 'Pro',
      status: 'trialing',
      trial_ends_at: new Date('2026-11-24T00:00:00.000Z').toISOString(), // 1 day
      current_period_end: null,
    };

    const config = getSubscriptionTagConfig(sub, nowMs);
    assert.notStrictEqual(config, null);
    assert.strictEqual(config?.label, 'Gói Pro · Dùng thử còn 1 ngày');
    assert.strictEqual(config?.color, 'red');
    assert.strictEqual(config?.daysRemaining, 1);
  });

  await t.test('trialing with 0 or negative days: red tag (N <= 1)', () => {
    const nowMs = new Date('2026-11-23T12:00:00.000Z').getTime();
    const sub: SubscriptionInfo = {
      plan_id: 'pro-monthly',
      plan_name: 'Pro',
      status: 'trialing',
      trial_ends_at: new Date('2026-11-23T08:00:00.000Z').toISOString(), // expired
      current_period_end: null,
    };

    const config = getSubscriptionTagConfig(sub, nowMs);
    assert.notStrictEqual(config, null);
    assert.strictEqual(config?.label, 'Gói Pro · Dùng thử còn 0 ngày');
    assert.strictEqual(config?.color, 'red');
    assert.strictEqual(config?.daysRemaining, 0);
  });

  await t.test('past_due status: red tag', () => {
    const sub: SubscriptionInfo = {
      plan_id: 'enterprise',
      plan_name: 'Doanh Nghiệp',
      status: 'past_due',
      trial_ends_at: null,
      current_period_end: null,
    };

    const config = getSubscriptionTagConfig(sub);
    assert.notStrictEqual(config, null);
    assert.strictEqual(config?.label, 'Gói Doanh Nghiệp');
    assert.strictEqual(config?.color, 'red');
  });

  await t.test('suspended status: red tag', () => {
    const sub: SubscriptionInfo = {
      plan_id: 'pro-monthly',
      plan_name: 'Pro',
      status: 'suspended',
      trial_ends_at: null,
      current_period_end: null,
    };

    const config = getSubscriptionTagConfig(sub);
    assert.notStrictEqual(config, null);
    assert.strictEqual(config?.label, 'Gói Pro');
    assert.strictEqual(config?.color, 'red');
  });

  await t.test('active status: blue tag', () => {
    const sub: SubscriptionInfo = {
      plan_id: 'starter',
      plan_name: 'Starter',
      status: 'active',
      trial_ends_at: null,
      current_period_end: null,
    };

    const config = getSubscriptionTagConfig(sub);
    assert.notStrictEqual(config, null);
    assert.strictEqual(config?.label, 'Gói Starter');
    assert.strictEqual(config?.color, 'blue');
  });

  await t.test('loadSubscriptionOnce caches and deduplicates calls', async () => {
    let callCount = 0;
    const mockFetcher = async () => {
      callCount++;
      return {
        data: {
          subscription: {
            plan_id: 'pro',
            plan_name: 'Pro',
            status: 'active',
            trial_ends_at: null,
            current_period_end: null,
          },
          users: { used: 3, max: 10 },
          packages: [],
        },
      };
    };

    const first = await loadSubscriptionOnce(mockFetcher);
    const second = await loadSubscriptionOnce(mockFetcher);

    assert.strictEqual(callCount, 1);
    assert.strictEqual(first?.subscription?.plan_name, 'Pro');
    assert.strictEqual(second?.subscription?.plan_name, 'Pro');
    assert.strictEqual(getCachedSubscription()?.users.used, 3);
  });
});
