import { Global, Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TenantEntitlement } from './tenant-entitlement.entity';
import { UsageCounter } from './usage-counter.entity';
import { UsageService } from './usage.service';
import { ENTITLEMENT_PROVIDER } from './entitlement-provider.interface';
import { AllEnabledProvider } from './all-enabled.provider';
import { DbEntitlementProvider } from './db-entitlement.provider';
import { EntitlementGuard } from './entitlement.guard';
import { MeEntitlementsController } from './me-entitlements.controller';

let hasWarnedEntitlementsMode = false;

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([TenantEntitlement, UsageCounter])],
  controllers: [MeEntitlementsController],
  providers: [
    AllEnabledProvider,
    DbEntitlementProvider,
    UsageService,
    {
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
    },
    {
      provide: APP_GUARD,
      useClass: EntitlementGuard,
    },
  ],
  exports: [
    ENTITLEMENT_PROVIDER,
    AllEnabledProvider,
    DbEntitlementProvider,
    EntitlementGuard,
    UsageService,
    TypeOrmModule,
  ],
})
export class EntitlementsModule {}
