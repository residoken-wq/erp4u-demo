import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import * as bcrypt from 'bcrypt';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../../app.module';
import { buildDataSourceOptions } from '../../../database/data-source';
import { installTenantConnectionHook } from '../../tenancy/tenant-connection.hook';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from '../../tenancy/tenant-context';
import { TENANT_REGISTRY, TenantRegistry } from '../../tenancy/tenant-registry.interface';
import { TENANT_RESOLVER, TenantResolver } from '../../tenancy/tenant-resolver.interface';
import { InternalCommsSecurity1795317970000 } from '../../../database/migrations/1795317970000-InternalCommsSecurity';

const TEST_SCHEMA = 'tenant_internal_comms';
const TEST_TENANT: TenantContext = { tenantId: TEST_SCHEMA, schema: TEST_SCHEMA };
const TEST_QUOTE_UUID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const hasDbConfig = Boolean(process.env.CI || process.env.DB_HOST || process.env.DATABASE_URL);
const describeSuite = hasDbConfig ? describe : describe.skip;

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

describeSuite('Internal Communications Security (Integration - Real DB & Migrations)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource | null = null;
  let app: INestApplication | null = null;
  let jwtService: JwtService | null = null;

  const headerTenantResolver: TenantResolver = {
    async resolve(req: Request): Promise<TenantContext> {
      const headerVal = req.headers['x-test-tenant'];
      const raw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
      if (raw === TEST_SCHEMA) return TEST_TENANT;
      return DEFAULT_TENANT_CONTEXT;
    },
  };

  const testTenantRegistry: TenantRegistry = {
    async list(): Promise<TenantContext[]> {
      return [TEST_TENANT];
    },
  };

  function createToken(user: { id: number; username: string; full_name: string; group_id: number | null }): string {
    if (!jwtService) throw new Error('JwtService not initialized');
    return jwtService.sign({
      sub: user.id,
      userId: user.id,
      username: user.username,
      full_name: user.full_name,
      group_id: user.group_id,
      tid: TEST_SCHEMA,
    });
  }

  beforeAll(async () => {
    process.env.DB_AUTO_MIGRATE = 'false';
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
      await adminDs.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
      await adminDs.query(`CREATE SCHEMA "${TEST_SCHEMA}"`);

      await runMigrationsForSchema(TEST_SCHEMA);

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

      // Seed Groups & Permissions in schema
      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."user_groups" ("id", "name", "description") VALUES
        (1, 'Kinh doanh', 'Phòng Kinh doanh (Nhóm X)'),
        (2, 'Kỹ thuật', 'Phòng Kỹ thuật (Nhóm Y)'),
        (3, 'Điều hành', 'Ban Điều hành (Moderator)')
        ON CONFLICT DO NOTHING;
      `);

      // Seed Group Permissions:
      // Group 3 has SYSTEM:update (Moderator), USERS:view/create/update/delete, and SALES:view/create/update/delete
      // Group 1 has PROJECTS only (NO USERS, NO SALES permissions)
      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete") VALUES
        (3, 'SYSTEM', true, true, true, true),
        (3, 'USERS', true, true, true, true),
        (3, 'SALES', true, true, true, true),
        (3, 'PROJECTS', true, true, true, true),
        (1, 'PROJECTS', true, true, true, true),
        (2, 'PROJECTS', true, true, true, true)
        ON CONFLICT DO NOTHING;
      `);

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('password123', salt);

      // Seed Users:
      // User 1: admin (username: admin)
      // User 2: staff A (group 1)
      // User 3: staff B (group 1)
      // User 4: staff X (group 1) - lacks USERS and SALES permissions
      // User 5: staff Y (group 2)
      // User 6: moderator (group 3, SYSTEM:update, USERS and SALES permissions)
      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES
        (1, 'admin', '${hash}', 'Quản trị viên', 3, true),
        (2, 'staff_a', '${hash}', 'Nhân viên A', 1, true),
        (3, 'staff_b', '${hash}', 'Nhân viên B', 1, true),
        (4, 'staff_x', '${hash}', 'Nhân viên Nhóm X', 1, true),
        (5, 'staff_y', '${hash}', 'Nhân viên Nhóm Y', 2, true),
        (6, 'mod_user', '${hash}', 'Moderator Hệ thống', 3, true)
        ON CONFLICT DO NOTHING;
      `);

      // Seed Employee record for staff A (user_id = 2) to test assigned_to contact restoration
      // Real schema: ("id", "user_id", "phone", "full_name", "is_active")
      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."employees" ("id", "user_id", "phone", "full_name", "is_active") VALUES
        (101, 2, '0900000001', 'Nhân viên A', true)
        ON CONFLICT DO NOTHING;
      `);

      // Seed Customer and Sales Order for customer portal testing
      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."customers" ("id", "code", "name", "phone", "email") VALUES
        (1, 'KH-001', 'Khách hàng Demo', '0900000000', 'khach@example.com')
        ON CONFLICT DO NOTHING;
      `);

      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."sales_orders" ("id", "uuid", "order_code", "customer_id", "assigned_to_id", "status", "total_amount") VALUES
        (1, '${TEST_QUOTE_UUID}', 'SO-INT-001', 1, 2, 'QUOTATION', 1000000)
        ON CONFLICT DO NOTHING;
      `);
    } catch (err: any) {
      if (hasDbConfig) {
        throw err;
      }
      console.warn('Skipping Postgres DB integration test suite (no local postgres available):', err.message);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (adminDs && adminDs.isInitialized) {
      try {
        await adminDs.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
      } catch {}
      await adminDs.destroy();
    }
  });

  describe('1. Cổng khách hàng (Customer Portal)', () => {
    it('route theo id cũ trả về 404', async () => {
      await request(app!.getHttpServer())
        .post('/api/public/portal/quote/1/comment')
        .set('x-test-tenant', TEST_SCHEMA)
        .send({ content: 'Test comment' })
        .expect(404);

      await request(app!.getHttpServer())
        .delete('/api/public/portal/quote/comment/1')
        .set('x-test-tenant', TEST_SCHEMA)
        .expect(404);
    });

    it('POST theo uuid ép sender_type=CUSTOMER, comment_type=CUSTOMER, bỏ qua mentioned_user_ids và không tạo thông báo', async () => {
      const postRes = await request(app!.getHttpServer())
        .post(`/api/public/portal/quote/${TEST_QUOTE_UUID}/comment`)
        .set('x-test-tenant', TEST_SCHEMA)
        .send({
          sender: 'STAFF',
          comment_type: 'INTERNAL',
          mentioned_user_ids: '1,2',
          name: 'Khách Test',
          content: '<p>Ý kiến khách hàng</p>',
        })
        .expect(201);

      expect(postRes.body.sender_type).toBe('CUSTOMER');
      expect(postRes.body.comment_type).toBe('CUSTOMER');
      expect(postRes.body.is_visible).toBe(true);

      // Verify DB record
      const rows = await adminDs!.query(
        `SELECT * FROM "${TEST_SCHEMA}"."sales_comments" WHERE order_id = 1 AND content LIKE '%Ý kiến khách hàng%'`,
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].sender_type).toBe('CUSTOMER');
      expect(rows[0].comment_type).toBe('CUSTOMER');
      expect(rows[0].mentioned_user_ids).toBeNull();

      // Verify no notifications created for mentioned_user_ids
      const notiRows = await adminDs!.query(
        `SELECT * FROM "${TEST_SCHEMA}"."notifications" WHERE user_id IN (1, 2) AND message LIKE '%Ý kiến khách hàng%'`,
      );
      expect(notiRows).toHaveLength(0);
    });

    it('lần bình luận thứ 21 trong giờ bị giới hạn tần suất 429', async () => {
      // Seed 19 more comments so total is 20 in the last hour
      for (let i = 0; i < 19; i++) {
        await adminDs!.query(
          `INSERT INTO "${TEST_SCHEMA}"."sales_comments" ("order_id", "content", "sender_type", "comment_type", "is_visible", "created_at") VALUES
           (1, 'Rapid comment ${i}', 'CUSTOMER', 'CUSTOMER', true, NOW())`,
        );
      }

      // 21st comment attempt must fail with 429
      const res = await request(app!.getHttpServer())
        .post(`/api/public/portal/quote/${TEST_QUOTE_UUID}/comment`)
        .set('x-test-tenant', TEST_SCHEMA)
        .send({ content: '21st comment in hour' });

      expect(res.status).toBe(429);
    });

    it('DELETE bình luận của STAFF qua uuid trả về 404', async () => {
      const staffComment = await adminDs!.query(
        `INSERT INTO "${TEST_SCHEMA}"."sales_comments" ("order_id", "content", "sender_type", "comment_type", "is_visible", "created_at") VALUES
         (1, 'Staff private comment', 'STAFF', 'INTERNAL', false, NOW()) RETURNING id`,
      );
      const staffCommentId = staffComment[0].id;

      // Attempt customer deletion on staff comment
      await request(app!.getHttpServer())
        .delete(`/api/public/portal/quote/${TEST_QUOTE_UUID}/comment/${staffCommentId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .expect(404);
    });

    it('GET portal theo uuid không chứa bình luận INTERNAL, không chứa mentioned_user_ids, và assigned_to chỉ có đúng 4 keys', async () => {
      const res = await request(app!.getHttpServer())
        .get(`/api/public/portal/quote/${TEST_QUOTE_UUID}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .expect(200);

      const quote = res.body;

      // Check comments: no INTERNAL, no mentioned_user_ids
      expect(Array.isArray(quote.comments)).toBe(true);
      for (const c of quote.comments) {
        expect(c.comment_type).not.toBe('INTERNAL');
        expect(c).not.toHaveProperty('mentioned_user_ids');
      }

      // Check assigned_to contact info: exactly 4 keys
      expect(quote.assigned_to).toBeDefined();
      expect(quote.assigned_to.id).toBe(2);
      expect(quote.assigned_to.full_name).toBe('Nhân viên A');
      expect(quote.assigned_to.phone).toBe('0900000001');
      expect(Object.keys(quote.assigned_to).sort()).toEqual(['email', 'full_name', 'id', 'phone']);
      expect(quote.assigned_to.ip_address).toBeUndefined();
      expect(quote.assigned_to.username).toBeUndefined();
      expect(quote.assigned_to.group).toBeUndefined();
    });
  });

  describe('2. Thảo luận (Discussions)', () => {
    let discGroupYId: number;
    let discAId: number;

    it('user nhóm X xem hoặc bình luận thảo luận nhóm Y trả về 404', async () => {
      // User 5 (staff_y, group 2) creates discussion in Group 2 (Group Y)
      const tokenY = createToken({ id: 5, username: 'staff_y', full_name: 'Nhân viên Nhóm Y', group_id: 2 });
      const createY = await request(app!.getHttpServer())
        .post('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenY}`)
        .send({
          title: 'Thảo luận nội bộ nhóm Y',
          content: '<p>Chỉ nhóm Y được xem</p>',
          group_id: 2,
        })
        .expect(201);

      discGroupYId = createY.body.id;

      // User 4 (staff_x, group 1) attempts to view or comment -> 404
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });

      await request(app!.getHttpServer())
        .get(`/api/discussions/${discGroupYId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .expect(404);

      await request(app!.getHttpServer())
        .post(`/api/discussions/${discGroupYId}/comments`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .send({ content: 'Spam comment' })
        .expect(404);
    });

    it('người không phải moderator tạo thảo luận vào nhóm khác trả về 403', async () => {
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      await request(app!.getHttpServer())
        .post('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .send({
          title: 'Attempt in other group',
          content: '<p>Testing group check</p>',
          group_id: 2, // Group Y
        })
        .expect(403);
    });

    it('body creator_id giả bị bỏ qua, lấy đúng token user id', async () => {
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });
      const res = await request(app!.getHttpServer())
        .post('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Chủ đề của A',
          content: '<p>Nội dung</p>',
          creator_id: 999, // Fake creator_id in payload
        })
        .expect(201);

      expect(res.body.creator_id).toBe(2);
      discAId = res.body.id;
    });

    it('User B sửa hoặc xóa thảo luận của User A trả về 403', async () => {
      const tokenB = createToken({ id: 3, username: 'staff_b', full_name: 'Nhân viên B', group_id: 1 });

      await request(app!.getHttpServer())
        .put(`/api/discussions/${discAId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ title: 'User B unauthorized edit' })
        .expect(403);

      await request(app!.getHttpServer())
        .delete(`/api/discussions/${discAId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(403);
    });

    it('Moderator (SYSTEM:update) sửa thảo luận của người khác trả về 403, nhưng ghim thảo luận trả về 200', async () => {
      // User 6 has group 3 which has SYSTEM:update
      const tokenMod = createToken({ id: 6, username: 'mod_user', full_name: 'Moderator Hệ thống', group_id: 3 });

      await request(app!.getHttpServer())
        .put(`/api/discussions/${discAId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenMod}`)
        .send({ title: 'Moderator updated title' })
        .expect(403);

      await request(app!.getHttpServer())
        .put(`/api/discussions/${discAId}/pin`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenMod}`)
        .send({ pinned: true })
        .expect(200);
    });
  });

  describe('3. Thông báo nội bộ (Announcements)', () => {
    let annGroup1Id: number;
    let annGroup2Id: number;

    it('lọc :groupId = ANY(target_group_ids) trên Postgres đúng', async () => {
      // Insert announcements:
      // Ann 1: targeted to Group 1
      // Ann 2: targeted to Group 2
      const r1 = await adminDs!.query(`
        INSERT INTO "${TEST_SCHEMA}"."announcements" ("title", "content", "target_group_ids", "is_active", "created_by") VALUES
        ('Thông báo nhóm 1', '<p>Dành riêng nhóm 1</p>', ARRAY[1], true, 1) RETURNING id;
      `);
      annGroup1Id = r1[0].id;

      const r2 = await adminDs!.query(`
        INSERT INTO "${TEST_SCHEMA}"."announcements" ("title", "content", "target_group_ids", "is_active", "created_by") VALUES
        ('Thông báo nhóm 2', '<p>Dành riêng nhóm 2</p>', ARRAY[2], true, 1) RETURNING id;
      `);
      annGroup2Id = r2[0].id;

      // User in Group 1 calls active announcements
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      const res = await request(app!.getHttpServer())
        .get('/api/announcements/user/active')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .expect(200);

      const ids = res.body.map((a: any) => a.id);
      expect(ids).toContain(annGroup1Id);
      expect(ids).not.toContain(annGroup2Id);
    });

    it('đánh dấu đọc thông báo của nhóm khác trả về 404', async () => {
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      await request(app!.getHttpServer())
        .post(`/api/announcements/${annGroup2Id}/read`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .expect(404);
    });

    it('nhân viên không có quyền USERS:create đánh dấu đọc thông báo nhóm mình trả về 201', async () => {
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      await request(app!.getHttpServer())
        .post(`/api/announcements/${annGroup1Id}/read`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .expect(201);
    });

    it('GET /announcements quản trị không có USERS:view trả về 403; có USERS:view hoặc admin trả về 200', async () => {
      // User 4 (staff_x, group 1) lacks USERS:view
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      await request(app!.getHttpServer())
        .get('/api/announcements')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .expect(403);

      // Moderator (group 3) has USERS:view -> 200
      const tokenMod = createToken({ id: 6, username: 'mod_user', full_name: 'Moderator Hệ thống', group_id: 3 });
      await request(app!.getHttpServer())
        .get('/api/announcements')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenMod}`)
        .expect(200);

      // Admin -> 200
      const tokenAdmin = createToken({ id: 1, username: 'admin', full_name: 'Quản trị viên', group_id: 3 });
      await request(app!.getHttpServer())
        .get('/api/announcements')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(200);
    });

    it('POST /announcements không có USERS:create trả về 403; có USERS:create hoặc admin trả về 201', async () => {
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      await request(app!.getHttpServer())
        .post('/api/announcements')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .send({ title: 'Unauthorized Ann', content: 'Test' })
        .expect(403);

      const tokenMod = createToken({ id: 6, username: 'mod_user', full_name: 'Moderator Hệ thống', group_id: 3 });
      await request(app!.getHttpServer())
        .post('/api/announcements')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenMod}`)
        .send({ title: 'Authorized Ann', content: 'Test' })
        .expect(201);
    });
  });

  describe('4. Chat đơn hàng phía nhân viên (Sales Comments)', () => {
    it('staff không có SALES:create gửi chat đơn hàng trả về 403; có SALES:create hoặc admin trả về 201', async () => {
      // User 4 (staff_x, group 1) lacks SALES:create
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      await request(app!.getHttpServer())
        .post('/api/sales/1/comment')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .send({ content: 'Nhân viên chat', comment_type: 'INTERNAL' })
        .expect(403);

      // Moderator (group 3) has SALES:create -> 201
      const tokenMod = createToken({ id: 6, username: 'mod_user', full_name: 'Moderator Hệ thống', group_id: 3 });
      const createRes = await request(app!.getHttpServer())
        .post('/api/sales/1/comment')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenMod}`)
        .send({ content: 'Mod chat', comment_type: 'INTERNAL' })
        .expect(201);

      expect(createRes.body.sender_type).toBe('STAFF');

      // Admin -> 201
      const tokenAdmin = createToken({ id: 1, username: 'admin', full_name: 'Quản trị viên', group_id: 3 });
      await request(app!.getHttpServer())
        .post('/api/sales/1/comment')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ content: 'Admin chat', comment_type: 'INTERNAL' })
        .expect(201);
    });

    it('staff không có SALES:view xem bình luận đơn hàng trả về 403; có SALES:view trả về 200', async () => {
      const tokenX = createToken({ id: 4, username: 'staff_x', full_name: 'Nhân viên Nhóm X', group_id: 1 });
      await request(app!.getHttpServer())
        .get('/api/sales/1/comments')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenX}`)
        .expect(403);

      const tokenMod = createToken({ id: 6, username: 'mod_user', full_name: 'Moderator Hệ thống', group_id: 3 });
      await request(app!.getHttpServer())
        .get('/api/sales/1/comments')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenMod}`)
        .expect(200);
    });
  });

  describe('5. Migration 1795317970000 Data Parity & Department Mapping', () => {
    it('ánh xạ target_departments: khớp tên nhóm (không phân biệt hoa/thường) -> target_group_ids đúng; không khớp -> is_active=false', async () => {
      const MIGRATION_SCHEMA = 'tenant_mig_check';
      await adminDs!.query(`DROP SCHEMA IF EXISTS "${MIGRATION_SCHEMA}" CASCADE`);
      await adminDs!.query(`CREATE SCHEMA "${MIGRATION_SCHEMA}"`);

      // Create base tables before migration 1795317970000
      await adminDs!.query(`
        CREATE TABLE "${MIGRATION_SCHEMA}"."user_groups" (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL
        );
        INSERT INTO "${MIGRATION_SCHEMA}"."user_groups" (id, name) VALUES
        (1, 'Kinh Doanh'),
        (2, 'Kỹ Thuật');

        CREATE TABLE "${MIGRATION_SCHEMA}"."sales_comments" (
          id SERIAL PRIMARY KEY
        );

        CREATE TABLE "${MIGRATION_SCHEMA}"."announcements" (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          target_departments TEXT
        );

        INSERT INTO "${MIGRATION_SCHEMA}"."announcements" (id, title, is_active, target_departments) VALUES
        (1, 'Khớp chính xác hoa thường', true, 'kinh doanh'),
        (2, 'Khớp có khoảng trắng', true, '  KỸ THUẬT  '),
        (3, 'Không khớp phòng ban', true, 'Phòng Ban Không Tồn Tại');
      `);

      const migration = new InternalCommsSecurity1795317970000();
      const qr = adminDs!.createQueryRunner();
      try {
        await qr.connect();
        await qr.query(`SET search_path TO "${MIGRATION_SCHEMA}", public`);
        await migration.up(qr);
      } finally {
        await qr.release();
      }

      // Verify announcement 1: matched group 1
      const a1 = await adminDs!.query(`SELECT * FROM "${MIGRATION_SCHEMA}"."announcements" WHERE id = 1`);
      expect(a1[0].target_group_ids).toEqual([1]);
      expect(a1[0].is_active).toBe(true);

      // Verify announcement 2: matched group 2
      const a2 = await adminDs!.query(`SELECT * FROM "${MIGRATION_SCHEMA}"."announcements" WHERE id = 2`);
      expect(a2[0].target_group_ids).toEqual([2]);
      expect(a2[0].is_active).toBe(true);

      // Verify announcement 3: unmatched -> is_active = false
      const a3 = await adminDs!.query(`SELECT * FROM "${MIGRATION_SCHEMA}"."announcements" WHERE id = 3`);
      expect(a3[0].is_active).toBe(false);

      // Cleanup schema
      await adminDs!.query(`DROP SCHEMA IF EXISTS "${MIGRATION_SCHEMA}" CASCADE`);
    });
  });
});
