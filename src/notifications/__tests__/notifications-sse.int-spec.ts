import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import * as http from 'http';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AppModule } from '../../app.module';
import { buildDataSourceOptions } from '../../database/data-source';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from '../../common/tenancy/tenant-context';
import { TENANT_REGISTRY, TenantRegistry } from '../../common/tenancy/tenant-registry.interface';
import { TENANT_RESOLVER, TenantResolver } from '../../common/tenancy/tenant-resolver.interface';
import { installTenantConnectionHook } from '../../common/tenancy/tenant-connection.hook';
import { NotificationsService } from '../notifications.service';

const TENANT_SSE_A: TenantContext = { tenantId: 'tenant_sse_a', schema: 'tenant_sse_a' };
const TENANT_SSE_B: TenantContext = { tenantId: 'tenant_sse_b', schema: 'tenant_sse_b' };

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

describe('Notifications Real-time SSE Integration (Task P11c)', () => {
  jest.setTimeout(120_000);

  let adminDs: DataSource;
  let app: INestApplication;
  let jwtService: JwtService;
  let notificationsService: NotificationsService;
  let appPort: number;

  const headerTenantResolver: TenantResolver = {
    async resolve(req: Request): Promise<TenantContext> {
      const headerVal = req.headers['x-test-tenant'];
      const raw = Array.isArray(headerVal) ? headerVal[0] : headerVal;
      if (raw === 'tenant_sse_a') return TENANT_SSE_A;
      if (raw === 'tenant_sse_b') return TENANT_SSE_B;
      return DEFAULT_TENANT_CONTEXT;
    },
  };

  const testTenantRegistry: TenantRegistry = {
    async list(): Promise<TenantContext[]> {
      return [TENANT_SSE_A, TENANT_SSE_B];
    },
  };

  function createToken(userId: number, username: string, tid: string): string {
    return jwtService.sign({
      sub: userId,
      userId,
      username,
      group_id: 1,
      tid,
    });
  }

  function connectSse(options: {
    path?: string;
    token?: string;
    tenantId?: string;
  }): Promise<{
    req: http.ClientRequest;
    res: http.IncomingMessage;
    chunks: string[];
    waitForChunk: (predicate: (chunk: string) => boolean, timeoutMs?: number) => Promise<string>;
    close: () => void;
  }> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        Accept: 'text/event-stream',
      };
      if (options.token) {
        headers['Authorization'] = `Bearer ${options.token}`;
      }
      if (options.tenantId) {
        headers['X-Test-Tenant'] = options.tenantId;
      }

      const path = options.path || '/api/notifications/stream';
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: appPort,
          path,
          method: 'GET',
          headers,
        },
        (res) => {
          const chunks: string[] = [];
          const waitingListeners: Array<() => void> = [];

          res.on('data', (buf) => {
            const str = buf.toString('utf-8');
            chunks.push(str);
            for (const fn of waitingListeners) {
              fn();
            }
          });

          const waitForChunk = (
            predicate: (chunk: string) => boolean,
            timeoutMs = 5000,
          ): Promise<string> => {
            return new Promise((resChunk, rejChunk) => {
              const start = Date.now();
              const check = () => {
                const found = chunks.find(predicate);
                if (found) {
                  return resChunk(found);
                }
                if (Date.now() - start > timeoutMs) {
                  return rejChunk(
                    new Error(
                      `Timeout after ${timeoutMs}ms waiting for chunk matching condition. Chunks received: ${JSON.stringify(chunks)}`,
                    ),
                  );
                }
                waitingListeners.push(check);
              };
              check();
            });
          };

          const close = () => {
            req.destroy();
          };

          resolve({ req, res, chunks, waitForChunk, close });
        },
      );

      req.on('error', (err) => {
        reject(err);
      });

      req.end();
    });
  }

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
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_sse_a" CASCADE`);
    await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_sse_b" CASCADE`);
    await adminDs.query(`CREATE SCHEMA "tenant_sse_a"`);
    await adminDs.query(`CREATE SCHEMA "tenant_sse_b"`);

    await runMigrationsForSchema(TENANT_SSE_A.schema);
    await runMigrationsForSchema(TENANT_SSE_B.schema);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('pass123', salt);

    for (const schema of ['tenant_sse_a', 'tenant_sse_b']) {
      await adminDs.query(
        `INSERT INTO "${schema}"."user_groups" ("id", "name", "description") VALUES (1, 'Nhân viên Demo', 'Nhóm mặc định') ON CONFLICT DO NOTHING`,
      );
      await adminDs.query(
        `INSERT INTO "${schema}"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES (1, 'user1_${schema}', '${passwordHash}', 'User 1 ${schema}', 1, true) ON CONFLICT DO NOTHING`,
      );
      await adminDs.query(
        `INSERT INTO "${schema}"."users" ("id", "username", "password", "full_name", "group_id", "is_active") VALUES (2, 'user2_${schema}', '${passwordHash}', 'User 2 ${schema}', 1, true) ON CONFLICT DO NOTHING`,
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
    await app.listen(0);

    const address = app.getHttpServer().address();
    appPort = typeof address === 'object' && address ? address.port : 3000;

    jwtService = moduleRef.get(JwtService);
    notificationsService = moduleRef.get(NotificationsService);
  });

  afterAll(async () => {
    if (notificationsService) {
      notificationsService.closeAllConnections();
    }
    if (app) {
      await app.close();
    }
    if (adminDs && adminDs.isInitialized) {
      await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_sse_a" CASCADE`);
      await adminDs.query(`DROP SCHEMA IF EXISTS "tenant_sse_b" CASCADE`);
      await adminDs.destroy();
    }
  });

  afterEach(() => {
    if (notificationsService) {
      notificationsService.closeAllConnections();
    }
  });

  describe('1. Authentication and Query Token Rejection', () => {
    it('returns 401 when no token is provided', async () => {
      const conn = await connectSse({
        tenantId: 'tenant_sse_a',
      });
      expect(conn.res.statusCode).toBe(401);
      conn.close();
    });

    it('returns 401 when token is provided via query string without header', async () => {
      const token = createToken(1, 'user1_tenant_sse_a', 'tenant_sse_a');
      const conn = await connectSse({
        path: `/api/notifications/stream?token=${token}`,
        tenantId: 'tenant_sse_a',
      });
      expect(conn.res.statusCode).toBe(401);
      conn.close();
    });

    it('returns 401 when token is provided via query string even with auth header', async () => {
      const token = createToken(1, 'user1_tenant_sse_a', 'tenant_sse_a');
      const conn = await connectSse({
        path: `/api/notifications/stream?token=${token}`,
        token,
        tenantId: 'tenant_sse_a',
      });
      expect(conn.res.statusCode).toBe(401);
      conn.close();
    });
  });

  describe('2. User Isolation in Same Tenant', () => {
    it('user A receives its own notification; does not receive user B notification', async () => {
      const tokenUser1 = createToken(1, 'user1_tenant_sse_a', 'tenant_sse_a');
      const tokenUser2 = createToken(2, 'user2_tenant_sse_a', 'tenant_sse_a');

      const client1 = await connectSse({
        token: tokenUser1,
        tenantId: 'tenant_sse_a',
      });
      const client2 = await connectSse({
        token: tokenUser2,
        tenantId: 'tenant_sse_a',
      });

      expect(client1.res.statusCode).toBe(200);
      expect(client1.res.headers['content-type']).toContain('text/event-stream');
      expect(client1.res.headers['cache-control']).toContain('no-cache');
      expect(client1.res.headers['x-accel-buffering']).toBe('no');

      expect(client2.res.statusCode).toBe(200);

      // Create notification for User 1 on tenant_sse_a
      await TenantContext.run(TENANT_SSE_A, async () => {
        await notificationsService.create({
          user_id: 1,
          title: 'Tin riêng User 1',
          message: 'Chỉ gửi riêng cho User 1',
          type: 'INFO',
          link: '/tasks/101',
        });
      });

      // User 1 must receive the event
      const chunkUser1 = await client1.waitForChunk((c) => c.includes('Tin riêng User 1'));
      expect(chunkUser1).toContain('Tin riêng User 1');
      expect(chunkUser1).toContain('/tasks/101');

      // User 2 must NOT receive User 1's event
      const client2HasUser1Event = client2.chunks.some((c) => c.includes('Tin riêng User 1'));
      expect(client2HasUser1Event).toBe(false);

      // Now create notification for User 2 on tenant_sse_a
      await TenantContext.run(TENANT_SSE_A, async () => {
        await notificationsService.create({
          user_id: 2,
          title: 'Tin riêng User 2',
          message: 'Chỉ gửi riêng cho User 2',
          type: 'SUCCESS',
        });
      });

      const chunkUser2 = await client2.waitForChunk((c) => c.includes('Tin riêng User 2'));
      expect(chunkUser2).toContain('Tin riêng User 2');

      // User 1 must NOT receive User 2's event
      const client1HasUser2Event = client1.chunks.some((c) => c.includes('Tin riêng User 2'));
      expect(client1HasUser2Event).toBe(false);

      client1.close();
      client2.close();
    });
  });

  describe('3. Multi-Tenant Cross-Isolation with Identical User ID', () => {
    it('two tenants with identical user_id (id=1): only the corresponding tenant receives the event', async () => {
      const tokenTenantA = createToken(1, 'user1_tenant_sse_a', 'tenant_sse_a');
      const tokenTenantB = createToken(1, 'user1_tenant_sse_b', 'tenant_sse_b');

      const clientA = await connectSse({
        token: tokenTenantA,
        tenantId: 'tenant_sse_a',
      });
      const clientB = await connectSse({
        token: tokenTenantB,
        tenantId: 'tenant_sse_b',
      });

      expect(clientA.res.statusCode).toBe(200);
      expect(clientB.res.statusCode).toBe(200);

      // Send notification targeting user 1 in Tenant A
      await TenantContext.run(TENANT_SSE_A, async () => {
        await notificationsService.create({
          user_id: 1,
          title: 'Thông báo Tenant A',
          message: 'Nội dung riêng của Tenant A',
          type: 'INFO',
        });
      });

      // Tenant A client receives the event
      const chunkA = await clientA.waitForChunk((c) => c.includes('Thông báo Tenant A'));
      expect(chunkA).toContain('Thông báo Tenant A');

      // Tenant B client (same user_id=1) must NOT receive Tenant A's event
      const tenantBHasEvent = clientB.chunks.some((c) => c.includes('Thông báo Tenant A'));
      expect(tenantBHasEvent).toBe(false);

      // Now send notification targeting user 1 in Tenant B
      await TenantContext.run(TENANT_SSE_B, async () => {
        await notificationsService.create({
          user_id: 1,
          title: 'Thông báo Tenant B',
          message: 'Nội dung riêng của Tenant B',
          type: 'WARNING',
        });
      });

      // Tenant B client receives the event
      const chunkB = await clientB.waitForChunk((c) => c.includes('Thông báo Tenant B'));
      expect(chunkB).toContain('Thông báo Tenant B');

      // Tenant A client must NOT receive Tenant B's event
      const tenantAHasEvent = clientA.chunks.some((c) => c.includes('Thông báo Tenant B'));
      expect(tenantAHasEvent).toBe(false);

      clientA.close();
      clientB.close();
    });
  });

  describe('4. Disconnect Cleans Up Subscription & Observers', () => {
    it('disconnecting client releases RxJS subscription and connection count returns to 0', async () => {
      const token = createToken(1, 'user1_tenant_sse_a', 'tenant_sse_a');
      const client = await connectSse({
        token,
        tenantId: 'tenant_sse_a',
      });

      expect(client.res.statusCode).toBe(200);
      expect(notificationsService.getActiveConnectionsCount('tenant_sse_a', 1)).toBe(1);
      expect(notificationsService.getObserverCount()).toBeGreaterThanOrEqual(1);

      // Close the connection
      client.close();

      // Wait a tick for close event to propagate
      await new Promise((r) => setTimeout(r, 100));

      expect(notificationsService.getActiveConnectionsCount('tenant_sse_a', 1)).toBe(0);
      expect(notificationsService.getObserverCount()).toBe(0);
    });
  });

  describe('5. Max 5 Concurrent Connections Limit', () => {
    it('when 6th connection arrives for same user, oldest connection is closed', async () => {
      const token = createToken(1, 'user1_tenant_sse_a', 'tenant_sse_a');
      const connections: any[] = [];

      // Open 5 connections
      for (let i = 0; i < 5; i++) {
        const conn = await connectSse({
          token,
          tenantId: 'tenant_sse_a',
        });
        expect(conn.res.statusCode).toBe(200);
        connections.push(conn);
      }

      expect(notificationsService.getActiveConnectionsCount('tenant_sse_a', 1)).toBe(5);

      // Track closure on first connection
      let firstConnClosed = false;
      connections[0].res.on('close', () => {
        firstConnClosed = true;
      });
      connections[0].res.on('end', () => {
        firstConnClosed = true;
      });

      // Open 6th connection
      const conn6 = await connectSse({
        token,
        tenantId: 'tenant_sse_a',
      });
      expect(conn6.res.statusCode).toBe(200);
      connections.push(conn6);

      // Wait for server to end oldest connection
      await new Promise((r) => setTimeout(r, 150));

      expect(firstConnClosed).toBe(true);
      expect(notificationsService.getActiveConnectionsCount('tenant_sse_a', 1)).toBe(5);

      // Cleanup
      for (const c of connections) {
        c.close();
      }
    });
  });

  describe('6. Heartbeat Ping Comments', () => {
    it('heartbeat : ping comments appear periodically on stream', async () => {
      // Set short heartbeat interval for deterministic test (100ms)
      notificationsService.setDefaultHeartbeatInterval(100);

      const token = createToken(1, 'user1_tenant_sse_a', 'tenant_sse_a');
      const client = await connectSse({
        token,
        tenantId: 'tenant_sse_a',
      });

      expect(client.res.statusCode).toBe(200);

      // Wait for heartbeat chunk
      const pingChunk = await client.waitForChunk((c) => c.includes(': ping'), 3000);
      expect(pingChunk).toContain(': ping');

      client.close();
      notificationsService.setDefaultHeartbeatInterval(25_000); // restore default
    });
  });
});
