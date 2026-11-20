import { EncryptionService } from '../../encryption/encryption.service';
import { TenantContext } from '../tenant-context';
import {
  isEncryptedValue,
  isSecretConfigKey,
  TENANT_CONFIG_CACHE_TTL_MS,
  TenantConfigService,
} from '../tenant-config.service';

describe('TenantConfigService', () => {
  const ORIGINAL_ENV = { ...process.env };
  let dbStoreByTenant: Record<string, Map<string, { key: string; value: string; description?: string }>>;
  let findOneMock: jest.Mock;
  let findMock: jest.Mock;
  let saveMock: jest.Mock;
  let service: TenantConfigService;
  let encryptionService: EncryptionService;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    dbStoreByTenant = {
      default: new Map(),
      tenant_a: new Map(),
      tenant_b: new Map(),
    };

    const getCurrentMap = () => {
      const { tenantId } = TenantContext.current();
      if (!dbStoreByTenant[tenantId]) {
        dbStoreByTenant[tenantId] = new Map();
      }
      return dbStoreByTenant[tenantId];
    };

    findOneMock = jest.fn(async ({ where: { key } }) => {
      return getCurrentMap().get(key) ?? null;
    });

    findMock = jest.fn(async ({ where }) => {
      const map = getCurrentMap();
      const keys: string[] = where?.key?._value ?? [];
      return keys
        .map((k) => map.get(k))
        .filter((v): v is { key: string; value: string; description?: string } => Boolean(v));
    });

    saveMock = jest.fn(async (entity) => {
      getCurrentMap().set(entity.key, { ...entity });
      return entity;
    });

    const mockRepo = {
      findOne: findOneMock,
      find: findMock,
      create: jest.fn((data) => ({ ...data })),
      save: saveMock,
    };

    const mockDataSource = {
      getRepository: jest.fn(() => mockRepo),
    } as any;

    encryptionService = new EncryptionService();
    service = new TenantConfigService(mockDataSource, encryptionService);
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('uses a per-tenant cache TTL <= 60s', () => {
    expect(TENANT_CONFIG_CACHE_TTL_MS).toBeGreaterThan(0);
    expect(TENANT_CONFIG_CACHE_TTL_MS).toBeLessThanOrEqual(60_000);
  });

  it('falls back to env ONLY for default tenant when DB key is missing', async () => {
    process.env.SMTP_HOST = 'smtp.default-env.example';

    const defaultVal = await TenantContext.run(
      { tenantId: 'default', schema: 'public' },
      () => service.get('SMTP_HOST'),
    );
    expect(defaultVal).toBe('smtp.default-env.example');

    const tenantAVal = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_HOST'),
    );
    expect(tenantAVal).toBeUndefined();
  });

  it('throws clear error from getRequired for non-default tenant when missing (never falls back to env)', async () => {
    process.env.SMTP_HOST = 'smtp.env-only.example';

    await expect(
      TenantContext.run({ tenantId: 'tenant_a', schema: 'tenant_a' }, () =>
        service.getRequired('SMTP_HOST'),
      ),
    ).rejects.toThrow(
      'Missing required tenant configuration "SMTP_HOST" for tenant "tenant_a"',
    );
  });

  it('prefers tenant schema DB value over env for default tenant', async () => {
    process.env.SMTP_HOST = 'smtp.env.example';
    dbStoreByTenant.default.set('SMTP_HOST', {
      key: 'SMTP_HOST',
      value: 'smtp.db-default.example',
    });

    const val = await TenantContext.run(
      { tenantId: 'default', schema: 'public' },
      () => service.get('SMTP_HOST'),
    );
    expect(val).toBe('smtp.db-default.example');
  });

  it('isolates per-tenant cache so tenant_a and tenant_b never bleed values', async () => {
    dbStoreByTenant.tenant_a.set('SMTP_HOST', {
      key: 'SMTP_HOST',
      value: 'smtp.tenant-a.example',
    });
    dbStoreByTenant.tenant_b.set('SMTP_HOST', {
      key: 'SMTP_HOST',
      value: 'smtp.tenant-b.example',
    });

    const valA1 = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_HOST'),
    );
    const valB1 = await TenantContext.run(
      { tenantId: 'tenant_b', schema: 'tenant_b' },
      () => service.get('SMTP_HOST'),
    );
    expect(valA1).toBe('smtp.tenant-a.example');
    expect(valB1).toBe('smtp.tenant-b.example');
    expect(findOneMock).toHaveBeenCalledTimes(2);

    // Second reads hit per-tenant cache (no extra DB queries)
    const valA2 = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_HOST'),
    );
    const valB2 = await TenantContext.run(
      { tenantId: 'tenant_b', schema: 'tenant_b' },
      () => service.get('SMTP_HOST'),
    );
    expect(valA2).toBe('smtp.tenant-a.example');
    expect(valB2).toBe('smtp.tenant-b.example');
    expect(findOneMock).toHaveBeenCalledTimes(2);

    // Updating tenant_a invalidates ONLY tenant_a cache
    await TenantContext.run({ tenantId: 'tenant_a', schema: 'tenant_a' }, () =>
      service.set('SMTP_HOST', 'smtp.tenant-a-v2.example'),
    );

    const valA3 = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_HOST'),
    );
    const valB3 = await TenantContext.run(
      { tenantId: 'tenant_b', schema: 'tenant_b' },
      () => service.get('SMTP_HOST'),
    );
    expect(valA3).toBe('smtp.tenant-a-v2.example');
    expect(valB3).toBe('smtp.tenant-b.example');
  });

  it('expires cache after TTL elapses', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);

    dbStoreByTenant.tenant_a.set('SMTP_HOST', {
      key: 'SMTP_HOST',
      value: 'smtp.first.example',
    });

    const v1 = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_HOST'),
    );
    expect(v1).toBe('smtp.first.example');
    expect(findOneMock).toHaveBeenCalledTimes(1);

    // Mutate DB directly without calling service.set
    dbStoreByTenant.tenant_a.set('SMTP_HOST', {
      key: 'SMTP_HOST',
      value: 'smtp.second.example',
    });

    // Still within TTL -> returns cached value
    nowSpy.mockReturnValue(1_000_000 + TENANT_CONFIG_CACHE_TTL_MS - 1);
    const vCached = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_HOST'),
    );
    expect(vCached).toBe('smtp.first.example');
    expect(findOneMock).toHaveBeenCalledTimes(1);

    // Past TTL -> re-reads DB
    nowSpy.mockReturnValue(1_000_000 + TENANT_CONFIG_CACHE_TTL_MS + 1);
    const vFresh = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_HOST'),
    );
    expect(vFresh).toBe('smtp.second.example');
    expect(findOneMock).toHaveBeenCalledTimes(2);
  });

  it('encrypts secret keys at rest via EncryptionService and decrypts transparently on read', async () => {
    expect(isSecretConfigKey('SMTP_PASS')).toBe(true);
    expect(isSecretConfigKey('GEMINI_API_KEY')).toBe(true);
    expect(isSecretConfigKey('GHTK_TOKEN')).toBe(true);
    expect(isSecretConfigKey('SMTP_HOST')).toBe(false);

    const dummySecret = 'demo-smtp-pass-placeholder';

    await TenantContext.run({ tenantId: 'tenant_a', schema: 'tenant_a' }, () =>
      service.set('SMTP_PASS', dummySecret),
    );

    const rawStored = dbStoreByTenant.tenant_a.get('SMTP_PASS')?.value;
    expect(rawStored).toBeDefined();
    expect(rawStored).not.toBe(dummySecret);
    expect(isEncryptedValue(rawStored)).toBe(true);

    const decrypted = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () => service.get('SMTP_PASS'),
    );
    expect(decrypted).toBe(dummySecret);
  });

  it('remains backward-compatible with legacy plaintext values in DB', async () => {
    dbStoreByTenant.default.set('SMTP_PASS', {
      key: 'SMTP_PASS',
      value: 'legacy-plain-demo-pass',
    });

    const val = await TenantContext.run(
      { tenantId: 'default', schema: 'public' },
      () => service.get('SMTP_PASS'),
    );
    expect(val).toBe('legacy-plain-demo-pass');
  });

  it('supports getMany with per-tenant envKeyMap fallback ONLY for default tenant', async () => {
    process.env.SMTP_HOST = 'smtp.env.example';
    process.env.SMTP_FROM = 'demo@example.com';
    dbStoreByTenant.tenant_a.set('SMTP_HOST', {
      key: 'SMTP_HOST',
      value: 'smtp.a.example',
    });

    const defaultCfg = await TenantContext.run(
      { tenantId: 'default', schema: 'public' },
      () =>
        service.getMany(['SMTP_HOST', 'SMTP_FROM_EMAIL'], {
          envKeyMap: { SMTP_FROM_EMAIL: ['SMTP_FROM_EMAIL', 'SMTP_FROM'] },
        }),
    );
    expect(defaultCfg).toEqual({
      SMTP_HOST: 'smtp.env.example',
      SMTP_FROM_EMAIL: 'demo@example.com',
    });

    const tenantACfg = await TenantContext.run(
      { tenantId: 'tenant_a', schema: 'tenant_a' },
      () =>
        service.getMany(['SMTP_HOST', 'SMTP_FROM_EMAIL'], {
          envKeyMap: { SMTP_FROM_EMAIL: ['SMTP_FROM_EMAIL', 'SMTP_FROM'] },
        }),
    );
    expect(tenantACfg).toEqual({
      SMTP_HOST: 'smtp.a.example',
      SMTP_FROM_EMAIL: undefined,
    });
  });
});
