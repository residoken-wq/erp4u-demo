import { DynamicModule, Global, Logger, Module, Provider } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TenantEntitlement } from './tenant-entitlement.entity';
import { UsageCounter } from './usage-counter.entity';
import { UsageService } from './usage.service';
import {
  ENTITLEMENT_PROVIDER,
  EntitlementProvider,
} from './entitlement-provider.interface';
import { AllEnabledProvider } from './all-enabled.provider';
import { DbEntitlementProvider } from './db-entitlement.provider';
import { EntitlementGuard } from './entitlement.guard';
import { MeEntitlementsController } from './me-entitlements.controller';
import {
  normalizeProviderOverride,
  ProviderOverride,
} from '../utils/provider-override.util';

let hasWarnedEntitlementsMode = false;

export interface EntitlementsModuleOptions {
  entitlementProvider?: ProviderOverride<EntitlementProvider>;
}

const DEFAULT_ENTITLEMENT_PROVIDER: Provider = {
  provide: ENTITLEMENT_PROVIDER,
  useFactory: (
    configService: ConfigService,
    allEnabled: AllEnabledProvider,
    dbEntitlement: DbEntitlementProvider,
  ) => {
    const rawMode = configService.get<string>('ENTITLEMENTS_MODE');
    if (!rawMode) {
      if (!hasWarnedEntitlementsMode) {
        new Logger('EntitlementsModule').warn(
          'ENTITLEMENTS_MODE is not set, defaulting to "all"',
        );
        hasWarnedEntitlementsMode = true;
      }
      return allEnabled;
    }

    const mode = rawMode.trim().toLowerCase();
    if (mode === 'db') {
      return dbEntitlement;
    }

    if (mode !== 'all' && !hasWarnedEntitlementsMode) {
      new Logger('EntitlementsModule').warn(
        `Invalid ENTITLEMENTS_MODE="${rawMode}", falling back to "all"`,
      );
      hasWarnedEntitlementsMode = true;
    }

    return allEnabled;
  },
  inject: [ConfigService, AllEnabledProvider, DbEntitlementProvider],
};

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TenantEntitlement, UsageCounter])],
  controllers: [MeEntitlementsController],
  providers: [
    AllEnabledProvider,
    DbEntitlementProvider,
    UsageService,
    DEFAULT_ENTITLEMENT_PROVIDER,
    {
      provide: APP_GUARD,
      useClass: EntitlementGuard,
    },
  ],
  exports: [
    ENTITLEMENT_PROVIDER,
    AllEnabledProvider,
    DbEntitlementProvider,
    UsageService,
    TypeOrmModule,
  ],
})
export class EntitlementsModule {
  static forRoot(options: EntitlementsModuleOptions = {}): DynamicModule {
    const entitlementProvider: Provider = options.entitlementProvider
      ? normalizeProviderOverride(
          ENTITLEMENT_PROVIDER,
          options.entitlementProvider,
        )
      : DEFAULT_ENTITLEMENT_PROVIDER;

    return {
      module: EntitlementsModule,
      global: true,
      imports: [TypeOrmModule.forFeature([TenantEntitlement, UsageCounter])],
      controllers: [MeEntitlementsController],
      providers: [
        AllEnabledProvider,
        DbEntitlementProvider,
        UsageService,
        entitlementProvider,
        {
          provide: APP_GUARD,
          useClass: EntitlementGuard,
        },
      ],
      exports: [
        ENTITLEMENT_PROVIDER,
        AllEnabledProvider,
        DbEntitlementProvider,
        UsageService,
        TypeOrmModule,
      ],
    };
  }
}
