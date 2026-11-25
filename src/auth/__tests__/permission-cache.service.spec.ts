import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PermissionCacheService } from '../permission-cache.service';
import { GroupPermission } from '../../users/entities/group-permission.entity';
import { TenantContext } from '../../common/tenancy/tenant-context';

describe('PermissionCacheService (Multi-Tenant Cache)', () => {
  let service: PermissionCacheService;
  let permRepo: jest.Mocked<Repository<GroupPermission>>;

  beforeEach(async () => {
    permRepo = {
      find: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCacheService,
        {
          provide: getRepositoryToken(GroupPermission),
          useValue: permRepo,
        },
      ],
    }).compile();

    service = module.get<PermissionCacheService>(PermissionCacheService);
  });

  afterEach(() => {
    service.clearAll();
  });

  it('isolates cache entries by tenantId:groupId', async () => {
    const tenantA = { tenantId: 'tenant_a', schema: 'tenant_a' };
    const tenantB = { tenantId: 'tenant_b', schema: 'tenant_b' };

    const permsA: GroupPermission[] = [
      { id: 1, group_id: 3, module_code: 'SALES', can_view: true } as any,
    ];
    const permsB: GroupPermission[] = [
      { id: 2, group_id: 3, module_code: 'SALES', can_view: false } as any,
    ];

    permRepo.find.mockImplementation(async () => {
      const current = TenantContext.current().tenantId;
      return current === 'tenant_a' ? permsA : permsB;
    });

    const hasPermA = await TenantContext.run(tenantA, async () => {
      return service.hasAny(3, [{ module: 'SALES', action: 'view' }]);
    });
    expect(hasPermA).toBe(true);

    const hasPermB = await TenantContext.run(tenantB, async () => {
      return service.hasAny(3, [{ module: 'SALES', action: 'view' }]);
    });
    expect(hasPermB).toBe(false);

    // Call again within TTL - should hit cache and maintain isolation
    const cachedA = await TenantContext.run(tenantA, async () => {
      return service.hasAny(3, [{ module: 'SALES', action: 'view' }]);
    });
    const cachedB = await TenantContext.run(tenantB, async () => {
      return service.hasAny(3, [{ module: 'SALES', action: 'view' }]);
    });
    expect(cachedA).toBe(true);
    expect(cachedB).toBe(false);

    // permRepo.find should have been called only twice (once per tenant)
    expect(permRepo.find).toHaveBeenCalledTimes(2);
  });

  it('invalidateGroup(groupId) only invalidates cache of current tenant', async () => {
    const tenantA = { tenantId: 'tenant_a', schema: 'tenant_a' };
    const tenantB = { tenantId: 'tenant_b', schema: 'tenant_b' };

    permRepo.find.mockResolvedValue([]);

    await TenantContext.run(tenantA, async () => {
      await service.getGroupPermissions(5);
    });
    await TenantContext.run(tenantB, async () => {
      await service.getGroupPermissions(5);
    });

    expect(permRepo.find).toHaveBeenCalledTimes(2);

    // Invalidate group 5 only on tenant A
    TenantContext.run(tenantA, () => {
      service.invalidateGroup(5);
    });

    // Calling tenant B should hit cache
    await TenantContext.run(tenantB, async () => {
      await service.getGroupPermissions(5);
    });
    expect(permRepo.find).toHaveBeenCalledTimes(2);

    // Calling tenant A should re-fetch from repo
    await TenantContext.run(tenantA, async () => {
      await service.getGroupPermissions(5);
    });
    expect(permRepo.find).toHaveBeenCalledTimes(3);
  });

  it('invalidateTenant(tenantId) clears all groups for that tenant', async () => {
    const tenantA = { tenantId: 'tenant_a', schema: 'tenant_a' };
    const tenantB = { tenantId: 'tenant_b', schema: 'tenant_b' };

    permRepo.find.mockResolvedValue([]);

    await TenantContext.run(tenantA, async () => {
      await service.getGroupPermissions(1);
      await service.getGroupPermissions(2);
    });
    await TenantContext.run(tenantB, async () => {
      await service.getGroupPermissions(1);
    });

    expect(permRepo.find).toHaveBeenCalledTimes(3);

    service.invalidateTenant('tenant_a');

    // Tenant B still cached
    await TenantContext.run(tenantB, async () => {
      await service.getGroupPermissions(1);
    });
    expect(permRepo.find).toHaveBeenCalledTimes(3);

    // Tenant A groups re-fetched
    await TenantContext.run(tenantA, async () => {
      await service.getGroupPermissions(1);
      await service.getGroupPermissions(2);
    });
    expect(permRepo.find).toHaveBeenCalledTimes(5);
  });
});
