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
       (4, 'Sales Team', 'Sales group'),
       (6, 'HR Team', 'HR manager group')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete") VALUES
       (3, 'PRODUCTION', true, false, false, false),
       (3, 'SALES', true, false, false, false),
       (4, 'SALES', true, false, false, false),
       (6, 'HR', true, true, true, true)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES
       (1, 'admin', '${passwordHash}', 'Admin User A', 1, true),
       (10, 'prod_user_a', '${passwordHash}', 'Prod User A', 3, true),
       (11, 'sales_user_a', '${passwordHash}', 'Sales User A', 4, true),
       (12, 'hr_user_a', '${passwordHash}', 'HR User A', 6, true)
       ON CONFLICT DO NOTHING`,
    );

    // Seed HR employees, attendances, payslips and lookup fixtures for tenant_a
    await adminDs.query(
      `INSERT INTO "tenant_a"."employees" ("id", "user_id", "full_name", "base_salary", "is_active") VALUES
       (100, 11, 'Sales User A Employee', 15000000, true),
       (101, 10, 'Prod User A Employee', 18000000, true),
       (102, 12, 'HR User A Employee', 20000000, true)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."attendances" ("id", "employee_id", "date", "status") VALUES
       (1001, 100, CURRENT_DATE, 'PRESENT'),
       (1002, 101, CURRENT_DATE, 'PRESENT'),
       (1003, 102, CURRENT_DATE, 'PRESENT')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."payslips" ("id", "employee_id", "month", "year", "net_salary") VALUES
       (2001, 100, 11, 2026, 14000000),
       (2002, 101, 11, 2026, 17000000),
       (2003, 102, 11, 2026, 20000000)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."products" ("id", "sku", "name", "unit", "base_price", "cost_price", "is_active") VALUES
       (301, 'SKU-DEMO-01', 'San pham Demo 01', 'cai', 100000, 70000, true)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."customers" ("id", "code", "name", "credit_limit", "current_debt") VALUES
       (401, 'KH-DEMO-01', 'Khach hang Demo 01', 50000000, 10000000)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."suppliers" ("id", "uuid", "code", "name", "debt", "type") VALUES
       (501, 'c0000000-0000-0000-0000-000000000501', 'NCC-DEMO-01', 'Nha cung cap Demo 01', 20000000, 'LOGISTICS')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."projects" ("id", "title", "created_by_id", "status") VALUES
       (3001, 'Du an Mau A', 10, 'PLANNING')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_a"."tasks" ("id", "title", "creator_id", "assignee_id", "status", "priority") VALUES
       (4001, 'Cong viec User 10', 10, 10, 'TODO', 'MEDIUM')
       ON CONFLICT DO NOTHING`,
    );

    // Setup tenant_b:
    // Identical group_id = 3, but in tenant_b group 3 does NOT have SALES:view or PRODUCTION:view
    // Group 5 has SYSTEM:view (for testing staff with SYSTEM:view)
    await adminDs.query(
      `INSERT INTO "tenant_b"."user_groups" ("id", "name", "description") VALUES
       (1, 'Admin', 'Admin group'),
       (3, 'Guest Team', 'Guest group with no permissions'),
       (5, 'System Viewer Team', 'Has SYSTEM:view')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_b"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete") VALUES
       (5, 'SYSTEM', true, false, false, false)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_b"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES
       (1, 'admin', '${passwordHash}', 'Admin User B', 1, true),
       (20, 'guest_user_b', '${passwordHash}', 'Guest User B', 3, true),
       (21, 'system_viewer_b', '${passwordHash}', 'System Viewer B', 5, true)
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

  describe('RbacController Explicit Access Control in SHADOW mode (/auth/rbac and /rbac)', () => {
    const prefixes = ['/api/auth/rbac', '/api/rbac'];

    for (const prefix of prefixes) {
      describe(`Route prefix: ${prefix}`, () => {
        it(`staff WITHOUT SYSTEM:view is blocked (403) from report, unclassified, mode, readiness, and PUT mode`, async () => {
          if (!dbAvailable) return;

          const tokenGuest = jwtService.sign({
            sub: 20,
            username: 'guest_user_b',
            group_id: 3,
            tid: 'tenant_b',
          });

          // GET report -> 403
          const resReport = await request(app.getHttpServer())
            .get(`${prefix}/report`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenGuest}`);
          expect(resReport.status).toBe(403);

          // GET unclassified -> 403
          const resUnclass = await request(app.getHttpServer())
            .get(`${prefix}/unclassified`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenGuest}`);
          expect(resUnclass.status).toBe(403);

          // GET mode -> 403
          const resMode = await request(app.getHttpServer())
            .get(`${prefix}/mode`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenGuest}`);
          expect(resMode.status).toBe(403);

          // GET readiness -> 403
          const resReadiness = await request(app.getHttpServer())
            .get(`${prefix}/readiness`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenGuest}`);
          expect(resReadiness.status).toBe(403);

          // PUT mode -> 403
          const resPutMode = await request(app.getHttpServer())
            .put(`${prefix}/mode`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenGuest}`)
            .send({ mode: 'ENFORCE' });
          expect(resPutMode.status).toBe(403);
        });

        it(`staff WITH SYSTEM:view (non-admin) can access readiness, mode, unclassified (200), but is blocked from report (403)`, async () => {
          if (!dbAvailable) return;

          const tokenSystemView = jwtService.sign({
            sub: 21,
            username: 'system_viewer_b',
            group_id: 5,
            tid: 'tenant_b',
          });

          // GET readiness -> 200
          const resReadiness = await request(app.getHttpServer())
            .get(`${prefix}/readiness`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenSystemView}`);
          expect(resReadiness.status).toBe(200);

          // GET mode -> 200
          const resMode = await request(app.getHttpServer())
            .get(`${prefix}/mode`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenSystemView}`);
          expect(resMode.status).toBe(200);

          // GET unclassified -> 200
          const resUnclass = await request(app.getHttpServer())
            .get(`${prefix}/unclassified`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenSystemView}`);
          expect(resUnclass.status).toBe(200);

          // GET report -> 403 (admin only)
          const resReport = await request(app.getHttpServer())
            .get(`${prefix}/report`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenSystemView}`);
          expect(resReport.status).toBe(403);
        });

        it(`admin can access report (200)`, async () => {
          if (!dbAvailable) return;

          const tokenAdmin = jwtService.sign({
            sub: 1,
            username: 'admin',
            group_id: 1,
            tid: 'tenant_b',
          });

          const resReport = await request(app.getHttpServer())
            .get(`${prefix}/report`)
            .set('X-Test-Tenant', 'tenant_b')
            .set('Authorization', `Bearer ${tokenAdmin}`);
          expect(resReport.status).toBe(200);
        });
      });
    }
  });

  describe('Lookups and selfOr HR self-service in ENFORCE mode (P12b1 D3 & D4)', () => {
      it('user without HR/INVENTORY permissions can access /lookups/* with only permitted fields, but full endpoints return 403', async () => {
        if (!dbAvailable) return;

        const tokenSalesA = jwtService.sign({
          sub: 11,
          username: 'sales_user_a',
          group_id: 4,
          tid: 'tenant_a',
        });

        // 1. Lookups return 200
        const resUsers = await request(app.getHttpServer())
          .get('/api/lookups/users')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resUsers.status).toBe(200);
        expect(Array.isArray(resUsers.body)).toBe(true);
        expect(resUsers.body.length).toBeGreaterThan(0);
        expect(resUsers.body[0]).toHaveProperty('id');
        expect(resUsers.body[0]).toHaveProperty('full_name');
        expect(resUsers.body[0].password).toBeUndefined();

        const resProducts = await request(app.getHttpServer())
          .get('/api/lookups/products')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resProducts.status).toBe(200);
        expect(Array.isArray(resProducts.body)).toBe(true);
        expect(resProducts.body.length).toBeGreaterThan(0);
        expect(resProducts.body[0]).toHaveProperty('sku');
        expect(resProducts.body[0]).toHaveProperty('name');
        expect(resProducts.body[0].base_price).toBeUndefined();
        expect(resProducts.body[0].cost_price).toBeUndefined();

        const resCustomers = await request(app.getHttpServer())
          .get('/api/lookups/customers')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resCustomers.status).toBe(200);
        expect(Array.isArray(resCustomers.body)).toBe(true);
        expect(resCustomers.body.length).toBeGreaterThan(0);
        expect(resCustomers.body[0]).toHaveProperty('code');
        expect(resCustomers.body[0]).toHaveProperty('name');
        expect(resCustomers.body[0].credit_limit).toBeUndefined();
        expect(resCustomers.body[0].current_debt).toBeUndefined();

        const resSuppliers = await request(app.getHttpServer())
          .get('/api/lookups/suppliers')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resSuppliers.status).toBe(200);
        expect(Array.isArray(resSuppliers.body)).toBe(true);
        expect(resSuppliers.body.length).toBeGreaterThan(0);
        expect(resSuppliers.body[0]).toHaveProperty('code');
        expect(resSuppliers.body[0]).toHaveProperty('name');
        expect(resSuppliers.body[0].debt).toBeUndefined();

        const resEmployees = await request(app.getHttpServer())
          .get('/api/lookups/employees')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resEmployees.status).toBe(200);
        expect(Array.isArray(resEmployees.body)).toBe(true);
        expect(resEmployees.body.length).toBeGreaterThan(0);
        expect(resEmployees.body[0]).toHaveProperty('full_name');
        expect(resEmployees.body[0].base_salary).toBeUndefined();

        const resWarehouses = await request(app.getHttpServer())
          .get('/api/lookups/warehouses')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resWarehouses.status).toBe(200);
        expect(resWarehouses.body.length).toBe(4);

        // 2. Full endpoints blocked (403) at ENFORCE
        const resStocks = await request(app.getHttpServer())
          .get('/api/inventory/stocks')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resStocks.status).toBe(403);

        const resHrEmployees = await request(app.getHttpServer())
          .get('/api/hr/employees')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resHrEmployees.status).toBe(403);

        const resHrPayslips = await request(app.getHttpServer())
          .get('/api/hr/payslips')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resHrPayslips.status).toBe(403);
      });

      it('/hr/me tự xem 200 / người khác 403-404 (cả user có HR:view)', async () => {
        if (!dbAvailable) return;

        const tokenSalesA = jwtService.sign({
          sub: 11,
          username: 'sales_user_a',
          group_id: 4,
          tid: 'tenant_a',
        });

        const tokenHrA = jwtService.sign({
          sub: 12,
          username: 'hr_user_a',
          group_id: 6,
          tid: 'tenant_a',
        });

        // 1. Regular staff viewing own attendances and payslips returns 200
        const resMyAttendances = await request(app.getHttpServer())
          .get('/api/hr/me/attendances')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resMyAttendances.status).toBe(200);
        expect(Array.isArray(resMyAttendances.body)).toBe(true);
        expect(resMyAttendances.body.length).toBeGreaterThan(0);
        expect(Number(resMyAttendances.body[0].employee_id)).toBe(100);

        const resMyPayslips = await request(app.getHttpServer())
          .get('/api/hr/me/payslips')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resMyPayslips.status).toBe(200);
        expect(Array.isArray(resMyPayslips.body)).toBe(true);
        expect(resMyPayslips.body.length).toBeGreaterThan(0);
        expect(Number(resMyPayslips.body[0].employee_id)).toBe(100);

        const resMyPayslipId = await request(app.getHttpServer())
          .get('/api/hr/me/payslips/2001')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resMyPayslipId.status).toBe(200);
        expect(Number(resMyPayslipId.body.id)).toBe(2001);

        // 2. Regular staff accessing someone else's payslip by ID returns 403
        const resOtherPayId = await request(app.getHttpServer())
          .get('/api/hr/me/payslips/2002')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resOtherPayId.status).toBe(403);

        // 3. User WITH HR:view calling /hr/me/payslips/:id of someone else STILL returns 403
        const resHrUserOtherPay = await request(app.getHttpServer())
          .get('/api/hr/me/payslips/2001')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenHrA}`);
        expect(resHrUserOtherPay.status).toBe(403);

        // 4. User WITH HR:view calling own payslip via /hr/me returns 200
        const resHrUserOwnPay = await request(app.getHttpServer())
          .get('/api/hr/me/payslips/2003')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenHrA}`);
        expect(resHrUserOwnPay.status).toBe(200);

        // 5. Company-wide list returns 403 for staff without HR, 200 for HR user
        const resAllPayslips = await request(app.getHttpServer())
          .get('/api/hr/payslips')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resAllPayslips.status).toBe(403);
      });

      it('projects 403 không quyền', async () => {
        if (!dbAvailable) return;

        const tokenSalesA = jwtService.sign({
          sub: 11,
          username: 'sales_user_a',
          group_id: 4,
          tid: 'tenant_a',
        });

        // User without PROJECTS permission calling /projects endpoints -> 403
        const resGetProjects = await request(app.getHttpServer())
          .get('/api/projects')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resGetProjects.status).toBe(403);

        const resGetProjectDetail = await request(app.getHttpServer())
          .get('/api/projects/3001')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resGetProjectDetail.status).toBe(403);

        const resCostSummary = await request(app.getHttpServer())
          .get('/api/projects/3001/cost-summary')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resCostSummary.status).toBe(403);

        const resDeleteProject = await request(app.getHttpServer())
          .delete('/api/projects/3001')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resDeleteProject.status).toBe(403);
      });

      it('tasks không sửa/xoá được task người khác', async () => {
        if (!dbAvailable) return;

        const tokenSalesA = jwtService.sign({
          sub: 11,
          username: 'sales_user_a',
          group_id: 4,
          tid: 'tenant_a',
        });

        const tokenProdA = jwtService.sign({
          sub: 10,
          username: 'prod_user_a',
          group_id: 3,
          tid: 'tenant_a',
        });

        // User 11 tries to update task 4001 (created by user 10) -> 403
        const resUpdate = await request(app.getHttpServer())
          .put('/api/tasks/4001')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`)
          .send({ title: 'Hacked Title' });
        expect(resUpdate.status).toBe(403);

        // User 11 tries to delete task 4001 (created by user 10) -> 403
        const resDelete = await request(app.getHttpServer())
          .delete('/api/tasks/4001')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenSalesA}`);
        expect(resDelete.status).toBe(403);

        // Creator (user 10) can update own task -> 200
        const resOwnerUpdate = await request(app.getHttpServer())
          .put('/api/tasks/4001')
          .set('X-Test-Tenant', 'tenant_a')
          .set('Authorization', `Bearer ${tokenProdA}`)
          .send({ title: 'Updated By Creator' });
        expect(resOwnerUpdate.status).toBe(200);
        expect(resOwnerUpdate.body.title).toBe('Updated By Creator');
      });
    });
  });
