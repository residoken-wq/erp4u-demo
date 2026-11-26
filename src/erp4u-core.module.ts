import {
  DynamicModule,
  ForwardReference,
  Logger,
  Module,
  OnModuleInit,
  Type,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DataSource, DataSourceOptions } from 'typeorm';
import { validateSecurityConfig } from './common/security/secrets';

// Core & Domain Modules
import { ProductsModule } from './products/products.module';
import { MaterialsModule } from './materials/materials.module';
import { BomModule } from './bom/bom.module';
import { SalesModule } from './sales/sales.module';
import { InventoryModule } from './inventory/inventory.module';
import { ProductionModule } from './production/production.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { FinanceModule } from './finance/finance.module';
import { UploadModule } from './upload/upload.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { CustomersModule } from './customers/customers.module';
import { PlanningModule } from './planning/planning.module';
import { ProcessesModule } from './processes/processes.module';
import { CategoriesModule } from './categories/categories.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';
import { DiscussionsModule } from './discussions/discussions.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SystemModule } from './system/system.module';
import { PublicModule } from './public/public.module';
import { LookupsModule } from './lookups/lookups.module';
import { HrModule } from './hr/hr.module';
import { EncryptionModule } from './common/encryption/encryption.module';
import { MarketingModule } from './marketing/marketing.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { QCModule } from './qc/qc.module';
import { ShippingModule } from './shipping/shipping.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { CommonModule } from './common/common.module';
import { CostVisibilityInterceptor } from './auth/cost-visibility';
import { TenancyModule } from './common/tenancy/tenancy.module';
import { installTenantConnectionHook } from './common/tenancy/tenant-connection.hook';
import { TenantResolver } from './common/tenancy/tenant-resolver.interface';
import { TenantRegistry } from './common/tenancy/tenant-registry.interface';
import { StorageModule } from './common/storage/storage.module';
import { FileStorage } from './common/storage/file-storage.interface';
import { EntitlementsModule } from './common/packages/entitlements.module';
import { EntitlementProvider } from './common/packages/entitlement-provider.interface';
import { SubscriptionModule } from './common/subscription/subscription.module';
import {
  SubscriptionInfo,
  SubscriptionInfoProvider,
  SUBSCRIPTION_INFO_PROVIDER,
} from './common/subscription/subscription-info.interface';
import { INSTALLED_ADDONS } from './common/packages/installed-addons.token';
import { RateLimitModule } from './common/security/rate-limit/rate-limit.module';

import { User } from './users/entities/user.entity';
import { ActivityInterceptor } from './common/interceptors/activity.interceptor';
import { UserContextInterceptor } from './common/interceptors/user-context.interceptor';
import { AppController } from './app.controller';
import { ENTITIES } from './database/entities';
import { buildDataSourceOptions } from './database/data-source';
import { TENANT_SEEDERS, TenantSeeder } from './common/tenancy/tenant-seeder.interface';
import { TenantSeedRunner } from './common/tenancy/tenant-seed-runner.service';
import { RbacSeedService } from './auth/rbac-seed.service';
import { DefaultGroupsSeedService } from './auth/default-groups-seed.service';
import { HrReviewQuestionsSeedService } from './hr/hr-review-questions-seed.service';
import { normalizeProviderOverride, ProviderOverride } from './common/utils/provider-override.util';

export { INSTALLED_ADDONS, InstalledAddonName } from './common/packages/installed-addons.token';
export {
  SubscriptionInfo,
  SubscriptionInfoProvider,
  SUBSCRIPTION_INFO_PROVIDER,
} from './common/subscription/subscription-info.interface';
export { SubscriptionModule } from './common/subscription/subscription.module';

let hasWarnedDeprecatedIncludePremium = false;

export type Erp4uPluginModule =
  | Type<any>
  | DynamicModule
  | Promise<DynamicModule>
  | ForwardReference;

export interface Erp4uCoreModuleOptions {
  /**
   * @deprecated In open-core, premium modules are hosted externally (e.g. erp4u-cloud).
   * Retained for backward compatibility; logs a warning if true and has no effect.
   */
  includePremium?: boolean;
  /**
   * Extra plugin modules (e.g. SaaS control plane, billing, premium add-ons in erp4u-cloud).
   */
  plugins?: Erp4uPluginModule[];
  /**
   * Custom TENANT_RESOLVER provider override (default: SingleTenantResolver).
   */
  tenantResolver?: ProviderOverride<TenantResolver>;
  /**
   * Custom TENANT_REGISTRY provider override (default: SingleTenantRegistry).
   */
  tenantRegistry?: ProviderOverride<TenantRegistry>;
  /**
   * Custom ENTITLEMENT_PROVIDER override (default: ENTITLEMENTS_MODE factory).
   */
  entitlementProvider?: ProviderOverride<EntitlementProvider>;
  /**
   * Custom SUBSCRIPTION_INFO_PROVIDER override (default: NullSubscriptionInfoProvider returning null).
   */
  subscriptionInfoProvider?: ProviderOverride<SubscriptionInfoProvider>;
  /**
   * Custom FILE_STORAGE provider override (default: LocalFileStorage).
   */
  fileStorage?: ProviderOverride<FileStorage>;
  /**
   * Optional additional TypeORM entities registered by private/plugin modules.
   */
  extraEntities?: Array<Function | string>;
  /**
   * Optional custom TypeORM dataSourceFactory (default initializes PostgreSQL + tenant connection hook).
   */
  dataSourceFactory?: (options?: DataSourceOptions) => Promise<DataSource>;
  /**
   * Custom TENANT_SEEDERS provider override (default: core seeders array).
   */
  tenantSeeders?: ProviderOverride<TenantSeeder[]>;
  /**
   * Additional tenant seeders to append to the core seeders.
   */
  extraSeeders?: TenantSeeder[];
}

const DEFAULT_DATA_SOURCE_FACTORY = async (
  options?: DataSourceOptions,
): Promise<DataSource> => {
  if (!options) {
    throw new Error('Invalid TypeORM DataSource options');
  }
  const dataSource = await new DataSource(options).initialize();
  installTenantConnectionHook(dataSource);
  return dataSource;
};

@Module({})
export class Erp4uCoreModule implements OnModuleInit {
  onModuleInit() {
    validateSecurityConfig();
  }

  static forRoot(options: Erp4uCoreModuleOptions = {}): DynamicModule {
    if (options.includePremium === true && !hasWarnedDeprecatedIncludePremium) {
      new Logger('Erp4uCoreModule').warn(
        'Erp4uCoreModule: option "includePremium" is deprecated and has no effect in open-core. Premium add-on modules are hosted externally.',
      );
      hasWarnedDeprecatedIncludePremium = true;
    }

    const entities = options.extraEntities?.length
      ? [...ENTITIES, ...options.extraEntities]
      : ENTITIES;

    const plugins = options.plugins ?? [];

    return {
      module: Erp4uCoreModule,
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (configService: ConfigService) =>
            buildDataSourceOptions(
              {
                NODE_ENV: configService.get<string>('NODE_ENV'),
                DATABASE_URL: configService.get<string>('DATABASE_URL'),
                POSTGRES_URL: configService.get<string>('POSTGRES_URL'),
                DB_HOST: configService.get<string>('DB_HOST'),
                DB_PORT: configService.get<string | number>('DB_PORT'),
                DB_USERNAME: configService.get<string>('DB_USERNAME'),
                DB_PASSWORD: configService.get<string>('DB_PASSWORD'),
                DB_DATABASE: configService.get<string>('DB_DATABASE'),
              },
              {
                entities,
                synchronize: false,
                migrationsRun:
                  configService.get<string>('DB_AUTO_MIGRATE') !== 'false',
              },
            ),
          dataSourceFactory:
            options.dataSourceFactory ?? DEFAULT_DATA_SOURCE_FACTORY,
        }),
        EncryptionModule, // Column-level PII & tenant config encryption (must be available early)
        RateLimitModule, // Rate limiting guard & memory store (P7c6a)
        TenancyModule.forRoot({
          tenantResolver: options.tenantResolver,
          tenantRegistry: options.tenantRegistry,
        }),
        StorageModule.forRoot({
          fileStorage: options.fileStorage,
        }),
        CommonModule,
        UsersModule,
        AuthModule,
        EntitlementsModule.forRoot({
          entitlementProvider: options.entitlementProvider,
        }),
        SubscriptionModule.forRoot({
          subscriptionInfoProvider: options.subscriptionInfoProvider,
        }),
        ProductsModule,
        MaterialsModule,
        BomModule,
        SalesModule,
        InventoryModule,
        ProductionModule,
        PurchasingModule,
        FinanceModule,
        TasksModule,
        ProjectsModule,
        DiscussionsModule,
        NotificationsModule,
        SystemModule,
        UploadModule,
        SuppliersModule,
        CustomersModule,
        PlanningModule,
        ProcessesModule,
        CategoriesModule,
        LookupsModule,
        PublicModule,
        HrModule,
        MarketingModule, // Marketing campaigns, segments, automation
        AnnouncementsModule, // Announcements for employees
        AnalyticsModule, // Website Analytics tracking
        QCModule, // Quality Control module
        ShippingModule, // Shipping & GHTK carrier integration
        TypeOrmModule.forFeature([User]), // Needed for ActivityInterceptor
        ...plugins,
      ],
      providers: [
        {
          provide: 'APP_INTERCEPTOR',
          useClass: UserContextInterceptor, // Must run first to set context
        },
        {
          provide: 'APP_INTERCEPTOR',
          useClass: CostVisibilityInterceptor, // Cost & profit visibility filtering
        },
        {
          provide: 'APP_INTERCEPTOR',
          useClass: ActivityInterceptor,
        },
        options.tenantSeeders
          ? normalizeProviderOverride(TENANT_SEEDERS, options.tenantSeeders)
          : {
              provide: TENANT_SEEDERS,
              useFactory: (
                defaultGroups: DefaultGroupsSeedService,
                rbac: RbacSeedService,
                hr: HrReviewQuestionsSeedService,
              ): TenantSeeder[] => {
                const coreSeeders: TenantSeeder[] = [defaultGroups, rbac, hr];
                return [...coreSeeders, ...(options.extraSeeders || [])];
              },
              inject: [
                DefaultGroupsSeedService,
                RbacSeedService,
                HrReviewQuestionsSeedService,
              ],
            },
        TenantSeedRunner,
      ],
      exports: [TenancyModule, EntitlementsModule, SubscriptionModule, TENANT_SEEDERS, TenantSeedRunner],
      controllers: [AppController],
    };
  }
}
