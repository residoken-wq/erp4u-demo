import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Optional,
} from '@nestjs/common';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from './tenant-context';
import {
  TENANT_REGISTRY,
  TenantRegistry,
} from './tenant-registry.interface';
import {
  TENANT_SEEDERS,
  TenantSeeder,
} from './tenant-seeder.interface';

@Injectable()
export class TenantSeedRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantSeedRunner.name);

  constructor(
    @Optional()
    @Inject(TENANT_SEEDERS)
    private readonly seedersProvider?: TenantSeeder[] | TenantSeeder,
    @Optional()
    @Inject(TENANT_REGISTRY)
    private readonly tenantRegistry?: TenantRegistry,
  ) {}

  private getSeeders(): TenantSeeder[] {
    if (!this.seedersProvider) return [];
    if (Array.isArray(this.seedersProvider)) {
      return this.seedersProvider.filter(Boolean);
    }
    return [this.seedersProvider];
  }

  async runForTenant(ctx: TenantContext): Promise<void> {
    const seeders = this.getSeeders();
    if (seeders.length === 0) {
      this.logger.debug(`[${ctx.tenantId}] No tenant seeders registered.`);
      return;
    }

    this.logger.log(
      `[${ctx.tenantId}] Starting seeders (${seeders.length}) for schema "${ctx.schema}"...`,
    );

    await TenantContext.run(ctx, async () => {
      for (const seeder of seeders) {
        const start = Date.now();
        this.logger.log(`[${ctx.tenantId}] Running seeder "${seeder.name}"...`);
        try {
          await seeder.seed();
          const elapsed = Date.now() - start;
          this.logger.log(
            `[${ctx.tenantId}] Seeder "${seeder.name}" completed in ${elapsed}ms`,
          );
        } catch (err: any) {
          const elapsed = Date.now() - start;
          this.logger.error(
            `[${ctx.tenantId}] Seeder "${seeder.name}" failed after ${elapsed}ms: ${err?.message || err}`,
            err?.stack,
          );
          throw err;
        }
      }
    });

    this.logger.log(`[${ctx.tenantId}] All seeders completed successfully.`);
  }

  async runForAllTenants(): Promise<void> {
    const tenants: TenantContext[] = this.tenantRegistry
      ? await this.tenantRegistry.list()
      : [DEFAULT_TENANT_CONTEXT];

    this.logger.log(
      `Running seeders for ${tenants.length} registered tenant(s)...`,
    );
    for (const tenantCtx of tenants) {
      await this.runForTenant(tenantCtx);
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.SEED_ON_BOOT !== 'false') {
      this.logger.log(
        'SEED_ON_BOOT enabled: executing tenant seeders on boot...',
      );
      await this.runForAllTenants();
    } else {
      this.logger.log('SEED_ON_BOOT=false: skipping boot-time tenant seeders.');
    }
  }
}
