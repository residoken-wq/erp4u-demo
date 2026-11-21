import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import * as request from 'supertest';
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
import { RateLimitService } from '../../common/security/rate-limit';

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

describe('Rate Limit Cross-Tenant Isolation Integration (Task P7c6a)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource;
  let app: INestApplication;
  let rateLimitService: RateLimitService;

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

    await adminDs.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA public`);
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_a" CASCADE`);
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_b" CASCADE`);
    await adminDs.query(`CREATE SCHEMA "tenant_a"`);
    await adminDs.query(`CREATE SCHEMA "tenant_b"`);

    await runMigrationsForSchema(TENANT_A.schema);
    await runMigrationsForSchema(TENANT_B.schema);

    // Seed admin in both tenant_a and tenant_b with identical password 'admin123'
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    for (const schema of ['tenant_a', 'tenant_b']) {
      await adminDs.query(
        `INSERT INTO "${schema}"."user_groups" ("id", "name", "description") VALUES (1, 'Admin', 'Admin group') ON CONFLICT DO NOTHING`,
      );
      await adminDs.query(
        `INSERT INTO "${schema}"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES (1, 'admin', '${passwordHash}', 'Admin User ${schema}', 1, true) ON CONFLICT DO NOTHING`,
      );
      await adminDs.query(
        `SELECT setval(pg_get_serial_sequence('"${schema}"."user_groups"', 'id'), 100, true)`,
      );
      await adminDs.query(
        `SELECT setval(pg_get_serial_sequence('"${schema}"."users"', 'id'), 100, true)`,
      );
    }

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

    rateLimitService = moduleRef.get(RateLimitService);
  });

  beforeEach(async () => {
    await rateLimitService.clearAll();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (adminDs && adminDs.isInitialized) {
      try {
        await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_a" CASCADE`);
        await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_b" CASCADE`);
      } catch {}
      await adminDs.destroy();
    }
  });

  it('lockout in tenant_a does not affect tenant_b for the same username', async () => {
    const ip = '10.99.1.1';

    // 10 failed login attempts on tenant_a
    for (let i = 1; i <= 10; i++) {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-test-tenant', 'tenant_a')
        .set('X-Forwarded-For', ip)
        .send({ username: 'admin', password: 'wrong_password' });
      expect(res.status).toBe(401);
    }

    // 11th attempt on tenant_a: blocked with 429
    const blockedA = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-test-tenant', 'tenant_a')
      .set('X-Forwarded-For', ip)
      .send({ username: 'admin', password: 'admin123' });

    expect(blockedA.status).toBe(429);
    expect(blockedA.body.code).toBe('RATE_LIMITED');
    expect(blockedA.headers['retry-after']).toBeDefined();

    // Now attempt login on tenant_b with identical IP and username:
    // MUST SUCCEED (200/201) because tenant_a and tenant_b have completely separate rate-limit keys!
    const successB = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('x-test-tenant', 'tenant_b')
      .set('X-Forwarded-For', ip)
      .send({ username: 'admin', password: 'admin123' });

    expect(successB.status).toBe(201);
    expect(successB.body.access_token).toBeDefined();
  });
});
