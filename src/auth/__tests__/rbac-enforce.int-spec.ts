import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { buildDataSourceOptions } from '../../database/data-source';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../../common/tenancy/tenant-context';
import { TENANT_REGISTRY, TenantRegistry } from '../../common/tenancy/tenant-registry.interface';
import { TENANT_RESOLVER, TenantResolver } from '../../common/tenancy/tenant-resolver.interface';
import { installTenantConnectionHook } from '../../common/tenancy/tenant-connection.hook';
import { PermissionCacheService } from '../permission-cache.service';
import { RbacModeService } from '../rbac-mode.service';

const TENANT_A: TenantContext = { tenantId: 'tenant_a', schema: 'tenant_a' };
const TENANT_B: TenantContext = { tenantId: 'tenant_b', schema: 'tenant_b' };

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

describe('RBAC Enforce & Multi-Tenant Isolation (P12a Integration)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource;
  let app: INestApplication;
  let jwtService: JwtService;
  let permCacheService: PermissionCacheService;
  let rbacModeService: RbacModeService;
  let dbAvailable = false;

  const headerTenantResolver: TenantResolver = {
    async resolve(req: Request): Promise<TenantContext> {
      const headerVal = req.headers['x-test-tenant'];
      const raw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
      if (raw === 'tenant_a') return TENANT_A;
      if (raw === 'tenant_b') return TENANT_B;
      return DEFAULT_TENANT_CONTEXT;
    },
  };

  const testTenantRegistry: TenantRegistry = {
    async list(): Promise<TenantContext[]> {
      return [TENANT_A, TENANT_B];
    },
  };

  beforeAll(async () => {
    const isCiOrHost = Boolean(process.env.CI || process.env.DB_HOST);

    try {
      process.env.DB_AUTO_MIGRATE = 'false';
      process.env.SEED_ON_BOOT = 'false';

      adminDs = new DataSource(
        buildDataSourceOptions(process.env, {
          entities: [],
          migrations: [],
          synchronize: false,
          migrationsRun: false,
        }),
      );
      await adminDs.initialize();
      dbAvailable = true;
    } catch (err) {
      if (isCiOrHost) {
        // Strict failure when CI or DB_HOST is present - NO silent skip
        throw new Error(
          `PostgreSQL connection failed in CI/DB_HOST environment: ${(err as Error).message}`,
        );
      }
      console.warn('Skipping integration tests: local PostgreSQL not available.');
      return;
    }

    await adminDs.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_a" CASCADE`);
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_b" CASCADE`);
    await adminDs.query(`CREATE SCHEMA "tenant_a"`);
    await adminDs.query(`CREATE SCHEMA "tenant_b"`);

    await runMigrationsForSchema(TENANT_A.schema);
    await runMigrationsForSchema(TENANT_B.schema);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('secret123', salt);

    // Setup tenant_a:
    // Group 1: Admin
    // Group 3: Production Viewer (has PRODUCTION:view)
    // Group 4: Sales Only (no PRODUCTION:view)
    await adminDs.query(
      `INSERT INTO "tenant_a"."user_groups" ("id", "name", "description") VALUES
       (1, 'Admin', 'Admin group'),
       (3, 'Production Team', 'Production group'),
       (4, 'Sales Team', 'Sales group')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete") VALUES
       (3, 'PRODUCTION', true, false, false, false),
       (3, 'SALES', true, false, false, false),
       (4, 'SALES', true, false, false, false)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES
       (1, 'admin', '${passwordHash}', 'Admin User A', 1, true),
       (10, 'prod_user_a', '${passwordHash}', 'Prod User A', 3, true),
       (11, 'sales_user_a', '${passwordHash}', 'Sales User A', 4, true)
       ON CONFLICT DO NOTHING`,
    );

    // Setup tenant_b:
    // Identical group_id = 3, but in tenant_b group 3 does NOT have SALES:view or PRODUCTION:view
    await adminDs.query(
      `INSERT INTO "tenant_b"."user_groups" ("id", "name", "description") VALUES
       (1, 'Admin', 'Admin group'),
       (3, 'Guest Team', 'Guest group with no permissions')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_b"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES
       (1, 'admin', '${passwordHash}', 'Admin User B', 1, true),
       (20, 'guest_user_b', '${passwordHash}', 'Guest User B', 3, true)
       ON CONFLICT DO NOTHING`,
    );

    // Set tenant_a to ENFORCE, tenant_b to SHADOW
    await adminDs.query(
      `INSERT INTO "tenant_a"."system_configs" ("key", "value", "description") VALUES ('RBAC_MODE', 'ENFORCE', 'RBAC') ON CONFLICT ("key") DO UPDATE SET "value" = 'ENFORCE'`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_b"."system_configs" ("key", "value", "description") VALUES ('RBAC_MODE', 'SHADOW', 'RBAC') ON CONFLICT ("key") DO UPDATE SET "value" = 'SHADOW'`,
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TENANT_RESOLVER)
      .useValue(headerTenantResolver)
      .overrideProvider(TENANT_REGISTRY)
      .useValue(testTenantRegistry)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    jwtService = moduleRef.get(JwtService);
    permCacheService = moduleRef.get(PermissionCacheService);
    rbacModeService = moduleRef.get(RbacModeService);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (adminDs && adminDs.isInitialized) {
      await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_a" CASCADE`);
      await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_b" CASCADE`);
      await adminDs.destroy();
    }
  });

  it('same group_id = 3 has isolated permissions between tenant_a and tenant_b within cache TTL', async () => {
    if (!dbAvailable) return;

    permCacheService.clearAll();

    // In tenant_a, group 3 has SALES:view
    const allowedA = await TenantContext.run(TENANT_A, async () => {
      return permCacheService.hasAny(3, [{ module: 'SALES', action: 'view' }]);
    });
    expect(allowedA).toBe(true);

    // In tenant_b, group 3 does NOT have SALES:view
    const allowedB = await TenantContext.run(TENANT_B, async () => {
      return permCacheService.hasAny(3, [{ module: 'SALES', action: 'view' }]);
    });
    expect(allowedB).toBe(false);

    // Alternating calls within cache TTL
    expect(
      await TenantContext.run(TENANT_A, () =>
        permCacheService.hasAny(3, [{ module: 'SALES', action: 'view' }]),
      ),
    ).toBe(true);
    expect(
      await TenantContext.run(TENANT_B, () =>
        permCacheService.hasAny(3, [{ module: 'SALES', action: 'view' }]),
      ),
    ).toBe(false);
  });

  it('ENFORCE in tenant_a blocks user without PRODUCTION:view (403), allows user with permission (200)', async () => {
    if (!dbAvailable) return;

    rbacModeService.clearAllCache();

    // Token for sales_user_a (group 4, no PRODUCTION:view)
    const tokenNoPerm = jwtService.sign({
      sub: 11,
      username: 'sales_user_a',
      group_id: 4,
      tid: 'tenant_a',
    });

    // Token for prod_user_a (group 3, has PRODUCTION:view)
    const tokenWithPerm = jwtService.sign({
      sub: 10,
      username: 'prod_user_a',
      group_id: 3,
      tid: 'tenant_a',
    });

    // sales_user_a calls GET /api/planning (@Perm('PRODUCTION', 'view')) -> 403
    const resForbidden = await request(app.getHttpServer())
      .get('/api/planning')
      .set('X-Test-Tenant', 'tenant_a')
      .set('Authorization', `Bearer ${tokenNoPerm}`);

    expect(resForbidden.status).toBe(403);
    expect(resForbidden.body.message).toContain('PRODUCTION');

    // prod_user_a calls same endpoint -> 200
    const resAllowed = await request(app.getHttpServer())
      .get('/api/planning')
      .set('X-Test-Tenant', 'tenant_a')
      .set('Authorization', `Bearer ${tokenWithPerm}`);

    expect(resAllowed.status).toBe(200);
  });

  it('SHADOW in tenant_b allows user lacking permission (200) and records DENY_NO_PERM in access logs', async () => {
    if (!dbAvailable) return;

    rbacModeService.clearAllCache();

    // Token for guest_user_b in tenant_b (group 3, no PRODUCTION:view)
    const tokenGuest = jwtService.sign({
      sub: 20,
      username: 'guest_user_b',
      group_id: 3,
      tid: 'tenant_b',
    });

    // Call GET /api/planning in tenant_b (which is in SHADOW mode) -> 200
    const resShadow = await request(app.getHttpServer())
      .get('/api/planning')
      .set('X-Test-Tenant', 'tenant_b')
      .set('Authorization', `Bearer ${tokenGuest}`);

    expect(resShadow.status).toBe(200);

    // Verify log recorded in tenant_b
    const logs = await adminDs.query(
      `SELECT * FROM "tenant_b"."rbac_access_logs" WHERE "decision" = 'DENY_NO_PERM' AND "route" LIKE '%planning%'`,
    );
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].mode).toBe('SHADOW');
  });

  it('GET /api/rbac/readiness does not leak any username or IP addresses', async () => {
    if (!dbAvailable) return;

    const tokenAdmin = jwtService.sign({
      sub: 1,
      username: 'admin',
      group_id: 1,
      tid: 'tenant_b',
    });

    const res = await request(app.getHttpServer())
      .get('/api/rbac/readiness?days=7')
      .set('X-Test-Tenant', 'tenant_b')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('days');
    expect(res.body).toHaveProperty('routes');
    expect(Array.isArray(res.body.routes)).toBe(true);

    const jsonStr = JSON.stringify(res.body);

    // Absolute privacy: no username, no personal ip returned
    expect(jsonStr).not.toContain('guest_user_b');
    expect(jsonStr).not.toContain('admin');
    expect(jsonStr).not.toContain('127.0.0.1');

    for (const r of res.body.routes) {
      expect(r).not.toHaveProperty('username');
      expect(r).not.toHaveProperty('user_id');
      expect(r).not.toHaveProperty('ip');
      expect(r).not.toHaveProperty('ips');
      expect(r).toHaveProperty('would_deny');
      expect(r).toHaveProperty('distinct_users');
    }
  });
});
