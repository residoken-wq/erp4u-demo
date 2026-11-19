import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../app.module';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/permissions.guard';
import { RbacAccessLogService } from '../../../auth/rbac-access-log.service';
import { RbacAccessLog } from '../../../auth/entities/rbac-access-log.entity';
import { Customer, CustomerType } from '../../../customers/customer.entity';
import { buildDataSourceOptions } from '../../../database/data-source';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../tenant-context';
import { TENANT_REGISTRY, TenantRegistry } from '../tenant-registry.interface';
import { TENANT_RESOLVER, TenantResolver } from '../tenant-resolver.interface';
import { installTenantConnectionHook } from '../tenant-connection.hook';

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

describe('Multi-Tenant Schema Isolation (Integration)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource;
  let app: INestApplication;
  let dataSource: DataSource;
  let rbacAccessLogService: RbacAccessLogService;
  let activeTenants: TenantContext[] = [TENANT_A, TENANT_B];

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
      return activeTenants;
    },
  };

  beforeAll(async () => {
    process.env.DB_AUTO_MIGRATE = 'false';

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
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_a" CASCADE`);
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_b" CASCADE`);
    await adminDs.query(`CREATE SCHEMA "tenant_a"`);
    await adminDs.query(`CREATE SCHEMA "tenant_b"`);

    await runMigrationsForSchema(TENANT_A.schema);
    await runMigrationsForSchema(TENANT_B.schema);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(TENANT_RESOLVER)
      .useValue(headerTenantResolver)
      .overrideProvider(TENANT_REGISTRY)
      .useValue(testTenantRegistry)
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleRef.get(DataSource);
    rbacAccessLogService = moduleRef.get(RbacAccessLogService);
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

  it('isolates HTTP API CRUD across tenant_a and tenant_b via X-Test-Tenant header', async () => {
    const createResA = await request(app.getHttpServer())
      .post('/api/customers')
      .set('X-Test-Tenant', 'tenant_a')
      .send({
        code: 'DEMO-A-01',
        name: 'Khách hàng Demo A01',
        type: CustomerType.CUSTOMER,
        email: 'demo-a@example.com',
        phone: '0900000001',
      })
      .expect(201);

    expect(createResA.body).toMatchObject({
      code: 'DEMO-A-01',
      name: 'Khách hàng Demo A01',
    });

    // Tenant B must NOT see Tenant A's customer
    const listResB = await request(app.getHttpServer())
      .get('/api/customers')
      .set('X-Test-Tenant', 'tenant_b')
      .expect(200);

    expect(Array.isArray(listResB.body)).toBe(true);
    expect(listResB.body).toHaveLength(0);

    // Tenant A sees its own customer
    const listResA = await request(app.getHttpServer())
      .get('/api/customers')
      .set('X-Test-Tenant', 'tenant_a')
      .expect(200);

    expect(listResA.body).toHaveLength(1);
    expect(listResA.body[0].code).toBe('DEMO-A-01');

    // Creating a customer in Tenant B does not leak to Tenant A
    await request(app.getHttpServer())
      .post('/api/customers')
      .set('X-Test-Tenant', 'tenant_b')
      .send({
        code: 'DEMO-B-01',
        name: 'Khách hàng Demo B01',
        type: CustomerType.CUSTOMER,
        email: 'demo-b@example.com',
        phone: '0900000002',
      })
      .expect(201);

    const listResAAgain = await request(app.getHttpServer())
      .get('/api/customers')
      .set('X-Test-Tenant', 'tenant_a')
      .expect(200);
    expect(listResAAgain.body.map((c: any) => c.code)).toEqual(['DEMO-A-01']);

    const listResBAgain = await request(app.getHttpServer())
      .get('/api/customers')
      .set('X-Test-Tenant', 'tenant_b')
      .expect(200);
    expect(listResBAgain.body.map((c: any) => c.code)).toEqual(['DEMO-B-01']);
  });

  it('isolates TypeORM transactions and QueryRunners per tenant schema', async () => {
    const schemaInTxA = await TenantContext.run(TENANT_A, () =>
      dataSource.transaction(async (manager) => {
        const [{ current_schema }] = await manager.query(
          `SELECT current_schema()`,
        );
        const customer = manager.create(Customer, {
          code: 'DEMO-TX-A',
          name: 'Khách hàng Demo TX A',
          type: CustomerType.LEAD,
        });
        await manager.save(customer);
        return current_schema;
      }),
    );
    expect(schemaInTxA).toBe('tenant_a');

    const txBResult = await TenantContext.run(TENANT_B, () =>
      dataSource.transaction(async (manager) => {
        const [{ current_schema }] = await manager.query(
          `SELECT current_schema()`,
        );
        const visibleInB = await manager.find(Customer, {
          where: { code: 'DEMO-TX-A' },
        });
        const customerB = manager.create(Customer, {
          code: 'DEMO-TX-B',
          name: 'Khách hàng Demo TX B',
          type: CustomerType.LEAD,
        });
        await manager.save(customerB);
        return { current_schema, visibleInB };
      }),
    );
    expect(txBResult.current_schema).toBe('tenant_b');
    expect(txBResult.visibleInB).toHaveLength(0);

    // Explicit QueryRunner must also honor TenantContext via wrapped pool.connect
    const qrCodesInA = await TenantContext.run(TENANT_A, async () => {
      const qr = dataSource.createQueryRunner();
      await qr.connect();
      try {
        const rows = await qr.manager.find(Customer, {
          order: { code: 'ASC' },
        });
        return rows.map((r) => r.code);
      } finally {
        await qr.release();
      }
    });
    expect(qrCodesInA).toContain('DEMO-TX-A');
    expect(qrCodesInA).not.toContain('DEMO-TX-B');
  });

  it('isolates cron execution across registered tenants [A, B]', async () => {
    const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const freshDate = new Date();
    const logRepo = dataSource.getRepository(RbacAccessLog);

    await TenantContext.run(TENANT_A, async () => {
      await logRepo.clear();
      await logRepo.save([
        logRepo.create({
          created_at: oldDate,
          mode: 'ENFORCE',
          decision: 'ALLOW',
          method: 'GET',
          route: '/api/demo-tenant-a/old',
        }),
        logRepo.create({
          created_at: freshDate,
          mode: 'ENFORCE',
          decision: 'ALLOW',
          method: 'GET',
          route: '/api/demo-tenant-a/fresh',
        }),
      ]);
    });

    await TenantContext.run(TENANT_B, async () => {
      await logRepo.clear();
      await logRepo.save([
        logRepo.create({
          created_at: oldDate,
          mode: 'ENFORCE',
          decision: 'ALLOW',
          method: 'GET',
          route: '/api/demo-tenant-b/old',
        }),
        logRepo.create({
          created_at: freshDate,
          mode: 'ENFORCE',
          decision: 'ALLOW',
          method: 'GET',
          route: '/api/demo-tenant-b/fresh',
        }),
      ]);
    });

    // Run cron with registry = [A] first: only tenant_a old row is cleaned, tenant_b untouched
    activeTenants = [TENANT_A];
    await rbacAccessLogService.cleanOldLogs();

    const routesAAfterFirst = await TenantContext.run(TENANT_A, async () =>
      (await logRepo.find({ order: { route: 'ASC' } })).map((l) => l.route),
    );
    const routesBAfterFirst = await TenantContext.run(TENANT_B, async () =>
      (await logRepo.find({ order: { route: 'ASC' } })).map((l) => l.route),
    );
    expect(routesAAfterFirst).toEqual(['/api/demo-tenant-a/fresh']);
    expect(routesBAfterFirst).toEqual([
      '/api/demo-tenant-b/fresh',
      '/api/demo-tenant-b/old',
    ]);

    // Run cron with registry = [A, B]: both schemas cleaned and strictly isolated
    activeTenants = [TENANT_A, TENANT_B];
    await rbacAccessLogService.cleanOldLogs();

    const routesAFinal = await TenantContext.run(TENANT_A, async () =>
      (await logRepo.find({ order: { route: 'ASC' } })).map((l) => l.route),
    );
    const routesBFinal = await TenantContext.run(TENANT_B, async () =>
      (await logRepo.find({ order: { route: 'ASC' } })).map((l) => l.route),
    );
    expect(routesAFinal).toEqual(['/api/demo-tenant-a/fresh']);
    expect(routesBFinal).toEqual(['/api/demo-tenant-b/fresh']);
  });
});
