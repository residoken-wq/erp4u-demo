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

export interface TenancyModuleOptions {
  tenantResolver?: ProviderOverride<TenantResolver>;
  tenantRegistry?: ProviderOverride<TenantRegistry>;
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
];

const TENANCY_EXPORTS = [
  TENANT_RESOLVER,
  TENANT_REGISTRY,
  SingleTenantResolver,
  SingleTenantRegistry,
  TenantConfigService,
  TenantContextMiddleware,
  TenantConnectionHook,
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

    return {
      module: TenancyModule,
      global: true,
      providers: [
        SingleTenantResolver,
        SingleTenantRegistry,
        resolverProvider,
        registryProvider,
        TenantConfigService,
        TenantContextMiddleware,
        TenantConnectionHook,
      ],
      exports: TENANCY_EXPORTS,
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
