import {
  assertValidTenantSchema,
  buildSetSearchPathSql,
  DEFAULT_TENANT_CONTEXT,
  quoteSchemaIdentifier,
  TenantContext,
} from '../tenant-context';
import {
  PgPoolLike,
  TenantPgClient,
  wrapPgPoolConnect,
} from '../tenant-connection.hook';
import { buildDataSourceOptions } from '../../../database/data-source';

describe('TenantContext', () => {
  const originalStrict = process.env.TENANCY_STRICT;

  afterEach(() => {
    if (originalStrict === undefined) {
      delete process.env.TENANCY_STRICT;
    } else {
      process.env.TENANCY_STRICT = originalStrict;
    }
  });

  it('returns default tenant/public when outside TenantContext.run and TENANCY_STRICT is not true', () => {
    delete process.env.TENANCY_STRICT;
    expect(TenantContext.current()).toEqual(DEFAULT_TENANT_CONTEXT);

    process.env.TENANCY_STRICT = 'false';
    expect(TenantContext.current()).toEqual({
      tenantId: 'default',
      schema: 'public',
    });
  });

  it('supports nested TenantContext.run and restores outer context', () => {
    const outer = { tenantId: 't_a', schema: 'tenant_a' };
    const inner = { tenantId: 't_b', schema: 'tenant_b' };

    const result = TenantContext.run(outer, () => {
      expect(TenantContext.current()).toEqual(outer);

      const innerResult = TenantContext.run(inner, () => {
        expect(TenantContext.current()).toEqual(inner);
        return 'inner-ok';
      });

      expect(innerResult).toBe('inner-ok');
      expect(TenantContext.current()).toEqual(outer);
      return 'outer-ok';
    });

    expect(result).toBe('outer-ok');
    expect(TenantContext.current()).toEqual(DEFAULT_TENANT_CONTEXT);
  });

  it('preserves isolated contexts across async boundaries and concurrent tasks', async () => {
    const delay = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    const [seenA, seenB] = await Promise.all([
      TenantContext.run({ tenantId: 'a', schema: 'tenant_a' }, async () => {
        const before = TenantContext.current().schema;
        await delay(25);
        await Promise.resolve();
        const after = TenantContext.current().schema;
        return [before, after];
      }),
      TenantContext.run({ tenantId: 'b', schema: 'tenant_b' }, async () => {
        const before = TenantContext.current().schema;
        await delay(10);
        await Promise.resolve();
        const after = TenantContext.current().schema;
        return [before, after];
      }),
    ]);

    expect(seenA).toEqual(['tenant_a', 'tenant_a']);
    expect(seenB).toEqual(['tenant_b', 'tenant_b']);
  });

  it('validates schema names strictly against SQL injection and invalid identifiers', () => {
    const validSchemas = ['public', 'tenant_a', '_sys_01', 'a'.repeat(63)];
    for (const s of validSchemas) {
      expect(assertValidTenantSchema(s)).toBe(s);
      expect(quoteSchemaIdentifier(s)).toBe(`"${s}"`);
      expect(buildSetSearchPathSql(s)).toBe(`SET search_path TO "${s}", public`);
    }

    const invalidSchemas = [
      '',
      'Tenant_A',
      '1tenant',
      'tenant-a',
      'tenant a',
      'public; DROP TABLE users;--',
      'public"',
      'a'.repeat(64),
      'tenant.a',
    ];
    for (const bad of invalidSchemas) {
      expect(() => assertValidTenantSchema(bad)).toThrow(/Invalid tenant schema/);
      expect(() =>
        TenantContext.run({ tenantId: 'bad', schema: bad }, () => 'nope'),
      ).toThrow(/Invalid tenant schema/);
    }
  });

  it('throws in strict mode (TENANCY_STRICT=true) when outside TenantContext.run', () => {
    process.env.TENANCY_STRICT = 'true';

    expect(() => TenantContext.current()).toThrow(/TENANCY_STRICT=true/);

    const inside = TenantContext.run(
      { tenantId: 'strict_a', schema: 'tenant_a' },
      () => TenantContext.current(),
    );
    expect(inside).toEqual({ tenantId: 'strict_a', schema: 'tenant_a' });

    expect(() => TenantContext.current()).toThrow(/TENANCY_STRICT=true/);
  });
});

describe('wrapPgPoolConnect', () => {
  const originalStrict = process.env.TENANCY_STRICT;

  afterEach(() => {
    if (originalStrict === undefined) {
      delete process.env.TENANCY_STRICT;
    } else {
      process.env.TENANCY_STRICT = originalStrict;
    }
  });

  function createMockPool(client: TenantPgClient) {
    const release = jest.fn();
    client.release = release;

    const pool: PgPoolLike = {
      connect(cb?: any): any {
        if (typeof cb === 'function') {
          cb(undefined, client, release);
          return;
        }
        return Promise.resolve(client);
      },
    };

    wrapPgPoolConnect(pool);
    // Calling twice must be idempotent
    wrapPgPoolConnect(pool);

    return { pool, release };
  }

  it('sets search_path only when client schema changes (callback form)', async () => {
    const queries: string[] = [];
    const client: TenantPgClient = {
      query: jest.fn((sql: string, cb?: (err?: Error | null) => void) => {
        queries.push(sql);
        cb?.(null);
      }),
    };
    const { pool } = createMockPool(client);

    const checkout = () =>
      new Promise<TenantPgClient>((resolve, reject) => {
        pool.connect((err, c) => (err ? reject(err) : resolve(c)));
      });

    await TenantContext.run({ tenantId: 'a', schema: 'tenant_a' }, async () => {
      await checkout();
      await checkout();
    });

    expect(queries).toEqual(['SET search_path TO "tenant_a", public']);
    expect(client.__erp4uSchema).toBe('tenant_a');

    await TenantContext.run({ tenantId: 'b', schema: 'tenant_b' }, async () => {
      await checkout();
      await checkout();
    });

    expect(queries).toEqual([
      'SET search_path TO "tenant_a", public',
      'SET search_path TO "tenant_b", public',
    ]);
    expect(client.__erp4uSchema).toBe('tenant_b');
  });

  it('supports promise form of pool.connect and releases client on SET search_path failure', async () => {
    const client: TenantPgClient = {
      query: jest.fn((_sql: string, cb?: (err?: Error | null) => void) => {
        cb?.(new Error('search_path failed'));
      }),
    };
    const { pool, release } = createMockPool(client);

    await expect(
      TenantContext.run({ tenantId: 'a', schema: 'tenant_a' }, () =>
        pool.connect(),
      ),
    ).rejects.toThrow('search_path failed');

    expect(release).toHaveBeenCalledTimes(1);
    expect(client.__erp4uSchema).toBeUndefined();
  });

  it('fails fast in strict mode when no TenantContext is active', async () => {
    process.env.TENANCY_STRICT = 'true';
    const client: TenantPgClient = {
      query: jest.fn((_sql: string, cb?: (err?: Error | null) => void) =>
        cb?.(null),
      ),
    };
    const { pool } = createMockPool(client);

    await expect(pool.connect()).rejects.toThrow(/TENANCY_STRICT=true/);
    expect(client.query).not.toHaveBeenCalled();
  });
});

describe('buildDataSourceOptions (P7a production DB_PASSWORD guard)', () => {
  it('throws when NODE_ENV=production and DB_PASSWORD + DATABASE_URL are both missing', () => {
    expect(() =>
      buildDataSourceOptions({
        NODE_ENV: 'production',
        DB_HOST: 'db.internal',
        DB_USERNAME: 'erp4u_user',
        DB_DATABASE: 'erp4u_db',
      }),
    ).toThrow(/DB_PASSWORD is required when NODE_ENV=production/);

    expect(() =>
      buildDataSourceOptions({
        NODE_ENV: 'production',
        DB_PASSWORD: '   ',
      }),
    ).toThrow(/DB_PASSWORD is required when NODE_ENV=production/);
  });

  it('allows NODE_ENV=production when DATABASE_URL is provided without DB_PASSWORD', () => {
    const opts = buildDataSourceOptions({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/erp4u_db',
    }) as any;

    expect(opts.url).toBe('postgres://user:pass@localhost:5432/erp4u_db');
  });

  it('allows NODE_ENV=production when DB_PASSWORD is provided', () => {
    const opts = buildDataSourceOptions({
      NODE_ENV: 'production',
      DB_PASSWORD: 'demo-secret-password',
    }) as any;

    expect(opts.password).toBe('demo-secret-password');
  });

  it('keeps default dev password when NODE_ENV is not production', () => {
    const opts = buildDataSourceOptions({
      NODE_ENV: 'development',
    }) as any;

    expect(opts.password).toBe('erp4u_password');
  });
});
