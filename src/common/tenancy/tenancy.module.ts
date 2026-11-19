import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SingleTenantRegistry } from './single-tenant.registry';
import { SingleTenantResolver } from './single-tenant.resolver';
import { TenantConnectionHook } from './tenant-connection.hook';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TENANT_REGISTRY } from './tenant-registry.interface';
import { TENANT_RESOLVER } from './tenant-resolver.interface';

@Global()
@Module({
  providers: [
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
    TenantContextMiddleware,
    TenantConnectionHook,
  ],
  exports: [
    TENANT_RESOLVER,
    TENANT_REGISTRY,
    SingleTenantResolver,
    SingleTenantRegistry,
    TenantContextMiddleware,
    TenantConnectionHook,
  ],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
