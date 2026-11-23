import { ForbiddenException } from '@nestjs/common';
import { UserQuotaService } from '../user-quota.service';
import { PackageKey } from '../../common/packages/package.registry';
import { UsersService } from '../users.service';

describe('UserQuotaService', () => {
  let mockUserRepo: any;
  let mockEntitlementProvider: any;
  let quotaService: UserQuotaService;

  beforeEach(() => {
    mockUserRepo = {
      count: jest.fn().mockResolvedValue(3),
    };
    mockEntitlementProvider = {
      getLimits: jest.fn().mockResolvedValue({ max_users: 5 }),
    };
    quotaService = new UserQuotaService(mockUserRepo, mockEntitlementProvider);
  });

  describe('getMaxUsers()', () => {
    it('returns positive integer as max', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 10 });
      const max = await quotaService.getMaxUsers();
      expect(max).toBe(10);
      expect(mockEntitlementProvider.getLimits).toHaveBeenCalledWith(PackageKey.CORE);
    });

    it('returns null (unlimited) when max_users is null', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: null });
      const max = await quotaService.getMaxUsers();
      expect(max).toBeNull();
    });

    it('returns null (unlimited) when max_users is missing/undefined', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({});
      const max = await quotaService.getMaxUsers();
      expect(max).toBeNull();
    });

    it('returns null (unlimited) when getLimits returns null', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue(null);
      const max = await quotaService.getMaxUsers();
      expect(max).toBeNull();
    });

    it('returns null (unlimited) when max_users is 0', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 0 });
      const max = await quotaService.getMaxUsers();
      expect(max).toBeNull();
    });

    it('returns null (unlimited) when max_users is negative', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: -5 });
      const max = await quotaService.getMaxUsers();
      expect(max).toBeNull();
    });

    it('returns null (unlimited) when max_users is non-integer or string', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: '10' });
      expect(await quotaService.getMaxUsers()).toBeNull();

      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 3.5 });
      expect(await quotaService.getMaxUsers()).toBeNull();
    });
  });

  describe('getUsage()', () => {
    it('returns used active users and max', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 5 });
      mockUserRepo.count.mockResolvedValue(2);

      const usage = await quotaService.getUsage();
      expect(usage).toEqual({ used: 2, max: 5 });
      expect(mockUserRepo.count).toHaveBeenCalledWith({ where: { is_active: true } });
    });

    it('returns max: null when open-core (unlimited)', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(15);

      const usage = await quotaService.getUsage();
      expect(usage).toEqual({ used: 15, max: null });
    });
  });

  describe('assertQuota()', () => {
    it('passes when quota is unlimited', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue(null);
      mockUserRepo.count.mockResolvedValue(100);

      await expect(quotaService.assertQuota()).resolves.toBeUndefined();
    });

    it('passes when used < max', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 5 });
      mockUserRepo.count.mockResolvedValue(4);

      await expect(quotaService.assertQuota()).resolves.toBeUndefined();
    });

    it('throws ForbiddenException with USER_LIMIT_REACHED when used = max', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 5 });
      mockUserRepo.count.mockResolvedValue(5);

      try {
        await quotaService.assertQuota();
        fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = err.getResponse();
        expect(res).toEqual({
          code: 'USER_LIMIT_REACHED',
          message: 'Đã đạt số người dùng tối đa của gói (5/5). Liên hệ quản trị để nâng cấp gói.',
        });
      }
    });

    it('throws ForbiddenException with USER_LIMIT_REACHED when used > max (already exceeded)', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 3 });
      mockUserRepo.count.mockResolvedValue(5);

      try {
        await quotaService.assertQuota();
        fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        const res = err.getResponse();
        expect(res).toEqual({
          code: 'USER_LIMIT_REACHED',
          message: 'Đã đạt số người dùng tối đa của gói (5/3). Liên hệ quản trị để nâng cấp gói.',
        });
      }
    });
  });

  describe('UsersService quota enforcement integration', () => {
    let usersService: UsersService;
    let mockDemoModeService: any;

    beforeEach(() => {
      mockDemoModeService = {
        isDemoMode: jest.fn().mockReturnValue(false),
        isDemoUser: jest.fn().mockReturnValue(false),
      };
      mockUserRepo = {
        findOne: jest.fn(),
        create: jest.fn((d: any) => ({ id: 101, ...d })),
        save: jest.fn(async (u: any) => u),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        count: jest.fn(),
      };
      usersService = new UsersService(
        mockUserRepo,
        {} as any,
        {} as any,
        {} as any,
        mockDemoModeService,
        undefined,
        quotaService,
        undefined, // no dataSource -> uses fallback directly
      );
    });

    it('blocks createUser when quota is reached', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 2 });
      mockUserRepo.count.mockResolvedValue(2);

      await expect(
        usersService.createUser({
          username: 'user_new',
          password: 'Password123!',
          full_name: 'New User',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserRepo.save).not.toHaveBeenCalled();
    });

    it('allows createUser when quota is not full', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 5 });
      mockUserRepo.count.mockResolvedValue(2);
      mockUserRepo.findOne.mockResolvedValue(null);

      const created: any = await usersService.createUser({
        username: 'user_ok',
        password: 'Password123!',
        full_name: 'OK User',
      });

      expect(created.username).toBe('user_ok');
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('blocks activating an inactive user (is_active: false -> true) when quota is reached', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 2 });
      mockUserRepo.count.mockResolvedValue(2);
      mockUserRepo.findOne.mockResolvedValue({ id: 10, username: 'inactive_user', is_active: false });

      await expect(
        usersService.updateUser(10, { is_active: true }),
      ).rejects.toThrow(ForbiddenException);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });

    it('allows deactivating an active user (is_active: true -> false) even when quota is full', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 2 });
      mockUserRepo.count.mockResolvedValue(2);
      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: 10, username: 'active_user', is_active: true })
        .mockResolvedValueOnce({ id: 10, username: 'active_user', is_active: false });

      const updated: any = await usersService.updateUser(10, { is_active: false });
      expect(mockUserRepo.update).toHaveBeenCalledWith(10, { is_active: false });
      expect(updated.is_active).toBe(false);
    });

    it('allows updating profile details of an already active user without blocking when quota is full', async () => {
      mockEntitlementProvider.getLimits.mockResolvedValue({ max_users: 2 });
      mockUserRepo.count.mockResolvedValue(2);
      mockUserRepo.findOne
        .mockResolvedValueOnce({ id: 10, username: 'active_user', is_active: true, full_name: 'Old Name' })
        .mockResolvedValueOnce({ id: 10, username: 'active_user', is_active: true, full_name: 'New Name' });

      const updated: any = await usersService.updateUser(10, { full_name: 'New Name' });
      expect(mockUserRepo.update).toHaveBeenCalledWith(10, { full_name: 'New Name' });
      expect(updated.full_name).toBe('New Name');
    });
  });
});
