import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import {
  SUBSCRIPTION_INFO_PROVIDER,
  SubscriptionInfoProvider,
} from './subscription-info.interface';
import { NullSubscriptionInfoProvider } from './null-subscription-info.provider';
import {
  normalizeProviderOverride,
  ProviderOverride,
} from '../utils/provider-override.util';

export interface SubscriptionModuleOptions {
  subscriptionInfoProvider?: ProviderOverride<SubscriptionInfoProvider>;
}

const DEFAULT_SUBSCRIPTION_INFO_PROVIDER: Provider = {
  provide: SUBSCRIPTION_INFO_PROVIDER,
  useClass: NullSubscriptionInfoProvider,
};

@Global()
@Module({
  providers: [
    NullSubscriptionInfoProvider,
    DEFAULT_SUBSCRIPTION_INFO_PROVIDER,
  ],
  exports: [
    SUBSCRIPTION_INFO_PROVIDER,
    NullSubscriptionInfoProvider,
  ],
})
export class SubscriptionModule {
  static forRoot(options: SubscriptionModuleOptions = {}): DynamicModule {
    const subscriptionInfoProvider: Provider = options.subscriptionInfoProvider
      ? normalizeProviderOverride(
          SUBSCRIPTION_INFO_PROVIDER,
          options.subscriptionInfoProvider,
        )
      : DEFAULT_SUBSCRIPTION_INFO_PROVIDER;

    return {
      module: SubscriptionModule,
      global: true,
      providers: [NullSubscriptionInfoProvider, subscriptionInfoProvider],
      exports: [SUBSCRIPTION_INFO_PROVIDER, NullSubscriptionInfoProvider],
    };
  }
}
