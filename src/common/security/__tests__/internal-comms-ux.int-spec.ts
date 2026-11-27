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
import { InternalCommsUx1795317990000 } from '../../../database/migrations/1795317990000-InternalCommsUx';

const TEST_SCHEMA = 'tenant_internal_comms_ux';
const TEST_TENANT: TenantContext = { tenantId: TEST_SCHEMA, schema: TEST_SCHEMA };

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

describeSuite('Internal Communications UX & Logic (Integration - Real DB & Migrations)', () => {
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

      // Seed Groups & Permissions
      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."user_groups" ("id", "name", "description") VALUES
        (1, 'Kinh doanh', 'Phòng Kinh doanh (Nhóm 1)'),
        (2, 'Kỹ thuật', 'Phòng Kỹ thuật (Nhóm 2)'),
        (3, 'Điều hành', 'Ban Điều hành (Moderator)')
        ON CONFLICT DO NOTHING;
      `);

      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."group_permissions" ("group_id", "module_code", "can_view", "can_create", "can_update", "can_delete") VALUES
        (3, 'SYSTEM', true, true, true, true),
        (3, 'USERS', true, true, true, true),
        (3, 'PROJECTS', true, true, true, true),
        (1, 'PROJECTS', true, true, true, true),
        (2, 'PROJECTS', true, true, true, true)
        ON CONFLICT DO NOTHING;
      `);

      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash('password123', salt);

      // User 1: admin
      // User 2: staff_a (group 1)
      // User 3: staff_b (group 1)
      // User 4: staff_y (group 2)
      // User 5: mod_user (group 3)
      await adminDs.query(`
        INSERT INTO "${TEST_SCHEMA}"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES
        (1, 'admin', '${hash}', 'Quản trị viên', 3, true),
        (2, 'staff_a', '${hash}', 'Nhân viên A', 1, true),
        (3, 'staff_b', '${hash}', 'Nhân viên B', 1, true),
        (4, 'staff_y', '${hash}', 'Nhân viên Y', 2, true),
        (5, 'mod_user', '${hash}', 'Moderator Hệ thống', 3, true)
        ON CONFLICT DO NOTHING;
      `);
    } catch (e) {
      console.error('[beforeAll error]', e);
      throw e;
    }
  });

  afterAll(async () => {
    try {
      if (app) await app.close();
      if (adminDs && adminDs.isInitialized) {
        await adminDs.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
        await adminDs.destroy();
      }
    } catch (e) {
      console.warn('[afterAll cleanup warning]', e);
    }
  });

  describe('1. Bỏ duyệt và gộp thông báo (D1, D2)', () => {
    it('route review không còn tồn tại (trả về 404)', async () => {
      const tokenAdmin = createToken({ id: 1, username: 'admin', full_name: 'Quản trị viên', group_id: 3 });
      await request(app!.getHttpServer())
        .put('/api/discussions/1/review')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .expect(404);
    });

    it('tạo thảo luận với type=ANNOUNCEMENT bị từ chối với 400', async () => {
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });
      await request(app!.getHttpServer())
        .post('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Thông báo giả dạng',
          content: 'Nội dung thông báo',
          type: 'ANNOUNCEMENT',
        })
        .expect(400);
    });
  });

  describe('2. Thông báo qua NotificationsService và @mentions', () => {
    let createdDiscussionId: number;

    it('tạo thảo luận trong nhóm gửi thông báo cho thành viên nhóm nhưng bỏ mention ngoài nhóm', async () => {
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });

      // Staff A (group 1) creates discussion in group 1, mentioning Staff B (group 1) and Staff Y (group 2)
      const res = await request(app!.getHttpServer())
        .post('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Thảo luận nội bộ nhóm 1',
          content: 'Nội dung dự án bảo mật',
          group_id: 1,
          mentioned_user_ids: [3, 4], // 3 is group 1 (valid), 4 is group 2 (invalid)
        })
        .expect(201);

      createdDiscussionId = res.body.id;

      // Check notifications in DB:
      // Staff B (user 3) must receive notification with link /workspace/discussions/:id
      const notiStaffB = await adminDs!.query(`
        SELECT * FROM "${TEST_SCHEMA}"."notifications" WHERE user_id = 3
      `);
      expect(notiStaffB.length).toBeGreaterThanOrEqual(1);
      expect(notiStaffB.some((n: any) => n.link === `/workspace/discussions/${createdDiscussionId}`)).toBe(true);

      // Staff Y (user 4, group 2) must NOT receive notification
      const notiStaffY = await adminDs!.query(`
        SELECT * FROM "${TEST_SCHEMA}"."notifications" WHERE user_id = 4
      `);
      expect(notiStaffY.length).toBe(0);

      // Staff A (sender, user 2) must NOT receive notification for own discussion
      const notiStaffA = await adminDs!.query(`
        SELECT * FROM "${TEST_SCHEMA}"."notifications" WHERE user_id = 2
      `);
      expect(notiStaffA.length).toBe(0);
    });

    it('bình luận gửi thông báo cho người tạo, không gửi cho chính người bình luận', async () => {
      const tokenB = createToken({ id: 3, username: 'staff_b', full_name: 'Nhân viên B', group_id: 1 });

      await request(app!.getHttpServer())
        .post(`/api/discussions/${createdDiscussionId}/comments`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({
          content: 'Bình luận phản hồi từ B',
        })
        .expect(201);

      // Creator (User 2) now receives comment notification
      const notiStaffA = await adminDs!.query(`
        SELECT * FROM "${TEST_SCHEMA}"."notifications" WHERE user_id = 2
      `);
      expect(notiStaffA.some((n: any) => n.link === `/workspace/discussions/${createdDiscussionId}`)).toBe(true);
    });
  });

  describe('3. Sửa bình luận và kiểm tra quyền sở hữu', () => {
    let commentId: number;

    beforeAll(async () => {
      // User 2 adds a comment
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });
      const discussions = await adminDs!.query(`SELECT id FROM "${TEST_SCHEMA}"."discussions" LIMIT 1`);
      const discId = discussions[0].id;

      const res = await request(app!.getHttpServer())
        .post(`/api/discussions/${discId}/comments`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Comment by Staff A' });
      const comments = await adminDs!.query(
        `SELECT id FROM "${TEST_SCHEMA}"."discussion_comments" WHERE user_id = 2 ORDER BY id DESC LIMIT 1`,
      );
      commentId = comments[0].id;
    });

    it('sửa bình luận của người khác trả về 403 (kể cả moderator)', async () => {
      const tokenB = createToken({ id: 3, username: 'staff_b', full_name: 'Nhân viên B', group_id: 1 });
      await request(app!.getHttpServer())
        .put(`/api/discussions/comments/${commentId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'Hacked by B' })
        .expect(403);

      const tokenMod = createToken({ id: 5, username: 'mod_user', full_name: 'Moderator Hệ thống', group_id: 3 });
      await request(app!.getHttpServer())
        .put(`/api/discussions/comments/${commentId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenMod}`)
        .send({ content: 'Mod edit' })
        .expect(403);
    });

    it('chính chủ sửa bình luận của mình trả về 200 và cập nhật edited_at', async () => {
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });
      const res = await request(app!.getHttpServer())
        .put(`/api/discussions/comments/${commentId}`)
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'Nội dung đã sửa hợp lệ' })
        .expect(200);

      expect(res.body.content).toContain('Nội dung đã sửa hợp lệ');
      expect(res.body.edited_at).toBeDefined();

      const dbComment = await adminDs!.query(
        `SELECT * FROM "${TEST_SCHEMA}"."discussion_comments" WHERE id = ${commentId}`,
      );
      expect(dbComment[0].edited_at).not.toBeNull();
    });
  });

  describe('4. discussion_reads: is_new và view_count', () => {
    let testDiscId: number;

    beforeAll(async () => {
      // User 2 creates a new discussion
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });
      const res = await request(app!.getHttpServer())
        .post('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Topic đọc thử', content: 'Thử nghiệm read tracking' });
      testDiscId = res.body.id;
    });

    it('is_new đổi sau khi mở và view_count không tăng khi cùng 1 user mở nhiều lần', async () => {
      const tokenB = createToken({ id: 3, username: 'staff_b', full_name: 'Nhân viên B', group_id: 1 });

      // Before opening: User B lists discussions -> is_new = true
      const listBefore = await request(app!.getHttpServer())
        .get('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const targetBefore = listBefore.body.data.find((d: any) => d.id === testDiscId);
      expect(targetBefore.is_new).toBe(true);

      // User B opens discussion 3 times
      for (let i = 0; i < 3; i++) {
        await request(app!.getHttpServer())
          .get(`/api/discussions/${testDiscId}`)
          .set('x-test-tenant', TEST_SCHEMA)
          .set('Authorization', `Bearer ${tokenB}`)
          .expect(200);
      }

      // After opening: User B lists discussions -> is_new = false
      const listAfter = await request(app!.getHttpServer())
        .get('/api/discussions')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      const targetAfter = listAfter.body.data.find((d: any) => d.id === testDiscId);
      expect(targetAfter.is_new).toBe(false);

      // view_count is exactly 2 (Creator Staff A + Reader Staff B)
      expect(targetAfter.view_count).toBe(2);
    });
  });

  describe('5. Phân trang, tìm theo tiêu đề, sắp xếp', () => {
    it('limit=500 bị giới hạn tối đa 50 và trả đúng cấu trúc { data, total, page, limit }', async () => {
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });
      const res = await request(app!.getHttpServer())
        .get('/api/discussions?limit=500')
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.limit).toBe(50);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(typeof res.body.total).toBe('number');
      expect(res.body.page).toBe(1);
    });

    it('tìm kiếm theo tiêu đề không phân biệt hoa thường', async () => {
      const tokenA = createToken({ id: 2, username: 'staff_a', full_name: 'Nhân viên A', group_id: 1 });
      const res = await request(app!.getHttpServer())
        .get('/api/discussions')
        .query({ q: 'tHảo LuẬn' })
        .set('x-test-tenant', TEST_SCHEMA)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      for (const d of res.body.data) {
        expect(d.title.toLowerCase()).toContain('thảo luận');
      }
    });
  });

  describe('6. Migration sửa link cũ trong notifications', () => {
    it('migration sửa link cũ /discussions?id=123 thành /workspace/discussions/123', async () => {
      // Insert old format link into notifications
      await adminDs!.query(`
        INSERT INTO "${TEST_SCHEMA}"."notifications" ("user_id", "title", "message", "link", "is_read")
        VALUES (2, 'Link cũ', 'Nội dung thông báo cũ', '/discussions?id=789', false);
      `);

      // Run migration down and up to verify link transformation cleanly
      const migration = new InternalCommsUx1795317990000();
      const qr = adminDs!.createQueryRunner();
      try {
        await qr.connect();
        await qr.query(`SET search_path TO "${TEST_SCHEMA}", public`);
        await migration.down(qr);
        await migration.up(qr);
      } finally {
        await qr.release();
      }

      const noti = await adminDs!.query(`
        SELECT * FROM "${TEST_SCHEMA}"."notifications" WHERE link LIKE '%789'
      `);
      expect(noti[0].link).toBe('/workspace/discussions/789');
    });
  });
});
