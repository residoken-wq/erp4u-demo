import {
  DynamicModule,
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  Provider,
} from '@nestjs/common';
import {
  normalizeProviderOverride,
  ProviderOverride,
} from '../utils/provider-override.util';
import { SingleTenantRegistry } from './single-tenant.registry';
import { SingleTenantResolver } from './single-tenant.resolver';
import { TenantConfigService } from './tenant-config.service';
import { TenantConnectionHook } from './tenant-connection.hook';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TENANT_REGISTRY, TenantRegistry } from './tenant-registry.interface';
import { TENANT_RESOLVER, TenantResolver } from './tenant-resolver.interface';
import { TENANT_SEEDERS, TenantSeeder } from './tenant-seeder.interface';
import { TenantSeedRunner } from './tenant-seed-runner.service';

export interface TenancyModuleOptions {
  tenantResolver?: ProviderOverride<TenantResolver>;
  tenantRegistry?: ProviderOverride<TenantRegistry>;
  tenantSeeders?: ProviderOverride<TenantSeeder[]>;
}

const DEFAULT_TENANCY_PROVIDERS: Provider[] = [
  SingleTenantResolver,
  SingleTenantRegistry,
  {
    provide: TENANT_RESOLVER,
    useExisting: SingleTenantResolver,
  },
  {
    provide: TENANT_REGISTRY,
    useExisting: SingleTenantRegistry,
  },
  TenantConfigService,
  TenantContextMiddleware,
  TenantConnectionHook,
  TenantSeedRunner,
];

const TENANCY_EXPORTS = [
  TENANT_RESOLVER,
  TENANT_REGISTRY,
  TENANT_SEEDERS,
  SingleTenantResolver,
  SingleTenantRegistry,
  TenantConfigService,
  TenantContextMiddleware,
  TenantConnectionHook,
  TenantSeedRunner,
];

@Global()
@Module({
  providers: DEFAULT_TENANCY_PROVIDERS,
  exports: TENANCY_EXPORTS,
})
export class TenancyModule implements NestModule {
  static forRoot(options: TenancyModuleOptions = {}): DynamicModule {
    const resolverProvider: Provider = options.tenantResolver
      ? normalizeProviderOverride(TENANT_RESOLVER, options.tenantResolver)
      : {
          provide: TENANT_RESOLVER,
          useExisting: SingleTenantResolver,
        };

    const registryProvider: Provider = options.tenantRegistry
      ? normalizeProviderOverride(TENANT_REGISTRY, options.tenantRegistry)
      : {
          provide: TENANT_REGISTRY,
          useExisting: SingleTenantRegistry,
        };

    const seedersProvider: Provider = options.tenantSeeders
      ? normalizeProviderOverride(TENANT_SEEDERS, options.tenantSeeders)
      : {
          provide: TENANT_SEEDERS,
          useValue: [],
        };

    return {
      module: TenancyModule,
      global: true,
      providers: [
        SingleTenantResolver,
        SingleTenantRegistry,
        resolverProvider,
        registryProvider,
        seedersProvider,
        TenantConfigService,
        TenantContextMiddleware,
        TenantConnectionHook,
        TenantSeedRunner,
      ],
      exports: TENANCY_EXPORTS,
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
