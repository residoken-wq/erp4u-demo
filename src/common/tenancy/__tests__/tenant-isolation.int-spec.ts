import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../../app.module';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/permissions.guard';
import { RbacAccessLogService } from '../../../auth/rbac-access-log.service';
import { RbacAccessLog } from '../../../auth/entities/rbac-access-log.entity';
import { Customer, CustomerType } from '../../../customers/customer.entity';
import { buildDataSourceOptions } from '../../../database/data-source';
import { EmailService } from '../../../common/services/email.service';
import { SystemConfig } from '../../../system/system-config.entity';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../tenant-context';
import { TenantConfigService, isEncryptedValue } from '../tenant-config.service';
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
  let tenantConfigService: TenantConfigService;
  let emailService: EmailService;
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
    tenantConfigService = moduleRef.get(TenantConfigService);
    emailService = moduleRef.get(EmailService);
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
    // Clean up test tenant upload directories
    await fs.promises.rm(path.join(process.cwd(), 'uploads', 'tenant_a'), {
      recursive: true,
      force: true,
    });
    await fs.promises.rm(path.join(process.cwd(), 'uploads', 'tenant_b'), {
      recursive: true,
      force: true,
    });
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

  it('isolates per-tenant SMTP configuration and encrypts secrets per schema without env bleed', async () => {
    const prevSmtpHost = process.env.SMTP_HOST;
    process.env.SMTP_HOST = 'smtp.global-env.example';

    try {
      await TenantContext.run(TENANT_A, async () => {
        await tenantConfigService.set('SMTP_HOST', 'smtp.tenant-a.example');
        await tenantConfigService.set('SMTP_PORT', '587');
        await tenantConfigService.set('SMTP_USER', 'mailer-a@example.com');
        await tenantConfigService.set('SMTP_PASS', 'demo-pass-a');
      });

      await TenantContext.run(TENANT_B, async () => {
        await tenantConfigService.set('SMTP_HOST', 'smtp.tenant-b.example');
        await tenantConfigService.set('SMTP_PORT', '465');
        await tenantConfigService.set('SMTP_USER', 'mailer-b@example.com');
        await tenantConfigService.set('SMTP_PASS', 'demo-pass-b');
      });

      const resolvedA = await TenantContext.run(TENANT_A, () =>
        emailService.getResolvedSmtpConfig(),
      );
      const resolvedB = await TenantContext.run(TENANT_B, () =>
        emailService.getResolvedSmtpConfig(),
      );

      expect(resolvedA.host).toBe('smtp.tenant-a.example');
      expect(resolvedA.port).toBe(587);
      expect(resolvedA.pass).toBe('demo-pass-a');

      expect(resolvedB.host).toBe('smtp.tenant-b.example');
      expect(resolvedB.port).toBe(465);
      expect(resolvedB.pass).toBe('demo-pass-b');

      // Verify raw SMTP_PASS stored in DB is encrypted (AES-256-GCM), not plaintext
      const rawPassA = await TenantContext.run(TENANT_A, () =>
        dataSource
          .getRepository(SystemConfig)
          .findOne({ where: { key: 'SMTP_PASS' } }),
      );
      expect(rawPassA?.value).toBeDefined();
      expect(rawPassA?.value).not.toBe('demo-pass-a');
      expect(isEncryptedValue(rawPassA?.value)).toBe(true);

      // Verify non-default tenant does NOT fall back to process.env when a key is unset
      const missingKeyInB = await TenantContext.run(TENANT_B, () =>
        tenantConfigService.get('SMTP_FROM_EMAIL', {
          envKey: ['SMTP_FROM_EMAIL', 'SMTP_FROM'],
        }),
      );
      expect(missingKeyInB).toBeUndefined();
    } finally {
      if (prevSmtpHost === undefined) {
        delete process.env.SMTP_HOST;
      } else {
        process.env.SMTP_HOST = prevSmtpHost;
      }
    }
  });

  it('prefixes uploaded files with tenant_a/ and prevents tenant_b from reading them', async () => {
    const fileContent = Buffer.from('tenant-a-confidential-demo-payload', 'utf8');

    const uploadRes = await request(app.getHttpServer())
      .post('/api/upload/file')
      .set('X-Test-Tenant', 'tenant_a')
      .attach('file', fileContent, {
        filename: 'isolation-test-doc.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    expect(uploadRes.body.key).toMatch(/^tenant_a\/isolation-test-doc.*\.txt$/);
    expect(uploadRes.body.url).toMatch(/^\/uploads\/tenant_a\/isolation-test-doc.*\.txt$/);

    const filename = path.basename(uploadRes.body.key);

    // Tenant A can read its own uploaded file
    const readARes = await request(app.getHttpServer())
      .get(`/api/upload/files/${filename}`)
      .set('X-Test-Tenant', 'tenant_a')
      .expect(200);
    const bodyText =
      readARes.text ??
      (Buffer.isBuffer(readARes.body) ? readARes.body.toString('utf8') : '');
    expect(bodyText).toBe('tenant-a-confidential-demo-payload');

    // Tenant B CANNOT read Tenant A's file
    await request(app.getHttpServer())
      .get(`/api/upload/files/${filename}`)
      .set('X-Test-Tenant', 'tenant_b')
      .expect(404);

    // Tenant B cannot see Tenant A's file in /api/upload/list
    const listBRes = await request(app.getHttpServer())
      .get('/api/upload/list')
      .set('X-Test-Tenant', 'tenant_b')
      .expect(200);
    expect(Array.isArray(listBRes.body)).toBe(true);
    expect(listBRes.body.some((item: any) => item.name === filename)).toBe(false);
  });

  it('boots app cleanly under TENANCY_STRICT=true with mock registry [tenant_a, tenant_b], seeds both schemas, and responds 200 on /api/health', async () => {
    const prevStrict = process.env.TENANCY_STRICT;
    const prevSeedOnBoot = process.env.SEED_ON_BOOT;
    process.env.TENANCY_STRICT = 'true';
    process.env.SEED_ON_BOOT = 'true';

    // Clear system_configs in tenant_a and tenant_b to verify fresh seeding during boot
    await adminDs.query(`DELETE FROM "tenant_a"."system_configs" WHERE "key" IN ('RBAC_SEED_V1', 'CHATBOT_SEED_V1')`);
    await adminDs.query(`DELETE FROM "tenant_b"."system_configs" WHERE "key" IN ('RBAC_SEED_V1', 'CHATBOT_SEED_V1')`);

    let strictApp: INestApplication | undefined;
    try {
      const strictModuleRef: TestingModule = await Test.createTestingModule({
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

      strictApp = strictModuleRef.createNestApplication();
      strictApp.setGlobalPrefix('api');

      // Booting app triggers onApplicationBootstrap -> TenantSeedRunner under TENANCY_STRICT=true
      await strictApp.init();

      // 1. Verify seed ran in tenant_a schema
      const configsA = await adminDs.query(
        `SELECT "key" FROM "tenant_a"."system_configs" WHERE "key" IN ('RBAC_SEED_V1', 'CHATBOT_SEED_V1')`,
      );
      expect(configsA.length).toBeGreaterThanOrEqual(1);

      // 2. Verify seed ran in tenant_b schema
      const configsB = await adminDs.query(
        `SELECT "key" FROM "tenant_b"."system_configs" WHERE "key" IN ('RBAC_SEED_V1', 'CHATBOT_SEED_V1')`,
      );
      expect(configsB.length).toBeGreaterThanOrEqual(1);

      // 3. Verify /api/health returns 200 under strict mode (infrastructure context fallback)
      const healthRes = await request(strictApp.getHttpServer())
        .get('/api/health')
        .expect(200);
      expect(healthRes.body).toEqual({ status: 'ok' });
    } finally {
      if (strictApp) {
        await strictApp.close();
      }
      if (prevStrict !== undefined) {
        process.env.TENANCY_STRICT = prevStrict;
      } else {
        delete process.env.TENANCY_STRICT;
      }
      if (prevSeedOnBoot !== undefined) {
        process.env.SEED_ON_BOOT = prevSeedOnBoot;
      } else {
        delete process.env.SEED_ON_BOOT;
      }
    }
  });
});
