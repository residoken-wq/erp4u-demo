import { Controller, Get, UseGuards, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthOnly } from '../auth/permissions.decorator';
import { CorePackage } from '../common/packages/requires-package.decorator';
import {
  SUBSCRIPTION_INFO_PROVIDER,
  SubscriptionInfo,
  SubscriptionInfoProvider,
} from '../common/subscription/subscription-info.interface';
import { UserQuotaService, UserQuotaUsage } from '../users/user-quota.service';
import {
  ENTITLEMENT_PROVIDER,
  EntitlementProvider,
  PackageEntitlementItem,
} from '../common/packages/entitlement-provider.interface';
import { DemoModeService } from '../common/services/demo-mode.service';

export interface SystemSubscriptionResponse {
  subscription: SubscriptionInfo | null;
  users: UserQuotaUsage;
  packages: PackageEntitlementItem[];
}

@Controller('system')
@CorePackage()
export class SystemSubscriptionController {
  constructor(
    @Inject(SUBSCRIPTION_INFO_PROVIDER)
    private readonly subscriptionInfoProvider: SubscriptionInfoProvider,
    private readonly userQuotaService: UserQuotaService,
    @Inject(ENTITLEMENT_PROVIDER)
    private readonly entitlementProvider: EntitlementProvider,
    private readonly demoModeService: DemoModeService,
  ) {}

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @AuthOnly()
  async getSubscription(): Promise<SystemSubscriptionResponse> {
    const isDemo = this.demoModeService.isDemoMode();
    const subscription = isDemo
      ? null
      : await this.subscriptionInfoProvider.getCurrent();
    const users = await this.userQuotaService.getUsage();
    const packages = await this.entitlementProvider.list();

    return {
      subscription,
      users,
      packages,
    };
  }
}
