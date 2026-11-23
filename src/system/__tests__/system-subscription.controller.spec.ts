import { SystemSubscriptionController } from '../system-subscription.controller';
import { PackageKey } from '../../common/packages/package.registry';
import { NullSubscriptionInfoProvider } from '../../common/subscription/null-subscription-info.provider';
import { SubscriptionInfo, SubscriptionInfoProvider } from '../../common/subscription/subscription-info.interface';

describe('SystemSubscriptionController', () => {
  let controller: SystemSubscriptionController;
  let mockQuotaService: any;
  let mockEntitlementProvider: any;
  let mockDemoModeService: any;

  beforeEach(() => {
    mockQuotaService = {
      getUsage: jest.fn().mockResolvedValue({ used: 3, max: 10 }),
    };
    mockEntitlementProvider = {
      list: jest.fn().mockResolvedValue([
        { key: PackageKey.CORE, enabled: true, validUntil: null, limits: { max_users: 10 } },
        { key: PackageKey.SALES, enabled: true, validUntil: null, limits: null },
      ]),
    };
    mockDemoModeService = {
      isDemoMode: jest.fn().mockReturnValue(false),
    };
  });

  it('returns subscription: null with default NullSubscriptionInfoProvider (open-core)', async () => {
    const defaultProvider = new NullSubscriptionInfoProvider();
    controller = new SystemSubscriptionController(
      defaultProvider,
      mockQuotaService,
      mockEntitlementProvider,
      mockDemoModeService,
    );

    const res = await controller.getSubscription();
    expect(res).toEqual({
      subscription: null,
      users: { used: 3, max: 10 },
      packages: [
        { key: PackageKey.CORE, enabled: true, validUntil: null, limits: { max_users: 10 } },
        { key: PackageKey.SALES, enabled: true, validUntil: null, limits: null },
      ],
    });
  });

  it('returns valid subscription payload with custom provider', async () => {
    const fakeSubscription: SubscriptionInfo = {
      plan_id: 'pro-monthly',
      plan_name: 'Pro',
      status: 'trialing',
      trial_ends_at: '2026-12-23T00:00:00.000Z',
      current_period_end: '2026-12-23T00:00:00.000Z',
      support_contact: {
        email: 'support@example.com',
        phone: '0900000001',
        url: 'https://help.example.com',
      },
    };

    const customProvider: SubscriptionInfoProvider = {
      getCurrent: jest.fn().mockResolvedValue(fakeSubscription),
    };

    controller = new SystemSubscriptionController(
      customProvider,
      mockQuotaService,
      mockEntitlementProvider,
      mockDemoModeService,
    );

    const res = await controller.getSubscription();
    expect(res.subscription).toEqual(fakeSubscription);
    expect(res.users).toEqual({ used: 3, max: 10 });
    expect(res.packages).toHaveLength(2);
  });

  it('returns subscription: null in demo mode even if provider has subscription info', async () => {
    mockDemoModeService.isDemoMode.mockReturnValue(true);

    const fakeSubscription: SubscriptionInfo = {
      plan_id: 'pro-monthly',
      plan_name: 'Pro',
      status: 'active',
      trial_ends_at: null,
      current_period_end: null,
      support_contact: null,
    };

    const customProvider: SubscriptionInfoProvider = {
      getCurrent: jest.fn().mockResolvedValue(fakeSubscription),
    };

    controller = new SystemSubscriptionController(
      customProvider,
      mockQuotaService,
      mockEntitlementProvider,
      mockDemoModeService,
    );

    const res = await controller.getSubscription();
    expect(res.subscription).toBeNull();
    expect(res.users).toEqual({ used: 3, max: 10 });
  });
});
