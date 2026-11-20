import { TenantContext } from '../tenant-context';
import { TenantRegistry } from '../tenant-registry.interface';
import { TenantSeeder } from '../tenant-seeder.interface';
import { TenantSeedRunner } from '../tenant-seed-runner.service';

describe('TenantSeedRunner (Unit)', () => {
  const tenantA: TenantContext = { tenantId: 'tenant_a', schema: 'tenant_a' };
  const tenantB: TenantContext = { tenantId: 'tenant_b', schema: 'tenant_b' };

  it('runs seeders inside TenantContext for each registered tenant', async () => {
    const executions: Array<{ tenantId: string; seeder: string }> = [];

    const seeder1: TenantSeeder = {
      name: 'seeder-1',
      async seed() {
        const cur = TenantContext.current();
        executions.push({ tenantId: cur.tenantId, seeder: 'seeder-1' });
      },
    };

    const seeder2: TenantSeeder = {
      name: 'seeder-2',
      async seed() {
        const cur = TenantContext.current();
        executions.push({ tenantId: cur.tenantId, seeder: 'seeder-2' });
      },
    };

    const mockRegistry: TenantRegistry = {
      async list() {
        return [tenantA, tenantB];
      },
    };

    const runner = new TenantSeedRunner([seeder1, seeder2], mockRegistry);
    await runner.runForAllTenants();

    expect(executions).toEqual([
      { tenantId: 'tenant_a', seeder: 'seeder-1' },
      { tenantId: 'tenant_a', seeder: 'seeder-2' },
      { tenantId: 'tenant_b', seeder: 'seeder-1' },
      { tenantId: 'tenant_b', seeder: 'seeder-2' },
    ]);
  });

  it('is idempotent: running twice preserves state without duplicating records', async () => {
    const dbStore = new Map<string, number>();

    const idempotentSeeder: TenantSeeder = {
      name: 'idempotent-counter-seeder',
      async seed() {
        const cur = TenantContext.current();
        // If already seeded for this tenant, skip
        if (dbStore.has(cur.tenantId)) {
          return;
        }
        dbStore.set(cur.tenantId, 1);
      },
    };

    const runner = new TenantSeedRunner([idempotentSeeder], {
      async list() {
        return [tenantA];
      },
    });

    // Run 1
    await runner.runForTenant(tenantA);
    expect(dbStore.get('tenant_a')).toBe(1);

    // Run 2 (idempotent run)
    await runner.runForTenant(tenantA);
    expect(dbStore.get('tenant_a')).toBe(1);
    expect(dbStore.size).toBe(1);
  });

  it('fails fast: re-throws if a seeder fails so provisioning marks failed', async () => {
    const failingSeeder: TenantSeeder = {
      name: 'failing-seeder',
      async seed() {
        throw new Error('Database disk full during seed');
      },
    };

    const runner = new TenantSeedRunner([failingSeeder], {
      async list() {
        return [tenantA];
      },
    });

    await expect(runner.runForTenant(tenantA)).rejects.toThrow(
      'Database disk full during seed',
    );
  });

  it('respects SEED_ON_BOOT=false to skip execution on bootstrap', async () => {
    const executed: string[] = [];
    const seeder: TenantSeeder = {
      name: 'test-seeder',
      async seed() {
        executed.push(TenantContext.current().tenantId);
      },
    };

    const runner = new TenantSeedRunner([seeder], {
      async list() {
        return [tenantA];
      },
    });

    const oldEnv = process.env.SEED_ON_BOOT;
    try {
      process.env.SEED_ON_BOOT = 'false';
      await runner.onApplicationBootstrap();
      expect(executed).toHaveLength(0);

      delete process.env.SEED_ON_BOOT;
      await runner.onApplicationBootstrap();
      expect(executed).toEqual(['tenant_a']);
    } finally {
      if (oldEnv !== undefined) {
        process.env.SEED_ON_BOOT = oldEnv;
      } else {
        delete process.env.SEED_ON_BOOT;
      }
    }
  });
});
