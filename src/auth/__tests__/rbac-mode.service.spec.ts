import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RbacModeService } from '../rbac-mode.service';
import { SystemConfig } from '../../system/system-config.entity';
import { ActivityLog } from '../../system/entities/activity-log.entity';
import { PermissionCacheService } from '../permission-cache.service';
import { TenantContext } from '../../common/tenancy/tenant-context';

describe('RbacModeService', () => {
  let service: RbacModeService;
  let configRepo: jest.Mocked<Repository<SystemConfig>>;
  let activityLogRepo: jest.Mocked<Repository<ActivityLog>>;
  let permCacheService: jest.Mocked<PermissionCacheService>;

  const originalEnv = process.env.RBAC_FORCE_MODE;

  beforeEach(async () => {
    delete process.env.RBAC_FORCE_MODE;

    configRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    } as any;

    activityLogRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    } as any;

    permCacheService = {
      hasAny: jest.fn().mockResolvedValue(false),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacModeService,
        {
          provide: getRepositoryToken(SystemConfig),
          useValue: configRepo,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: activityLogRepo,
        },
        {
          provide: PermissionCacheService,
          useValue: permCacheService,
        },
      ],
    }).compile();

    service = module.get<RbacModeService>(RbacModeService);
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.RBAC_FORCE_MODE = originalEnv;
    } else {
      delete process.env.RBAC_FORCE_MODE;
    }
  });

  it('defaults to SHADOW when config is missing', async () => {
    configRepo.findOne.mockResolvedValue(null);
    const mode = await service.get();
    expect(mode).toBe('SHADOW');
  });

  it('reads legacy OFF as SHADOW and logs a warning', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    configRepo.findOne.mockResolvedValue({ key: 'RBAC_MODE', value: 'OFF' } as any);

    const mode = await service.get();
    expect(mode).toBe('SHADOW');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Chế độ OFF trong DB của tenant "default" đã bị bãi bỏ. Đọc là SHADOW.'),
    );
    warnSpy.mockRestore();
  });

  it('isolates mode cache per tenant', async () => {
    const tenantA = { tenantId: 'tenant_a', schema: 'tenant_a' };
    const tenantB = { tenantId: 'tenant_b', schema: 'tenant_b' };

    configRepo.findOne.mockImplementation(async () => {
      const tId = TenantContext.current().tenantId;
      return tId === 'tenant_a'
        ? ({ key: 'RBAC_MODE', value: 'ENFORCE' } as any)
        : ({ key: 'RBAC_MODE', value: 'SHADOW' } as any);
    });

    const modeA = await TenantContext.run(tenantA, () => service.get());
    const modeB = await TenantContext.run(tenantB, () => service.get());

    expect(modeA).toBe('ENFORCE');
    expect(modeB).toBe('SHADOW');

    // Second read hits cache
    expect(await TenantContext.run(tenantA, () => service.get())).toBe('ENFORCE');
    expect(await TenantContext.run(tenantB, () => service.get())).toBe('SHADOW');
    expect(configRepo.findOne).toHaveBeenCalledTimes(2);

    // clearCache only on tenantA
    TenantContext.run(tenantA, () => service.clearCache());
    expect(await TenantContext.run(tenantB, () => service.get())).toBe('SHADOW');
    expect(configRepo.findOne).toHaveBeenCalledTimes(2); // tenant B still cached
  });

  it('RBAC_FORCE_MODE overrides all tenant modes', async () => {
    process.env.RBAC_FORCE_MODE = 'SHADOW';
    configRepo.findOne.mockResolvedValue({ key: 'RBAC_MODE', value: 'ENFORCE' } as any);

    const effective = await service.get();
    expect(effective).toBe('SHADOW');

    const info = await service.getModeInfo();
    expect(info).toEqual({
      mode: 'ENFORCE',
      effective_mode: 'SHADOW',
      forced: true,
    });
  });

  it('rejects OFF or invalid values in setMode with BadRequestException', async () => {
    await expect(service.setMode('OFF', { username: 'admin' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.setMode('UNKNOWN', { username: 'admin' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows admin (exact username admin) to setMode and records ActivityLog', async () => {
    configRepo.findOne.mockResolvedValue({ key: 'RBAC_MODE', value: 'SHADOW' } as any);

    const result = await service.setMode('ENFORCE', { username: 'admin', id: 1 });
    expect(result).toBe('ENFORCE');
    expect(configRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'RBAC_MODE', value: 'ENFORCE' }),
    );
    expect(activityLogRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 1,
        username: 'admin',
        module: 'SYSTEM',
        action: 'UPDATE',
        entity_id: 'RBAC_MODE',
        details: expect.objectContaining({ old: 'SHADOW', new: 'ENFORCE' }),
      }),
    );
  });

  it('allows user with SYSTEM:update to setMode', async () => {
    permCacheService.hasAny.mockResolvedValue(true);
    configRepo.findOne.mockResolvedValue({ key: 'RBAC_MODE', value: 'SHADOW' } as any);

    const result = await service.setMode('ENFORCE', {
      username: 'manager',
      groupId: 2,
    });
    expect(result).toBe('ENFORCE');
    expect(permCacheService.hasAny).toHaveBeenCalledWith(2, [
      { module: 'SYSTEM', action: 'update' },
    ]);
  });

  it('rejects unauthorized users with ForbiddenException', async () => {
    permCacheService.hasAny.mockResolvedValue(false);

    await expect(
      service.setMode('ENFORCE', { username: 'regular_user', groupId: 5 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('when DB query fails and cache exists with ENFORCE, returns ENFORCE without overwriting cache', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    configRepo.findOne.mockResolvedValueOnce({ key: 'RBAC_MODE', value: 'ENFORCE' } as any);

    // Initial successful read caches ENFORCE
    const mode1 = await service.getTenantMode('tenant_error_test');
    expect(mode1).toBe('ENFORCE');

    // Simulate TTL expiration by advancing Date.now
    const realDateNow = Date.now;
    try {
      Date.now = () => realDateNow() + 60 * 1000;

      // DB query throws error
      const dbError = new Error('DB connection failed');
      configRepo.findOne.mockRejectedValueOnce(dbError);

      const mode2 = await service.getTenantMode('tenant_error_test');
      expect(mode2).toBe('ENFORCE');
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('tenant_error_test'),
        dbError,
      );
    } finally {
      Date.now = realDateNow;
      errorSpy.mockRestore();
    }
  });

  it('when DB query fails with no cache, returns SHADOW, logs error with tenant, and re-queries DB on next read', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dbError = new Error('DB connection refused');
    configRepo.findOne.mockRejectedValueOnce(dbError);

    // Read without cache when DB fails
    const mode1 = await service.getTenantMode('tenant_uncached_error');
    expect(mode1).toBe('SHADOW');
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('tenant_uncached_error'),
      dbError,
    );

    // Next read succeeds with ENFORCE
    configRepo.findOne.mockResolvedValueOnce({ key: 'RBAC_MODE', value: 'ENFORCE' } as any);
    const mode2 = await service.getTenantMode('tenant_uncached_error');
    expect(mode2).toBe('ENFORCE');
    expect(configRepo.findOne).toHaveBeenCalledTimes(2);

    errorSpy.mockRestore();
  });
});
