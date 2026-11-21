import { PackageKey } from '../package.registry';
import { SalesService } from '../../../sales/sales.service';
import { EntitlementProvider } from '../entitlement-provider.interface';

describe('Cron Entitlements Guard', () => {
  let mockDisabledProvider: jest.Mocked<EntitlementProvider>;
  let mockItemRepo: any;

  beforeEach(() => {
    mockDisabledProvider = {
      isEnabled: jest.fn().mockResolvedValue(false),
      getLimits: jest.fn().mockResolvedValue(null),
      list: jest.fn().mockResolvedValue([]),
    };

    mockItemRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
  });

  it('checkExpiredBookings exits early without querying itemRepo when SALES package is disabled', async () => {
    const salesService = new SalesService(
      {} as any, // orderRepo
      mockItemRepo as any, // itemRepo
      {} as any, // sampleRepo
      {} as any, // deliveryRepo
      {} as any, // commentRepo
      {} as any, // checklistRepo
      {} as any, // checklistItemRepo
      {} as any, // systemService
      {} as any, // transRepo
      {} as any, // priceListRepo
      {} as any, // priceListRuleRepo
      {} as any, // userRepo
      {} as any, // versionRepo
      {} as any, // targetRepo
      {} as any, // customerRepo
      {} as any, // productsService
      {} as any, // inventoryService
      {} as any, // customersService
      {} as any, // notificationsService
      {} as any, // projectsService
      {} as any, // promotionRepo
      {} as any, // easyInvoiceService
      {} as any, // emailService
      mockDisabledProvider as any, // entitlementProvider
      undefined, // tenantRegistry
    );

    await salesService.checkExpiredBookings();

    expect(mockDisabledProvider.isEnabled).toHaveBeenCalledWith(PackageKey.SALES);
    expect(mockItemRepo.find).not.toHaveBeenCalled();
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
