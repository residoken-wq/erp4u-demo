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
      `INSERT INTO "tenant_matrix"."products" ("id", "sku", "name", "unit", "base_price", "cost_price", "is_active") VALUES
       (101, 'SKU-MTRX-01', 'San pham Matrix 01', 'cai', 100000, 70000, true)
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
       (401, 7, 'Nhan vien Matrix HR', 15000000, true)
       ON CONFLICT DO NOTHING`,
    );
    await adminDs.query(
      `INSERT INTO "tenant_matrix"."projects" ("id", "title", "created_by_id", "status") VALUES
       (501, 'Du an Matrix', 2, 'ACTIVE')
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
        '/api/auth/rbac/mode',
        '/api/auth/rbac/readiness',
        '/api/sales',
        '/api/customers',
        '/api/products',
        '/api/purchasing',
        '/api/inventory/stocks',
        '/api/planning',
        '/api/finance/transactions',
        '/api/hr/employees',
      ],
      deniedApis: [],
      lookupApis: ['/api/lookups/users', '/api/lookups/customers', '/api/lookups/products'],
    },
    {
      roleName: 'Kinh doanh',
      userId: 2,
      username: 'user_sales',
      groupId: 2,
      mainApis: [
        '/api/sales',
        '/api/customers',
        '/api/projects',
      ],
      deniedApis: [
        '/api/purchasing',
        '/api/inventory/stocks',
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
        '/api/inventory/goods-issue',
        '/api/inventory/shipping-carriers',
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
      ],
    },
    {
      roleName: 'Mua hàng',
      userId: 4,
      username: 'user_purchasing',
      groupId: 4,
      mainApis: [
        '/api/purchasing',
        '/api/products',
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
        '/api/products',
        '/api/inventory/stocks',
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
        '/api/sales',
        '/api/purchasing',
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
      it(`Nhóm [${testRole.roleName}]: màn hình chính 200, module ngoài 403, lookups 200`, async () => {
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
  });
});
