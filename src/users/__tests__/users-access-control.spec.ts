import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersController } from '../users.controller';
import { UsersService } from '../users.service';
import { PermissionCacheService } from '../../auth/permission-cache.service';
import { DemoModeService } from '../../common/services/demo-mode.service';
import * as bcrypt from 'bcrypt';

describe('UsersAccessControl (Unit Test)', () => {
  let controller: UsersController;
  let service: UsersService;
  let permCacheService: jest.Mocked<PermissionCacheService>;
  let demoModeService: jest.Mocked<DemoModeService>;
  let mockUserRepo: any;
  let mockGroupRepo: any;
  let mockPermRepo: any;

  beforeEach(async () => {
    permCacheService = {
      hasAny: jest.fn(),
      getGroupPermissions: jest.fn(),
      invalidateGroup: jest.fn(),
      invalidateTenant: jest.fn(),
      clearAll: jest.fn(),
    } as any;

    demoModeService = {
      isDemoMode: jest.fn().mockReturnValue(false),
      isDemoUser: jest.fn().mockReturnValue(false),
    } as any;

    mockUserRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((u) => Promise.resolve({ ...u })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((u) => u),
      createQueryBuilder: jest.fn(),
    };

    mockGroupRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((g) => g),
      save: jest.fn().mockImplementation((g) => Promise.resolve({ id: 1, ...g })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockPermRepo = {
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockImplementation((p) => p),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
    };

    service = new UsersService(
      mockUserRepo,
      mockGroupRepo,
      mockPermRepo,
      permCacheService,
      demoModeService,
    );

    controller = new UsersController(service, permCacheService);
  });

  describe('UsersController assertPermission enforcement', () => {
    const staffNoPerm = { id: 2, username: 'staff1', groupId: 2 };
    const adminUser = { id: 1, username: 'admin', groupId: 1 };

    it('getAll: rejects user without USERS:view (403), allows admin (200)', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      await expect(controller.getAll({ user: staffNoPerm })).rejects.toThrow(ForbiddenException);

      mockUserRepo.find.mockResolvedValue([{ id: 1, username: 'admin' }]);
      const resAdmin = await controller.getAll({ user: adminUser });
      expect(resAdmin).toHaveLength(1);
    });

    it('getOnline: rejects user without USERS:view (403), allows admin', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      await expect(controller.getOnline({ user: staffNoPerm })).rejects.toThrow(ForbiddenException);

      mockUserRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      });
      const res = await controller.getOnline({ user: adminUser });
      expect(res).toEqual([]);
    });

    it('create: rejects user without USERS:create (403)', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      await expect(controller.create({ username: 'test' }, { user: staffNoPerm })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('update: rejects user without USERS:update (403)', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      await expect(
        controller.update(2, { full_name: 'New Name' }, { user: staffNoPerm }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('delete: rejects user without USERS:delete (403)', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      await expect(controller.delete(2, { user: staffNoPerm })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('getGroups: rejects user without USERS:view (403)', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      await expect(controller.getGroups({ user: staffNoPerm })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('updatePerms: rejects user without USERS:create (403)', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      await expect(
        controller.updatePerms(2, { permissions: [] }, { user: staffNoPerm }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('UsersService.updateUser privilege escalation protection', () => {
    const actorStaff = { id: 2, username: 'staff1', groupId: 2 };
    const actorAdmin = { id: 1, username: 'admin', groupId: 1 };

    it('non-admin CANNOT edit user admin (403)', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, username: 'admin', is_active: true });
      await expect(
        service.updateUser(1, { full_name: 'Hacked' }, actorStaff),
      ).rejects.toThrow(ForbiddenException);
    });

    it('non-admin CANNOT change username to admin (403)', async () => {
      await expect(
        service.updateUser(2, { username: 'admin' }, actorStaff),
      ).rejects.toThrow(ForbiddenException);
    });

    it('non-admin CANNOT assign group_id to self (403)', async () => {
      await expect(
        service.updateUser(2, { group_id: 1 }, actorStaff),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ignores password field in PUT /users/:id', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 3, username: 'user3', is_active: true });
      await service.updateUser(3, { password: 'newhackedpassword', full_name: 'User 3' }, actorAdmin);
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        3,
        expect.not.objectContaining({ password: expect.anything() }),
      );
    });
  });

  describe('UsersService.changePassword security rules', () => {
    const actorStaff = { id: 2, username: 'staff1', groupId: 2 };
    const actorAdmin = { id: 1, username: 'admin', groupId: 1 };
    const actorManager = { id: 10, username: 'manager1', groupId: 3 };

    let hashedCurrentPass: string;

    beforeEach(async () => {
      hashedCurrentPass = await bcrypt.hash('currentPass123', 10);
    });

    it('self-change: requires current_password (400 if missing)', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 2,
          username: 'staff1',
          password: hashedCurrentPass,
        }),
      });

      await expect(
        service.changePassword(2, { password: 'newPassword123' }, actorStaff),
      ).rejects.toThrow(BadRequestException);
    });

    it('self-change: rejects wrong current_password (400)', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 2,
          username: 'staff1',
          password: hashedCurrentPass,
        }),
      });

      await expect(
        service.changePassword(
          2,
          { current_password: 'wrongPassword', password: 'newPassword123' },
          actorStaff,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('self-change: rejects new password shorter than 8 characters (400)', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 2,
          username: 'staff1',
          password: hashedCurrentPass,
        }),
      });

      await expect(
        service.changePassword(
          2,
          { current_password: 'currentPass123', password: 'short' },
          actorStaff,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('self-change: succeeds with valid current_password and >=8 chars new password', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 2,
          username: 'staff1',
          password: hashedCurrentPass,
        }),
      });

      const res = await service.changePassword(
        2,
        { current_password: 'currentPass123', password: 'validNewPassword123' },
        actorStaff,
      );
      expect(res).toBeDefined();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('other user: non-admin without USERS:update gets 403', async () => {
      permCacheService.hasAny.mockResolvedValue(false);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 4,
          username: 'staff_target',
          password: hashedCurrentPass,
          group_id: 2,
        }),
      });

      await expect(
        service.changePassword(4, { password: 'newPassword123' }, actorStaff),
      ).rejects.toThrow(ForbiddenException);
    });

    it('other user: non-admin CANNOT change password of admin user (403)', async () => {
      permCacheService.hasAny.mockResolvedValue(true); // Has USERS:update
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 1,
          username: 'admin',
          password: hashedCurrentPass,
          group_id: 1,
        }),
      });

      await expect(
        service.changePassword(1, { password: 'newPassword123' }, actorManager),
      ).rejects.toThrow(ForbiddenException);
    });

    it('other user: non-admin CANNOT change password of user in group with USERS:update (lateral escalation 403)', async () => {
      // actor has USERS:update
      permCacheService.hasAny.mockResolvedValue(true);
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 11,
          username: 'peer_manager',
          password: hashedCurrentPass,
          group_id: 3, // Group 3 has USERS:update
        }),
      });

      await expect(
        service.changePassword(11, { password: 'newPassword123' }, actorManager),
      ).rejects.toThrow(ForbiddenException);
    });

    it('other user: non-admin with USERS:update CAN change password of regular staff (200)', async () => {
      // actor has USERS:update for self, but target group 4 does NOT have USERS:update
      permCacheService.hasAny.mockImplementation(async (groupId, perms) => {
        if (groupId === 3) return true; // actor group has USERS:update
        if (groupId === 4) return false; // target group does NOT have USERS:update
        return false;
      });

      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 4,
          username: 'regular_staff',
          password: hashedCurrentPass,
          group_id: 4,
        }),
      });

      const res = await service.changePassword(4, { password: 'newPassword123' }, actorManager);
      expect(res).toBeDefined();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('other user: admin can change password of regular staff and other users (200)', async () => {
      mockUserRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 4,
          username: 'regular_staff',
          password: hashedCurrentPass,
          group_id: 4,
        }),
      });

      const res = await service.changePassword(4, { password: 'newPassword123' }, actorAdmin);
      expect(res).toBeDefined();
      expect(mockUserRepo.save).toHaveBeenCalled();
    });
  });

  describe('UsersService.deleteUser protection', () => {
    it('cannot delete user admin (403)', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 1, username: 'admin' });
      await expect(service.deleteUser(1)).rejects.toThrow(ForbiddenException);
      expect(mockUserRepo.delete).not.toHaveBeenCalled();
    });
  });
});
