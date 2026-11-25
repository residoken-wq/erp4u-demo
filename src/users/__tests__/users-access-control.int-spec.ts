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
import { PermissionCacheService } from '../../auth/permission-cache.service';

const TENANT_H1: TenantContext = {
  tenantId: 'tenant_users_h1',
  schema: 'tenant_users_h1',
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

describe('TASK H1 - UsersController Access Control & Privilege Escalation Hardening (Integration)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource;
  let app: INestApplication;
  let jwtService: JwtService;
  let permCacheService: PermissionCacheService;
  let dbAvailable = false;

  const headerTenantResolver: TenantResolver = {
    async resolve(req: Request): Promise<TenantContext> {
      const headerVal = req.headers['x-test-tenant'];
      const raw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
      if (raw === 'tenant_users_h1') return TENANT_H1;
      return DEFAULT_TENANT_CONTEXT;
    },
  };

  const testTenantRegistry: TenantRegistry = {
    async list(): Promise<TenantContext[]> {
      return [TENANT_H1];
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
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_users_h1" CASCADE`);
    await adminDs.query(`CREATE SCHEMA "tenant_users_h1"`);

    await runMigrationsForSchema(TENANT_H1.schema);

    const salt = await bcrypt.genSalt(10);
    const passAdmin = await bcrypt.hash('admin123', salt);
    const passStaffOld = await bcrypt.hash('oldPassword123!', salt);
    const passStaffUpdate = await bcrypt.hash('staffUpdate123!', salt);
    const passRegular = await bcrypt.hash('regularPass123!', salt);
    const passPeer = await bcrypt.hash('peerPass123!', salt);

    // Seed groups:
    // Group 1: Admin
    // Group 2: Staff No Perm
    // Group 3: Staff with USERS:update
    // Group 4: Peer Manager (has USERS:update)
    await adminDs.query(
      `INSERT INTO "tenant_users_h1"."user_groups" ("id", "name", "description") VALUES
       (1, 'Admin', 'Admin group'),
       (2, 'Staff No Perm', 'Staff without user permissions'),
       (3, 'Staff With Users Update', 'Has USERS:update permission'),
       (4, 'Peer Manager Group', 'Has USERS:update permission')
       ON CONFLICT DO NOTHING`,
    );

    await adminDs.query(
      `INSERT INTO "tenant_users_h1"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete") VALUES
       (3, 'USERS', false, false, true, false),
       (4, 'USERS', false, false, true, false)
       ON CONFLICT DO NOTHING`,
    );

    await adminDs.query(
      `INSERT INTO "tenant_users_h1"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES
       (1, 'admin', '${passAdmin}', 'Admin User', 1, true),
       (2, 'staff_no_perm', '${passStaffOld}', 'Staff No Perm', 2, true),
       (3, 'staff_users_update', '${passStaffUpdate}', 'Staff Users Update', 3, true),
       (4, 'staff_regular', '${passRegular}', 'Staff Regular Target', 2, true),
       (5, 'peer_manager', '${passPeer}', 'Peer Manager Target', 4, true)
       ON CONFLICT DO NOTHING`,
    );

    await adminDs.query(
      `SELECT setval(pg_get_serial_sequence('"tenant_users_h1"."users"', 'id'), 100, true)`,
    );

    // Default mode is SHADOW
    await adminDs.query(
      `INSERT INTO "tenant_users_h1"."system_configs" ("key", "value", "description") VALUES
       ('RBAC_MODE', 'SHADOW', 'RBAC')
       ON CONFLICT ("key") DO UPDATE SET "value" = 'SHADOW'`,
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
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (adminDs && adminDs.isInitialized) {
      await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_users_h1" CASCADE`);
      await adminDs.destroy();
    }
  });

  it('Staff không quyền: đổi mật khẩu admin (403), đổi mật khẩu user khác (403), tự đổi group_id (403), sửa permissions nhóm (403), xem users (403), tạo user (403)', async () => {
    if (!dbAvailable) return;

    permCacheService.clearAll();

    const tokenStaffNoPerm = jwtService.sign({
      sub: 2,
      username: 'staff_no_perm',
      group_id: 2,
      tid: 'tenant_users_h1',
    });

    // 1. Đổi mật khẩu admin -> 403
    const resChangeAdmin = await request(app.getHttpServer())
      .post('/api/users/1/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ password: 'hackedPassword123!' });
    expect(resChangeAdmin.status).toBe(403);

    // 2. Đổi mật khẩu user khác -> 403
    const resChangeOther = await request(app.getHttpServer())
      .post('/api/users/4/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ password: 'hackedPassword123!' });
    expect(resChangeOther.status).toBe(403);

    // 3. PUT /users/:id tự đổi group_id -> 403
    const resSelfElevate = await request(app.getHttpServer())
      .put('/api/users/2')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ group_id: 1 });
    expect(resSelfElevate.status).toBe(403);

    // 4. POST /users/groups/:id/permissions -> 403
    const resGroupPerms = await request(app.getHttpServer())
      .post('/api/users/groups/2/permissions')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ permissions: [{ module_code: 'USERS', can_view: true }] });
    expect(resGroupPerms.status).toBe(403);

    // 5. GET /users -> 403
    const resGetUsers = await request(app.getHttpServer())
      .get('/api/users')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`);
    expect(resGetUsers.status).toBe(403);

    // 6. POST /users -> 403
    const resCreateUser = await request(app.getHttpServer())
      .post('/api/users')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ username: 'evil_staff', password: 'password123!', full_name: 'Evil Staff' });
    expect(resCreateUser.status).toBe(403);
  });

  it('Staff tự đổi mật khẩu: thiếu/sai current_password (400); đúng (200) và đăng nhập được bằng mật khẩu mới', async () => {
    if (!dbAvailable) return;

    permCacheService.clearAll();

    const tokenStaffNoPerm = jwtService.sign({
      sub: 2,
      username: 'staff_no_perm',
      group_id: 2,
      tid: 'tenant_users_h1',
    });

    // 1. Thiếu current_password -> 400
    const resMissingCurrent = await request(app.getHttpServer())
      .post('/api/users/2/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ password: 'brandNewPassword123!' });
    expect(resMissingCurrent.status).toBe(400);

    // 2. Sai current_password -> 400
    const resWrongCurrent = await request(app.getHttpServer())
      .post('/api/users/2/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ current_password: 'wrongOldPassword', password: 'brandNewPassword123!' });
    expect(resWrongCurrent.status).toBe(400);

    // 3. Mật khẩu mới < 8 ký tự -> 400
    const resShortPass = await request(app.getHttpServer())
      .post('/api/users/2/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ current_password: 'oldPassword123!', password: 'short' });
    expect(resShortPass.status).toBe(400);

    // 4. Đúng current_password -> 200
    const resSuccess = await request(app.getHttpServer())
      .post('/api/users/2/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffNoPerm}`)
      .send({ current_password: 'oldPassword123!', password: 'brandNewPassword123!' });
    expect(resSuccess.status).toBe(200);

    // 5. Đăng nhập được bằng mật khẩu mới
    const resLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .send({ username: 'staff_no_perm', password: 'brandNewPassword123!' });
    expect([200, 201]).toContain(resLogin.status);
    expect(resLogin.body).toHaveProperty('access_token');
  });

  it('User có USERS:update (không phải admin): đổi mật khẩu staff thường (200); đổi mật khẩu admin (403); đổi mật khẩu user cùng nhóm USERS:update (403)', async () => {
    if (!dbAvailable) return;

    permCacheService.clearAll();

    const tokenStaffUpdate = jwtService.sign({
      sub: 3,
      username: 'staff_users_update',
      group_id: 3,
      tid: 'tenant_users_h1',
    });

    // 1. Đổi mật khẩu staff thường (user 4) -> 200
    const resChangeRegular = await request(app.getHttpServer())
      .post('/api/users/4/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffUpdate}`)
      .send({ password: 'regularNewPassword123!' });
    expect(resChangeRegular.status).toBe(200);

    // 2. Đổi mật khẩu admin (user 1) -> 403
    const resChangeAdmin = await request(app.getHttpServer())
      .post('/api/users/1/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffUpdate}`)
      .send({ password: 'adminHackedPassword123!' });
    expect(resChangeAdmin.status).toBe(403);

    // 3. Đổi mật khẩu user thuộc nhóm có USERS:update (peer_manager, user 5) -> 403 (chặn leo quyền ngang)
    const resChangePeer = await request(app.getHttpServer())
      .post('/api/users/5/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenStaffUpdate}`)
      .send({ password: 'peerHackedPassword123!' });
    expect(resChangePeer.status).toBe(403);
  });

  it('Admin: mọi thao tác trên đều thành công (200 / 201)', async () => {
    if (!dbAvailable) return;

    permCacheService.clearAll();

    const tokenAdmin = jwtService.sign({
      sub: 1,
      username: 'admin',
      group_id: 1,
      tid: 'tenant_users_h1',
    });

    // 1. Admin đổi mật khẩu user khác -> 200
    const resChangePass = await request(app.getHttpServer())
      .post('/api/users/4/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ password: 'adminResetRegularPass123!' });
    expect(resChangePass.status).toBe(200);

    // 2. Admin tự đổi mật khẩu với current_password -> 200
    const resAdminSelfChange = await request(app.getHttpServer())
      .post('/api/users/1/change-password')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ current_password: 'admin123', password: 'newAdminPassword123!' });
    expect(resAdminSelfChange.status).toBe(200);

    // 3. Admin PUT /users/:id đổi group_id -> 200
    const resPutUser = await request(app.getHttpServer())
      .put('/api/users/4')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ full_name: 'Regular Staff Updated By Admin', group_id: 2 });
    expect(resPutUser.status).toBe(200);

    // 4. Admin POST /users/groups/:id/permissions -> 200
    const resGroupPerms = await request(app.getHttpServer())
      .post('/api/users/groups/2/permissions')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ permissions: [{ module_code: 'USERS', can_view: true }] });
    expect([200, 201]).toContain(resGroupPerms.status);

    // 5. Admin GET /users -> 200
    const resGetUsers = await request(app.getHttpServer())
      .get('/api/users')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenAdmin}`);
    expect(resGetUsers.status).toBe(200);
    expect(Array.isArray(resGetUsers.body)).toBe(true);

    // 6. Admin POST /users -> 201
    const resCreateUser = await request(app.getHttpServer())
      .post('/api/users')
      .set('X-Test-Tenant', 'tenant_users_h1')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        username: 'new_user_by_admin',
        password: 'newPassword123!',
        full_name: 'Created by Admin',
        group_id: 2,
      });
    expect([200, 201]).toContain(resCreateUser.status);
  });
});
