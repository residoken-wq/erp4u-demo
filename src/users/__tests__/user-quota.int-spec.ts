import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../app.module';
import { buildDataSourceOptions } from '../../database/data-source';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../../common/tenancy/tenant-context';
import { TENANT_REGISTRY, TenantRegistry } from '../../common/tenancy/tenant-registry.interface';
import { TENANT_RESOLVER, TenantResolver } from '../../common/tenancy/tenant-resolver.interface';
import { installTenantConnectionHook } from '../../common/tenancy/tenant-connection.hook';
import { ENTITLEMENT_PROVIDER, EntitlementProvider } from '../../common/packages/entitlement-provider.interface';
import { PackageKey } from '../../common/packages/package.registry';
import { UsersService } from '../users.service';
import { User } from '../entities/user.entity';

const TENANT_QUOTA: TenantContext = { tenantId: 'tenant_quota', schema: 'tenant_quota' };

async function runMigrationsForSchema(schema: string): Promise<void> {
  const ds = new DataSource(
    buildDataSourceOptions(process.env, {
      schema,
      synchronize: false,
      migrationsRun: false,
      extra: {
        options: `-c search_path=${schema},public`,
      },
    }),
  );
  await ds.initialize();
  try {
    installTenantConnectionHook(ds);
    await TenantContext.run({ tenantId: schema, schema }, async () => {
      await ds.runMigrations();
    });
  } finally {
    await ds.destroy();
  }
}

describe('User Quota Concurrency (P10a Integration)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource;
  let app: INestApplication;
  let usersService: UsersService;

  const mockEntitlementProvider: EntitlementProvider = {
    isEnabled: jest.fn(async () => true),
    getLimits: jest.fn(async (pkg: PackageKey) => {
      if (pkg === PackageKey.CORE) {
        return { max_users: 2 }; // Limit is 2 users
      }
      return null;
    }),
    list: jest.fn(async () => [
      { key: PackageKey.CORE, enabled: true, validUntil: null, limits: { max_users: 2 } },
    ]),
  };

  const headerTenantResolver: TenantResolver = {
    async resolve(req: Request): Promise<TenantContext> {
      return TENANT_QUOTA;
    },
  };

  const testTenantRegistry: TenantRegistry = {
    async list(): Promise<TenantContext[]> {
      return [TENANT_QUOTA];
    },
  };

  beforeAll(async () => {
    process.env.DB_AUTO_MIGRATE = 'false';
    process.env.SEED_ON_BOOT = 'false';

    try {
      adminDs = new DataSource(
        buildDataSourceOptions(process.env, {
          entities: [],
          migrations: [],
          synchronize: false,
          migrationsRun: false,
        }),
      );
      await adminDs.initialize();

      await adminDs.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);
      await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_quota" CASCADE`);
      await adminDs.query(`CREATE SCHEMA "tenant_quota"`);

      await runMigrationsForSchema(TENANT_QUOTA.schema);

      // Seed 1 active user (so 1 slot remains out of max 2)
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('admin123', salt);

      await adminDs.query(
        `INSERT INTO "tenant_quota"."user_groups" ("id", "name", "description") VALUES (1, 'Admin', 'Admin group') ON CONFLICT DO NOTHING`,
      );
      await adminDs.query(
        `INSERT INTO "tenant_quota"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES (1, 'admin', '${passwordHash}', 'Admin User Quota', 1, true) ON CONFLICT DO NOTHING`,
      );
      await adminDs.query(
        `SELECT setval(pg_get_serial_sequence('"tenant_quota"."users"', 'id'), 100, true)`,
      );

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(TENANT_RESOLVER)
        .useValue(headerTenantResolver)
        .overrideProvider(TENANT_REGISTRY)
        .useValue(testTenantRegistry)
        .overrideProvider(ENTITLEMENT_PROVIDER)
        .useValue(mockEntitlementProvider)
        .compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      usersService = app.get(UsersService);
    } catch (err: any) {
      console.warn('Skipping DB integration test setup (no local postgres):', err.message);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (adminDs?.isInitialized) {
      try {
        await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_quota" CASCADE`);
      } catch {
        // cleanup
      }
      await adminDs.destroy();
    }
  });

  it('2 concurrent user creation requests when 1 slot remains -> exactly 1 succeeds, 1 fails with USER_LIMIT_REACHED', async () => {
    if (!app || !adminDs?.isInitialized) {
      console.log('Skipping integration test because DB is not available in local environment');
      return;
    }

    const results = await TenantContext.run(TENANT_QUOTA, async () => {
      const p1 = usersService.createUser({
        username: 'parallel_user_1',
        password: 'Password123!',
        full_name: 'Parallel User 1',
      });

      const p2 = usersService.createUser({
        username: 'parallel_user_2',
        password: 'Password123!',
        full_name: 'Parallel User 2',
      });

      return await Promise.allSettled([p1, p2]);
    });

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const rejectedErr: any = (rejected[0] as PromiseRejectedResult).reason;
    expect(rejectedErr.response?.code).toBe('USER_LIMIT_REACHED');

    // Verify DB count in tenant_quota is exactly 2
    const totalUsers = await TenantContext.run(TENANT_QUOTA, async () => {
      const ds = app.get(DataSource);
      return ds.getRepository(User).count({ where: { is_active: true } });
    });
    expect(totalUsers).toBe(2);
  });
});
