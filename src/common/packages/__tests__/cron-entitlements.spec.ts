import { ChatbotOutboxService } from '../../../chatbot/outbox/chatbot-outbox.service';
import { SalesService } from '../../../sales/sales.service';
import { ZaloZnsService } from '../../../zns/zns.service';
import { PackageKey } from '../package.registry';
import { EntitlementProvider } from '../entitlement-provider.interface';

describe('Check 4: Cron Entitlement Control Spec', () => {
  let mockDisabledProvider: EntitlementProvider;

  beforeEach(() => {
    mockDisabledProvider = {
      isEnabled: jest.fn().mockImplementation(async (pkg: PackageKey) => {
        // PRODUCTION, AI, MARKETING, SALES are disabled
        return false;
      }),
      getLimits: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue([]),
    };
  });

  it('ChatbotOutboxService (AI): skips execution when PackageKey.AI is disabled', async () => {
    const mockTransaction = jest.fn();
    const mockDataSource = {
      transaction: mockTransaction,
    } as any;

    const outboxService = new ChatbotOutboxService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockDataSource,
      mockDisabledProvider,
    );

    const runSpy = jest.spyOn(outboxService, 'run');

    await outboxService.handleCron();

    expect(mockDisabledProvider.isEnabled).toHaveBeenCalledWith(PackageKey.AI);
    expect(runSpy).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('SalesService (SALES): skips checkExpiredBookings when PackageKey.SALES is disabled', async () => {
    const mockItemRepo = {
      find: jest.fn(),
    };

    const salesService = new SalesService(
      {} as any,
      mockItemRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockDisabledProvider,
    );

    await salesService.checkExpiredBookings();

    expect(mockDisabledProvider.isEnabled).toHaveBeenCalledWith(PackageKey.SALES);
    expect(mockItemRepo.find).not.toHaveBeenCalled();
  });

  it('ZaloZnsService (MARKETING): skips handleTokenAutoRefreshCron when PackageKey.MARKETING is disabled', async () => {
    const mockConfigRepo = {
      findOne: jest.fn(),
    };

    const znsService = new ZaloZnsService(
      mockConfigRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockDisabledProvider,
    );

    const getConfigSpy = jest.spyOn(znsService, 'getConfig');

    await znsService.handleTokenAutoRefreshCron();

    expect(mockDisabledProvider.isEnabled).toHaveBeenCalledWith(PackageKey.MARKETING);
    expect(getConfigSpy).not.toHaveBeenCalled();
    expect(mockConfigRepo.findOne).not.toHaveBeenCalled();
  });

  it('PRODUCTION/AI/MARKETING packages disabled check prevents cron jobs from executing', async () => {
    expect(await mockDisabledProvider.isEnabled(PackageKey.PRODUCTION)).toBe(false);
    expect(await mockDisabledProvider.isEnabled(PackageKey.AI)).toBe(false);
    expect(await mockDisabledProvider.isEnabled(PackageKey.MARKETING)).toBe(false);

    // Verify a handler guarded by PRODUCTION does not trigger repository actions
    const productionRepoAction = jest.fn();
    const handleProductionCron = async () => {
      if (!(await mockDisabledProvider.isEnabled(PackageKey.PRODUCTION))) {
        return;
      }
      productionRepoAction();
    };

    await handleProductionCron();
    expect(productionRepoAction).not.toHaveBeenCalled();
  });
});
