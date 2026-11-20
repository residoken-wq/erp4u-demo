import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { Customer, CustomerType } from '../../customers/customer.entity';
import { buildDataSourceOptions } from '../../database/data-source';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
} from '../../common/tenancy/tenant-context';
import { TENANT_REGISTRY, TenantRegistry } from '../../common/tenancy/tenant-registry.interface';
import { TENANT_RESOLVER, TenantResolver } from '../../common/tenancy/tenant-resolver.interface';
import { installTenantConnectionHook } from '../../common/tenancy/tenant-connection.hook';

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

describe('JWT Tenant Binding Cross-Tenant Security (SEC-2 Integration)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource;
  let app: INestApplication;
  let jwtService: JwtService;

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

    // Seed 1 user in each schema with IDENTICAL id=1, username='admin', group_id=1
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

    jwtService = moduleRef.get(JwtService);
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

  it('login at tenant_a issues token with tid=tenant_a; access at tenant_a succeeds (200), access at tenant_b fails (401)', async () => {
    // 1. Login at tenant_a
    const loginResA = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Test-Tenant', 'tenant_a')
      .send({ username: 'admin', password: 'admin123' });

    expect([200, 201]).toContain(loginResA.status);
    expect(loginResA.body.access_token).toBeDefined();
    const tokenA = loginResA.body.access_token;

    // Verify token payload contains claim tid = 'tenant_a'
    const decodedA = jwtService.decode(tokenA) as any;
    expect(decodedA).toBeDefined();
    expect(decodedA.tid).toBe('tenant_a');
    expect(decodedA.sub).toBe(1);
    expect(decodedA.username).toBe('admin');

    // 2. Call authenticated endpoint /api/auth/me at tenant_a with tokenA -> 200
    const meResA = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('X-Test-Tenant', 'tenant_a')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(meResA.status).toBe(200);
    expect(meResA.body.username).toBe('admin');
    expect(meResA.body.full_name).toBe('Admin User tenant_a');

    // 3. Call authenticated endpoint /api/auth/me at tenant_b with tokenA -> 401 TOKEN_TENANT_MISMATCH
    const meResB = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('X-Test-Tenant', 'tenant_b')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(meResB.status).toBe(401);
    expect(meResB.body.message).toBe('TOKEN_TENANT_MISMATCH');

    // 4. Also verify protected business endpoint /api/customers
    // Call at tenant_a -> 200
    const customersResA = await request(app.getHttpServer())
      .get('/api/customers')
      .set('X-Test-Tenant', 'tenant_a')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(customersResA.status).toBe(200);

    // Call at tenant_b -> 401
    const customersResB = await request(app.getHttpServer())
      .get('/api/customers')
      .set('X-Test-Tenant', 'tenant_b')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(customersResB.status).toBe(401);
    expect(customersResB.body.message).toBe('TOKEN_TENANT_MISMATCH');
  });

  it('rejects token without tid claim under TENANCY_STRICT=true with 401', async () => {
    // Generate legacy token without tid claim
    const legacyToken = jwtService.sign({
      sub: 1,
      username: 'admin',
      group_id: 1,
      full_name: 'Admin User',
    });

    const prevStrict = process.env.TENANCY_STRICT;
    process.env.TENANCY_STRICT = 'true';

    try {
      // Call at tenant_a with legacy token under strict mode -> 401
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('X-Test-Tenant', 'tenant_a')
        .set('Authorization', `Bearer ${legacyToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('TOKEN_TENANT_MISMATCH');
    } finally {
      if (prevStrict !== undefined) {
        process.env.TENANCY_STRICT = prevStrict;
      } else {
        delete process.env.TENANCY_STRICT;
      }
    }
  });

  it('rejects token without tid claim when target is not default tenant even in non-strict mode with 401', async () => {
    const prevStrict = process.env.TENANCY_STRICT;
    delete process.env.TENANCY_STRICT;

    try {
      // Legacy token without tid
      const legacyToken = jwtService.sign({
        sub: 1,
        username: 'admin',
        group_id: 1,
        full_name: 'Admin User',
      });

      // Calling tenant_a (not default) with token lacking tid must be rejected
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('X-Test-Tenant', 'tenant_a')
        .set('Authorization', `Bearer ${legacyToken}`);

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('TOKEN_TENANT_MISMATCH');
    } finally {
      if (prevStrict !== undefined) {
        process.env.TENANCY_STRICT = prevStrict;
      } else {
        delete process.env.TENANCY_STRICT;
      }
    }
  });
});
