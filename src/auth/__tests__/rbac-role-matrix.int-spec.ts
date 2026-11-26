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
import { DEFAULT_GROUP_TEMPLATES } from '../default-group-templates';

const TENANT_MATRIX: TenantContext = {
  tenantId: 'tenant_matrix',
  schema: 'tenant_matrix',
};

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

describe('RBAC Role Matrix at ENFORCE Mode (Integration - Task P12b2 D4)', () => {
  jest.setTimeout(180_000);

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
      if (raw === 'tenant_matrix') return TENANT_MATRIX;
      return DEFAULT_TENANT_CONTEXT;
    },
  };

  const testTenantRegistry: TenantRegistry = {
    async list(): Promise<TenantContext[]> {
      return [TENANT_MATRIX];
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
        throw new Error(
          `PostgreSQL connection failed in CI/DB_HOST environment: ${(err as Error).message}`,
        );
      }
      console.warn('Skipping integration tests: local PostgreSQL not available.');
      return;
    }

    await adminDs.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_matrix" CASCADE`);
    await adminDs.query(`CREATE SCHEMA "tenant_matrix"`);

    await runMigrationsForSchema(TENANT_MATRIX.schema);

    // Set ENFORCE mode for tenant_matrix
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."system_configs" ("key", "value", "description") VALUES
       ('RBAC_MODE', 'ENFORCE', 'RBAC')
       ON CONFLICT ("key") DO UPDATE SET "value" = 'ENFORCE'`,
    );

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('secret123', salt);

    // Seed the 7 default groups and their exact permissions
    for (let i = 0; i < DEFAULT_GROUP_TEMPLATES.length; i++) {
      const t = DEFAULT_GROUP_TEMPLATES[i];
      const groupId = i + 1;
      await adminDs.query(
        `INSERT INTO "tenant_matrix"."user_groups" ("id", "name", "description") VALUES ($1, $2, $3)`,
        [groupId, t.name, t.description],
      );

      for (const p of t.permissions) {
        await adminDs.query(
          `INSERT INTO "tenant_matrix"."group_permissions"
           ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete", "view_cost_price")
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            groupId,
            p.module_code,
            !!p.can_view,
            !!p.can_create,
            !!p.can_update,
            !!p.can_delete,
            !!p.view_cost_price,
          ],
        );
      }
    }

    // Seed 1 user for each role:
    // User 1: user_admin (Group 1 - Quản trị, non-'admin' username to test permission table)
    // User 2: user_sales (Group 2 - Kinh doanh)
    // User 3: user_warehouse (Group 3 - Kho)
    // User 4: user_purchasing (Group 4 - Mua hàng)
    // User 5: user_production (Group 5 - Sản xuất)
    // User 6: user_accounting (Group 6 - Kế toán)
    // User 7: user_hr (Group 7 - Nhân sự)
    // User 8: admin (Superadmin with username === 'admin', Group 1)
    const usersData = [
      { id: 1, username: 'user_admin', groupId: 1, name: 'Quản trị viên' },
      { id: 2, username: 'user_sales', groupId: 2, name: 'Nhân viên kinh doanh' },
      { id: 3, username: 'user_warehouse', groupId: 3, name: 'Thủ kho' },
      { id: 4, username: 'user_purchasing', groupId: 4, name: 'Nhân viên mua hàng' },
      { id: 5, username: 'user_production', groupId: 5, name: 'Quản đốc sản xuất' },
      { id: 6, username: 'user_accounting', groupId: 6, name: 'Kế toán viên' },
      { id: 7, username: 'user_hr', groupId: 7, name: 'Chuyên viên nhân sự' },
      { id: 8, username: 'admin', groupId: 1, name: 'Super Admin' },
    ];

    for (const u of usersData) {
      await adminDs.query(
        `INSERT INTO "tenant_matrix"."users" ("id", "username", "password", "full_name", "group_id", "is_active")
         VALUES ($1, $2, $3, $4, $5, true)`,
        [u.id, u.username, passwordHash, u.name, u.groupId],
      );
    }

    // Seed minimal fixtures so that GET endpoints return 200 without DB relations errors
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."products" ("id", "sku", "name", "unit", "base_price", "cost_price", "profit_margin", "is_active") VALUES
       (101, 'SKU-MTRX-01', 'San pham Matrix 01', 'cai', 100000, 70000, 30.00, true)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."customers" ("id", "code", "name") VALUES
       (201, 'KH-MTRX-01', 'Khach hang Matrix 01')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."suppliers" ("id", "uuid", "code", "name", "type") VALUES
       (301, 'c0000000-0000-0000-0000-000000000301', 'NCC-MTRX-01', 'Nha cung cap Matrix 01', 'MATERIAL')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."employees" ("id", "user_id", "full_name", "base_salary", "is_active") VALUES
       (401, 7, 'Nhan vien Matrix HR', 15000000, true),
       (402, 1, 'Quan tri vien HR', 20000000, true)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."projects" ("id", "title", "created_by_id", "status") VALUES
       (501, 'Du an Matrix', 2, 'ACTIVE')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."sales_orders" ("id", "uuid", "order_code", "customer_id", "status", "total_amount", "total_cost") VALUES
       (601, 'b0000000-0000-0000-0000-000000000601', 'SO-MTRX-01', 201, 'SO_PENDING', 1000000, 700000)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."materials" ("id", "code", "name", "unit", "cost_per_unit", "cost_price") VALUES
       (901, 'NVL-MTRX-01', 'Vat lieu Matrix 01', 'm', 50000, 50000)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."production_fulfillment_orders" ("id", "code", "sales_order_id", "status") VALUES
       (701, 'PFO-MTRX-01', 601, 'DRAFT')
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."purchase_orders" ("id", "uuid", "po_code", "supplier_id", "type", "status", "pfo_id") VALUES
       (801, 'd0000000-0000-0000-0000-000000000801', 'PO-MTRX-01', 301, 'MATERIAL', 'DRAFT', 701),
       (802, 'd0000000-0000-0000-0000-000000000802', 'PO-MTRX-POOLED-01', 301, 'POOLED', 'DRAFT', NULL)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."purchase_order_items" ("id", "po_id", "material_id", "quantity", "unit_price", "subtotal") VALUES
       (811, 801, 901, 10, 50000, 500000)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."purchase_order_items" ("id", "po_id", "product_id", "quantity", "unit_price", "subtotal") VALUES
       (812, 801, 101, 5, 80000, 400000)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."pfo_material_requirements" ("id", "pfo_id", "material_id", "material_code", "material_name", "planned_quantity", "unit_price") VALUES
       (711, 701, 901, 'NVL-MTRX-01', 'Vat lieu Matrix 01', 10, 50000)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."pfo_material_requirements" ("id", "pfo_id", "product_id", "material_code", "material_name", "planned_quantity", "unit_price") VALUES
       (712, 701, 101, 'SP-MTRX-01', 'San pham Matrix 01', 5, 70000)
       ON CONFLICT DO NOTHING`,
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
      await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_matrix" CASCADE`);
      await adminDs.destroy();
    }
  });

  interface RoleTestCase {
    roleName: string;
    userId: number;
    username: string;
    groupId: number;
    mainApis: string[];
    deniedApis: string[];
    lookupApis: string[];
  }

  const MATRIX_TEST_ROLES: RoleTestCase[] = [
    {
      roleName: 'Quản trị',
      userId: 1,
      username: 'user_admin',
      groupId: 1,
      mainApis: [
        '/api/users',
        '/api/users/groups',
        '/api/users/online',
        '/api/auth/rbac/mode',
        '/api/auth/rbac/readiness',
        '/api/system/company',
        '/api/system/templates',
        '/api/system/logs?limit=5',
        '/api/system/dashboard/stats',
        '/api/sales',
        '/api/sales/601',
        '/api/customers',
        '/api/customers/201',
        '/api/customers/201/orders',
        '/api/projects',
        '/api/projects/501',
        '/api/projects/501/cost-summary',
        '/api/products',
        '/api/purchasing',
        '/api/purchasing/801',
        '/api/purchasing/available-for-pooling',
        '/api/purchasing/pooled/802/aggregate',
        '/api/inventory/stocks',
        '/api/inventory/history',
        '/api/inventory/goods-receipt/pending',
        '/api/inventory/goods-receipt/po/801',
        '/api/inventory/deliveries/pending',
        '/api/inventory/deliveries/completed',
        '/api/inventory/shipping-carriers',
        '/api/inventory/goods-issue',
        '/api/materials',
        '/api/planning',
        '/api/planning/pfo/suggestions',
        '/api/planning/pfo/701',
        '/api/planning/pfo/701/pos',
        '/api/planning/pfo/701/pxks',
        '/api/planning/pfo/701/preview-btp',
        '/api/production/assignments',
        '/api/qc/summary',
        '/api/products/101/routings',
        '/api/products/calculate-cost/SKU-MTRX-01',
        '/api/finance/transactions',
        '/api/finance/categories',
        '/api/finance/summary',
        '/api/finance/so-profit',
        '/api/hr/employees',
        '/api/hr/attendances',
        '/api/hr/leaves',
        '/api/hr/shifts',
        '/api/hr/assets',
        '/api/hr/payslips',
        '/api/hr/trainings',
        '/api/hr/balance/401',
        '/api/hr/me/reviews',
        '/api/hr/recruitment/jobs',
        '/api/hr/recruitment/candidates',
        '/api/hr/recruitment/interviews',
        '/api/hr/review-questions',
        '/api/hr/review-campaigns',
        '/api/auth/me',
        '/api/notifications',
        '/api/announcements/user/active',
        '/api/discussions',
        '/api/tasks',
      ],
      deniedApis: [],
      lookupApis: ['/api/lookups/users', '/api/lookups/customers', '/api/lookups/products', '/api/lookups/suppliers', '/api/lookups/warehouses'],
    },
    {
      roleName: 'Kinh doanh',
      userId: 2,
      username: 'user_sales',
      groupId: 2,
      mainApis: [
        '/api/sales',
        '/api/sales/601',
        '/api/customers',
        '/api/customers/201',
        '/api/customers/201/orders',
        '/api/projects',
        '/api/projects/501',
        '/api/projects/501/cost-summary',
        '/api/products',
        '/api/system/company',
        '/api/system/templates',
        '/api/system/dashboard/stats',
        '/api/tasks',
        '/api/auth/me',
        '/api/notifications',
        '/api/announcements/user/active',
        '/api/discussions',
      ],
      deniedApis: [
        '/api/purchasing',
        '/api/inventory/stocks',
        '/api/planning',
        '/api/finance/transactions',
        '/api/hr/employees',
        '/api/users/groups',
      ],
      lookupApis: [
        '/api/lookups/customers',
        '/api/lookups/projects',
        '/api/lookups/products',
        '/api/lookups/users',
      ],
    },
    {
      roleName: 'Kho',
      userId: 3,
      username: 'user_warehouse',
      groupId: 3,
      mainApis: [
        '/api/inventory/stocks',
        '/api/inventory/history',
        '/api/inventory/goods-receipt/pending',
        '/api/inventory/deliveries/pending',
        '/api/inventory/deliveries/completed',
        '/api/inventory/shipping-carriers',
        '/api/inventory/goods-issue',
        '/api/materials',
        '/api/products',
        '/api/products/101',
        '/api/system/dashboard/stats',
        '/api/tasks',
        '/api/auth/me',
        '/api/notifications',
        '/api/announcements/user/active',
        '/api/discussions',
      ],
      deniedApis: [
        '/api/sales',
        '/api/purchasing',
        '/api/finance/transactions',
        '/api/hr/employees',
        '/api/users/groups',
      ],
      lookupApis: [
        '/api/lookups/warehouses',
        '/api/lookups/suppliers',
        '/api/lookups/products',
        '/api/lookups/materials',
      ],
    },
    {
      roleName: 'Mua hàng',
      userId: 4,
      username: 'user_purchasing',
      groupId: 4,
      mainApis: [
        '/api/purchasing',
        '/api/purchasing/801',
        '/api/purchasing/available-for-pooling',
        '/api/purchasing/pooled/802/aggregate',
        '/api/inventory/goods-receipt/po/801',
        '/api/planning/pfo/701',
        '/api/products',
        '/api/system/company',
        '/api/system/dashboard/stats',
        '/api/tasks',
        '/api/auth/me',
        '/api/notifications',
        '/api/announcements/user/active',
        '/api/discussions',
      ],
      deniedApis: [
        '/api/sales',
        '/api/inventory/stocks',
        '/api/finance/transactions',
        '/api/hr/employees',
        '/api/users/groups',
      ],
      lookupApis: [
        '/api/lookups/suppliers',
        '/api/lookups/products',
        '/api/lookups/projects',
      ],
    },
    {
      roleName: 'Sản xuất',
      userId: 5,
      username: 'user_production',
      groupId: 5,
      mainApis: [
        '/api/planning',
        '/api/planning/pfo/suggestions',
        '/api/planning/pfo/701',
        '/api/planning/pfo/701/pos',
        '/api/planning/pfo/701/pxks',
        '/api/planning/pfo/701/preview-btp',
        '/api/production/assignments',
        '/api/qc/summary',
        '/api/products',
        '/api/products/101/routings',
        '/api/products/calculate-cost/SKU-MTRX-01',
        '/api/inventory/stocks',
        '/api/materials',
        '/api/system/dashboard/stats',
        '/api/tasks',
        '/api/auth/me',
        '/api/notifications',
        '/api/announcements/user/active',
        '/api/discussions',
      ],
      deniedApis: [
        '/api/sales',
        '/api/purchasing',
        '/api/finance/transactions',
        '/api/hr/employees',
        '/api/users/groups',
      ],
      lookupApis: [
        '/api/lookups/products',
        '/api/lookups/suppliers',
        '/api/lookups/warehouses',
      ],
    },
    {
      roleName: 'Kế toán',
      userId: 6,
      username: 'user_accounting',
      groupId: 6,
      mainApis: [
        '/api/finance/transactions',
        '/api/finance/categories',
        '/api/finance/summary',
        '/api/finance/so-profit',
        '/api/sales',
        '/api/sales/601',
        '/api/purchasing',
        '/api/purchasing/801',
        '/api/system/dashboard/stats',
        '/api/tasks',
        '/api/auth/me',
        '/api/notifications',
        '/api/announcements/user/active',
        '/api/discussions',
      ],
      deniedApis: [
        '/api/hr/employees',
        '/api/planning',
        '/api/inventory/stocks',
        '/api/users/groups',
      ],
      lookupApis: [
        '/api/lookups/customers',
        '/api/lookups/suppliers',
        '/api/lookups/projects',
      ],
    },
    {
      roleName: 'Nhân sự',
      userId: 7,
      username: 'user_hr',
      groupId: 7,
      mainApis: [
        '/api/hr/employees',
        '/api/hr/attendances',
        '/api/hr/leaves',
        '/api/hr/shifts',
        '/api/hr/assets',
        '/api/hr/payslips',
        '/api/hr/trainings',
        '/api/hr/balance/401',
        '/api/hr/me/reviews',
        '/api/hr/recruitment/jobs',
        '/api/hr/recruitment/candidates',
        '/api/hr/recruitment/interviews',
        '/api/hr/review-questions',
        '/api/hr/review-campaigns',
        '/api/system/dashboard/stats',
        '/api/tasks',
        '/api/auth/me',
        '/api/notifications',
        '/api/announcements/user/active',
        '/api/discussions',
      ],
      deniedApis: [
        '/api/sales',
        '/api/purchasing',
        '/api/inventory/stocks',
        '/api/planning',
        '/api/finance/transactions',
        '/api/users/groups',
      ],
      lookupApis: [
        '/api/lookups/users',
        '/api/lookups/employees',
      ],
    },
  ];

  describe('Table-driven Role Matrix Verification at ENFORCE', () => {
    for (const testRole of MATRIX_TEST_ROLES) {
      it(`Nhóm [${testRole.roleName}]: màn hình chính 200 (${testRole.mainApis.length} APIs), module ngoài 403 (${testRole.deniedApis.length} APIs), lookups 200 (${testRole.lookupApis.length} APIs)`, async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: testRole.userId,
          username: testRole.username,
          group_id: testRole.groupId,
          tid: 'tenant_matrix',
        });

        // 1. Gọi danh sách API màn hình chính của module của nhóm -> KHÔNG bị 403 (200 OK)
        for (const endpoint of testRole.mainApis) {
          const res = await request(app.getHttpServer())
            .get(endpoint)
            .set('X-Test-Tenant', 'tenant_matrix')
            .set('Authorization', `Bearer ${token}`);

          if (![200, 204].includes(res.status)) {
            console.error(`[FAIL] Role [${testRole.roleName}] GET ${endpoint} returned ${res.status}:`, res.body);
          }
          expect(res.status).not.toBe(403);
          expect([200, 204]).toContain(res.status);
        }

        // 2. Gọi 1 endpoint đọc đại diện của module không thuộc nhóm -> 403
        for (const endpoint of testRole.deniedApis) {
          const res = await request(app.getHttpServer())
            .get(endpoint)
            .set('X-Test-Tenant', 'tenant_matrix')
            .set('Authorization', `Bearer ${token}`);

          expect(res.status).toBe(403);
        }

        // 3. Gọi /lookups/* -> 200
        for (const lookup of testRole.lookupApis) {
          const res = await request(app.getHttpServer())
            .get(lookup)
            .set('X-Test-Tenant', 'tenant_matrix')
            .set('Authorization', `Bearer ${token}`);

          expect(res.status).toBe(200);
          expect(Array.isArray(res.body)).toBe(true);
        }

        console.log(
          `[RoleMatrix] Nhóm [${testRole.roleName}]: OK - Đã thử ${testRole.mainApis.length} API màn hình chính (0 bị 403), ${testRole.deniedApis.length} API chặn (403), ${testRole.lookupApis.length} API lookup (200)`,
        );
      });
    }

    it('Superadmin (username === "admin") bypasses all ENFORCE checks on any endpoint', async () => {
      if (!dbAvailable) return;

      const tokenAdmin = jwtService.sign({
        sub: 8,
        username: 'admin',
        group_id: 1,
        tid: 'tenant_matrix',
      });

      const endpoints = [
        '/api/sales',
        '/api/customers',
        '/api/purchasing',
        '/api/inventory/stocks',
        '/api/planning',
        '/api/finance/transactions',
        '/api/hr/employees',
        '/api/users',
        '/api/users/groups',
      ];

      for (const ep of endpoints) {
        const res = await request(app.getHttpServer())
          .get(ep)
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${tokenAdmin}`);

        expect(res.status).toBe(200);
      }
    });

    describe('Cost Price Visibility Verification at ENFORCE (P12b2-r3)', () => {
      it('user nhóm Kinh doanh (view_cost_price = false) gọi GET /products -> không có khoá cost_price, profit_margin', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 2,
          username: 'user_sales',
          group_id: 2,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/products')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        for (const prod of res.body) {
          expect(prod).not.toHaveProperty('cost_price');
          expect(prod).not.toHaveProperty('profit_margin');
          expect('cost_price' in prod).toBe(false);
          expect('profit_margin' in prod).toBe(false);
        }

        const resOne = await request(app.getHttpServer())
          .get('/api/products/101')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resOne.status).toBe(200);
        expect(resOne.body).not.toHaveProperty('cost_price');
        expect(resOne.body).not.toHaveProperty('profit_margin');
        expect('cost_price' in resOne.body).toBe(false);
        expect('profit_margin' in resOne.body).toBe(false);
      });

      it('user nhóm Kế toán (có view_cost_price = true) gọi GET /products -> có khoá cost_price, profit_margin', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 6,
          username: 'user_accounting',
          group_id: 6,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/products')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        const prod = res.body.find((p: any) => p.id === 101);
        expect(prod).toBeDefined();
        expect(prod).toHaveProperty('cost_price');
        expect(prod).toHaveProperty('profit_margin');
        expect('cost_price' in prod).toBe(true);
        expect('profit_margin' in prod).toBe(true);
        expect(prod.cost_price).toBeDefined();
        expect(prod.profit_margin).toBeDefined();

        const resOne = await request(app.getHttpServer())
          .get('/api/products/101')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resOne.status).toBe(200);
        expect(resOne.body).toHaveProperty('cost_price');
        expect(resOne.body).toHaveProperty('profit_margin');
        expect('cost_price' in resOne.body).toBe(true);
        expect('profit_margin' in resOne.body).toBe(true);
        expect(resOne.body.cost_price).toBeDefined();
        expect(resOne.body.profit_margin).toBeDefined();
      });

      it('user nhóm Kho (view_cost_price = false) gọi GET /products -> 200 nhưng không có cost_price, profit_margin', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 3,
          username: 'user_warehouse',
          group_id: 3,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/products')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        for (const prod of res.body) {
          expect(prod).not.toHaveProperty('cost_price');
          expect(prod).not.toHaveProperty('profit_margin');
          expect('cost_price' in prod).toBe(false);
          expect('profit_margin' in prod).toBe(false);
        }
      });

      it('user nhóm Kho gọi GET /materials -> 200 nhưng không có cost_per_unit, cost_price', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 3,
          username: 'user_warehouse',
          group_id: 3,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/materials')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        for (const mat of res.body) {
          expect(mat).not.toHaveProperty('cost_per_unit');
          expect(mat).not.toHaveProperty('cost_price');
          expect('cost_per_unit' in mat).toBe(false);
          expect('cost_price' in mat).toBe(false);
        }
      });

      it('user nhóm Mua hàng (PURCHASE:can_view = true) gọi GET /materials -> 200 và có cost_per_unit', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 4,
          username: 'user_purchasing',
          group_id: 4,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/materials')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        const mat = res.body.find((m: any) => m.id === 901);
        expect(mat).toBeDefined();
        expect(mat).toHaveProperty('cost_per_unit');
        expect('cost_per_unit' in mat).toBe(true);
        expect(mat.cost_per_unit).toBeDefined();
      });

      it('user nhóm Mua hàng gọi GET /products -> 200 nhưng KHÔNG có cost_price, profit_margin', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 4,
          username: 'user_purchasing',
          group_id: 4,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/products')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(0);
        for (const prod of res.body) {
          expect(prod).not.toHaveProperty('cost_price');
          expect(prod).not.toHaveProperty('profit_margin');
          expect('cost_price' in prod).toBe(false);
          expect('profit_margin' in prod).toBe(false);
        }
      });

      it('user nhóm Kinh doanh (view_cost_price = false) gọi GET /sales -> 200 nhưng KHÔNG có total_cost', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 2,
          username: 'user_sales',
          group_id: 2,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/sales')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        const orders = Array.isArray(res.body) ? res.body : res.body.data;
        expect(Array.isArray(orders)).toBe(true);
        expect(orders.length).toBeGreaterThan(0);
        for (const order of orders) {
          expect(order).not.toHaveProperty('total_cost');
          expect('total_cost' in order).toBe(false);
        }

        const resOne = await request(app.getHttpServer())
          .get('/api/sales/601')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resOne.status).toBe(200);
        expect(resOne.body).not.toHaveProperty('total_cost');
        expect('total_cost' in resOne.body).toBe(false);
      });

      it('user nhóm Kế toán (view_cost_price = true) gọi GET /products và GET /sales -> 200 và có đầy đủ cost_price, total_cost', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 6,
          username: 'user_accounting',
          group_id: 6,
          tid: 'tenant_matrix',
        });

        const resProd = await request(app.getHttpServer())
          .get('/api/products')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resProd.status).toBe(200);
        expect(Array.isArray(resProd.body)).toBe(true);
        const prod = resProd.body.find((p: any) => p.id === 101);
        expect(prod).toBeDefined();
        expect(prod).toHaveProperty('cost_price');
        expect('cost_price' in prod).toBe(true);

        const resSales = await request(app.getHttpServer())
          .get('/api/sales/601')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resSales.status).toBe(200);
        expect(resSales.body).toHaveProperty('total_cost');
        expect('total_cost' in resSales.body).toBe(true);
      });

      it('Superadmin (username === "admin") gọi GET /products, GET /materials, GET /sales -> có đầy đủ tất cả giá vốn', async () => {
        if (!dbAvailable) return;

        const token = jwtService.sign({
          sub: 8,
          username: 'admin',
          group_id: 1,
          tid: 'tenant_matrix',
        });

        const resProd = await request(app.getHttpServer())
          .get('/api/products')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resProd.status).toBe(200);
        const prod = resProd.body.find((p: any) => p.id === 101);
        expect(prod).toBeDefined();
        expect(prod).toHaveProperty('cost_price');
        expect('cost_price' in prod).toBe(true);

        const resMat = await request(app.getHttpServer())
          .get('/api/materials')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resMat.status).toBe(200);
        const mat = resMat.body.find((m: any) => m.id === 901);
        expect(mat).toBeDefined();
        expect(mat).toHaveProperty('cost_per_unit');
        expect('cost_per_unit' in mat).toBe(true);

        const resSale = await request(app.getHttpServer())
          .get('/api/sales/601')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`);

        expect(resSale.status).toBe(200);
        expect(resSale.body).toHaveProperty('total_cost');
        expect('total_cost' in resSale.body).toBe(true);
      });

      it('Write protection: user Kho có quyền update sản phẩm nhưng không có view_cost_price gửi PUT /products/101 -> DB cost_price không đổi', async () => {
        if (!dbAvailable) return;

        // Cấp quyền PRODUCT:can_update cho group 3 (Kho), nhưng view_cost_price = false
        await adminDs.query(
          `INSERT INTO "tenant_matrix"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete", "view_cost_price")
           VALUES (3, 'PRODUCT', true, false, true, false, false)
           ON CONFLICT ("group_id", "module_code") DO UPDATE SET "can_update" = true, "view_cost_price" = false`,
        );
        permCacheService.clearAll();

        const token = jwtService.sign({
          sub: 3,
          username: 'user_warehouse',
          group_id: 3,
          tid: 'tenant_matrix',
        });

        // Gửi PUT với cost_price sửa đổi và tên mới
        const res = await request(app.getHttpServer())
          .put('/api/products/101')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'San pham Matrix Updated by Warehouse',
            cost_price: 999999,
            profit_margin: 99,
          });

        expect(res.status).toBe(200);

        // Kiểm tra trực tiếp trong DB: cost_price vẫn là 70000, profit_margin vẫn là 30.00
        const rows = await adminDs.query(
          `SELECT "name", "cost_price", "profit_margin" FROM "tenant_matrix"."products" WHERE "id" = 101`,
        );
        expect(rows.length).toBe(1);
        expect(rows[0].name).toBe('San pham Matrix Updated by Warehouse');
        expect(Number(rows[0].cost_price)).toBe(70000);
        expect(Number(rows[0].profit_margin)).toBe(30);
      });

      it('P12b3-r2 Mục 2: Kho và Mua hàng gọi GET /purchasing -> không có cost_price/profit_margin trong items[].product, không có total_cost trong pfo.sales_order; Mua hàng có items[].material.cost_per_unit', async () => {
        if (!dbAvailable) return;

        // 1. Mua hàng gọi GET /purchasing
        const tokenPurchasing = jwtService.sign({
          sub: 4,
          username: 'user_purchasing',
          groupId: 4,
          tid: 'tenant_matrix',
        });

        const resPurchasing = await request(app.getHttpServer())
          .get('/api/purchasing')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${tokenPurchasing}`);

        expect(resPurchasing.status).toBe(200);
        const posMuaHang = Array.isArray(resPurchasing.body) ? resPurchasing.body : resPurchasing.body.data;
        expect(Array.isArray(posMuaHang)).toBe(true);
        const po801MuaHang = posMuaHang.find((p: any) => p.id === 801);
        expect(po801MuaHang).toBeDefined();

        // Kiểm tra items.product: cost_price và profit_margin phải bị ẩn
        const itemProdMH = po801MuaHang.items.find((i: any) => i.product_id === 101);
        expect(itemProdMH).toBeDefined();
        expect(itemProdMH.product).toBeDefined();
        expect(itemProdMH.product).not.toHaveProperty('cost_price');
        expect(itemProdMH.product).not.toHaveProperty('profit_margin');
        expect('cost_price' in itemProdMH.product).toBe(false);
        expect('profit_margin' in itemProdMH.product).toBe(false);

        // Mua hàng phải thấy items.material.cost_per_unit
        const itemMatMH = po801MuaHang.items.find((i: any) => i.material_id === 901);
        expect(itemMatMH).toBeDefined();
        expect(itemMatMH.material).toBeDefined();
        expect(itemMatMH.material).toHaveProperty('cost_per_unit');
        expect('cost_per_unit' in itemMatMH.material).toBe(true);

        // Kiểm tra pfo.sales_order: total_cost phải bị ẩn
        expect(po801MuaHang.pfo).toBeDefined();
        expect(po801MuaHang.pfo.sales_order).toBeDefined();
        expect(po801MuaHang.pfo.sales_order).not.toHaveProperty('total_cost');
        expect('total_cost' in po801MuaHang.pfo.sales_order).toBe(false);

        // 2. Kho gọi GET /purchasing (khi được cấp quyền xem PO nhưng view_cost_price = false)
        await adminDs.query(
          `INSERT INTO "tenant_matrix"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete", "view_cost_price")
           VALUES (3, 'PURCHASE', true, false, false, false, false)
           ON CONFLICT ("group_id", "module_code") DO UPDATE SET "can_view" = true, "view_cost_price" = false`,
        );
        permCacheService.clearAll();

        const tokenWarehouse = jwtService.sign({
          sub: 3,
          username: 'user_warehouse',
          groupId: 3,
          tid: 'tenant_matrix',
        });

        const resWarehouse = await request(app.getHttpServer())
          .get('/api/purchasing')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${tokenWarehouse}`);

        expect(resWarehouse.status).toBe(200);
        const posWarehouse = Array.isArray(resWarehouse.body) ? resWarehouse.body : resWarehouse.body.data;
        const po801Warehouse = posWarehouse.find((p: any) => p.id === 801);
        expect(po801Warehouse).toBeDefined();

        const itemProdWH = po801Warehouse.items.find((i: any) => i.product_id === 101);
        expect(itemProdWH.product).not.toHaveProperty('cost_price');
        expect(itemProdWH.product).not.toHaveProperty('profit_margin');
        expect('cost_price' in itemProdWH.product).toBe(false);
        expect('profit_margin' in itemProdWH.product).toBe(false);

        expect(po801Warehouse.pfo.sales_order).not.toHaveProperty('total_cost');
        expect('total_cost' in po801Warehouse.pfo.sales_order).toBe(false);
      });

      it('P12b3-r2 Mục 3: Mua hàng gọi route PFO có cả dòng NVL và dòng thành phẩm -> dòng NVL có unit_price, dòng thành phẩm không có', async () => {
        if (!dbAvailable) return;

        const tokenPurchasing = jwtService.sign({
          sub: 4,
          username: 'user_purchasing',
          groupId: 4,
          tid: 'tenant_matrix',
        });

        const res = await request(app.getHttpServer())
          .get('/api/planning/pfo/701')
          .set('X-Test-Tenant', 'tenant_matrix')
          .set('Authorization', `Bearer ${tokenPurchasing}`);

        expect(res.status).toBe(200);
        expect(res.body).toBeDefined();
        const reqs = res.body.material_requirements;
        expect(Array.isArray(reqs)).toBe(true);
        expect(reqs.length).toBeGreaterThanOrEqual(2);

        // Dòng NVL: có unit_price
        const nvlReq = reqs.find((r: any) => r.material_id === 901);
        expect(nvlReq).toBeDefined();
        expect(nvlReq).toHaveProperty('unit_price');
        expect('unit_price' in nvlReq).toBe(true);
        expect(Number(nvlReq.unit_price)).toBe(50000);

        // Dòng thành phẩm: KHÔNG có unit_price
        const prodReq = reqs.find((r: any) => r.product_id === 101);
        expect(prodReq).toBeDefined();
        expect(prodReq).not.toHaveProperty('unit_price');
        expect('unit_price' in prodReq).toBe(false);
      });
    });
  });
});
