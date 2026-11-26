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
      find: jest.fn().mockResolvedValue([]),
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

    it('getAll: allows user without USERS:view with sanitized data (no email/ip/last_login/phone), allows admin and user with USERS:view with full data', async () => {
      const fullUsers = [
        {
          id: 1,
          username: 'admin',
          full_name: 'Admin User',
          email: 'admin@example.com',
          ip_address: '1.2.3.4',
          last_login: new Date(),
          is_active: true,
          group: { id: 1, name: 'Admin', description: 'Admin group' },
        },
      ];
      mockUserRepo.find.mockResolvedValue(fullUsers);

      // 1. Staff without USERS:view -> 200, only { id, username, full_name, is_active, group: { id, name } }
      permCacheService.hasAny.mockResolvedValue(false);
      const resStaff = await controller.getAll({ user: staffNoPerm });
      expect(resStaff).toHaveLength(1);
      expect(resStaff[0]).toEqual({
        id: 1,
        username: 'admin',
        full_name: 'Admin User',
        is_active: true,
        group: { id: 1, name: 'Admin' },
      });
      expect(resStaff[0]).not.toHaveProperty('email');
      expect(resStaff[0]).not.toHaveProperty('ip_address');
      expect(resStaff[0]).not.toHaveProperty('last_login');
      expect(resStaff[0]).not.toHaveProperty('phone');

      // 2. User with USERS:view -> 200, full data
      const staffWithView = { id: 3, username: 'staff_view', groupId: 3 };
      permCacheService.hasAny.mockResolvedValue(true);
      const resWithView = await controller.getAll({ user: staffWithView });
      expect(resWithView).toEqual(fullUsers);
      expect(resWithView[0]).toHaveProperty('email');
      expect(resWithView[0]).toHaveProperty('ip_address');

      // 3. Admin -> 200, full data
      const resAdmin = await controller.getAll({ user: adminUser });
      expect(resAdmin).toEqual(fullUsers);
      expect(resAdmin[0]).toHaveProperty('email');
      expect(resAdmin[0]).toHaveProperty('ip_address');
    });

    it('getOnline: allows user without USERS:view with sanitized data (only id, username, full_name), allows admin and user with USERS:view with full data', async () => {
      const fullOnlineUsers = [
        {
          id: 1,
          username: 'admin',
          full_name: 'Admin User',
          email: 'admin@example.com',
          ip_address: '1.2.3.4',
          last_activity_at: new Date(),
          group: { id: 1, name: 'Admin' },
        },
      ];
      mockUserRepo.createQueryBuilder.mockReturnValue({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(fullOnlineUsers),
      });

      // 1. Staff without USERS:view -> 200, only { id, username, full_name }
      permCacheService.hasAny.mockResolvedValue(false);
      const resStaff = await controller.getOnline({ user: staffNoPerm });
      expect(resStaff).toHaveLength(1);
      expect(resStaff[0]).toEqual({
        id: 1,
        username: 'admin',
        full_name: 'Admin User',
      });
      expect(resStaff[0]).not.toHaveProperty('email');
      expect(resStaff[0]).not.toHaveProperty('ip_address');
      expect(resStaff[0]).not.toHaveProperty('last_activity_at');
      expect(resStaff[0]).not.toHaveProperty('group');

      // 2. User with USERS:view -> 200, full data
      const staffWithView = { id: 3, username: 'staff_view', groupId: 3 };
      permCacheService.hasAny.mockResolvedValue(true);
      const resWithView = await controller.getOnline({ user: staffWithView });
      expect(resWithView).toEqual(fullOnlineUsers);
      expect(resWithView[0]).toHaveProperty('email');

      // 3. Admin -> 200, full data
      const resAdmin = await controller.getOnline({ user: adminUser });
      expect(resAdmin).toEqual(fullOnlineUsers);
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

  describe('UsersService Group Permission Self-Escalation Hardening (P12b2)', () => {
    const actorStaff = { id: 10, username: 'staff1', groupId: 3 };
    const actorAdmin = { id: 1, username: 'admin', groupId: 1 };

    it('non-admin CANNOT update permissions of their own group (403)', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: 3, name: 'Own Group' });

      await expect(
        service.updateGroupPermissions(3, {
          permissions: [{ module_code: 'USERS', can_view: true }]
        }, actorStaff),
      ).rejects.toThrow(new ForbiddenException('Không thể tự chỉnh sửa quyền nhóm của chính mình'));

      expect(mockPermRepo.delete).not.toHaveBeenCalled();
    });

    it('non-admin CANNOT grant permissions they do not possess to another group (403)', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: 5, name: 'Target Group' });
      // Actor group 3 only has SALES:view, but tries to grant HR:view
      mockPermRepo.find.mockResolvedValue([
        { module_code: 'SALES', can_view: true, can_create: true, can_update: false, can_delete: false, view_cost_price: false }
      ]);

      await expect(
        service.updateGroupPermissions(5, {
          permissions: [{ module_code: 'HR', can_view: true }]
        }, actorStaff),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.updateGroupPermissions(5, {
          permissions: [{ module_code: 'HR', can_view: true }]
        }, actorStaff),
      ).rejects.toThrow(/Bạn không có quyền xem \(can_view\) trong module "HR"/);

      expect(mockPermRepo.delete).not.toHaveBeenCalled();
    });

    it('non-admin CANNOT grant higher flag (e.g. can_delete) in a module where they only have can_view (403)', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: 5, name: 'Target Group' });
      mockPermRepo.find.mockResolvedValue([
        { module_code: 'SALES', can_view: true, can_create: false, can_update: false, can_delete: false, view_cost_price: false }
      ]);

      await expect(
        service.updateGroupPermissions(5, {
          permissions: [{ module_code: 'SALES', can_view: true, can_delete: true }]
        }, actorStaff),
      ).rejects.toThrow(/Bạn không có quyền xoá \(can_delete\) trong module "SALES"/);
    });

    it('non-admin CAN grant permissions that they DO possess to another group (200)', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: 5, name: 'Target Group' });
      mockPermRepo.find.mockResolvedValue([
        { module_code: 'SALES', can_view: true, can_create: true, can_update: false, can_delete: false, view_cost_price: false }
      ]);

      const res = await service.updateGroupPermissions(5, {
        permissions: [{ module_code: 'SALES', can_view: true, can_create: true }]
      }, actorStaff);

      expect(res).toEqual({ success: true });
      expect(mockPermRepo.delete).toHaveBeenCalledWith({ group_id: 5 });
      expect(mockPermRepo.save).toHaveBeenCalled();
    });

    it('admin can update permissions of any group including own group without restriction (200)', async () => {
      mockGroupRepo.findOne.mockResolvedValue({ id: 1, name: 'Admin' });

      const res = await service.updateGroupPermissions(1, {
        permissions: [{ module_code: 'USERS', can_view: true, can_create: true, can_delete: true }]
      }, actorAdmin);

      expect(res).toEqual({ success: true });
      expect(mockPermRepo.delete).toHaveBeenCalledWith({ group_id: 1 });
    });

    it('createGroup: non-admin cannot grant permissions they do not have (403), admin can grant any (200)', async () => {
      mockPermRepo.find.mockResolvedValue([
        { module_code: 'SALES', can_view: true }
      ]);

      await expect(
        service.createGroup({
          name: 'New Rogue Group',
          permissions: [{ module_code: 'HR', can_view: true }]
        }, actorStaff),
      ).rejects.toThrow(ForbiddenException);

      const resAdmin = await service.createGroup({
        name: 'New Admin Created Group',
        permissions: [{ module_code: 'HR', can_view: true, can_create: true }]
      }, actorAdmin);

      expect(resAdmin).toBeDefined();
      expect(mockGroupRepo.save).toHaveBeenCalled();
    });
  });
});
