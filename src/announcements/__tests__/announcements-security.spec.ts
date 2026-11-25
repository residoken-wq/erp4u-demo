import { AnnouncementsService } from '../announcements.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('Announcements Security & Group Targeting (Task P11a)', () => {
  let service: AnnouncementsService;
  let mockAnnouncementRepo: any;
  let mockReadRepo: any;
  let mockQueryBuilder: any;
  let mockPermCache: any;

  beforeEach(() => {
    mockQueryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    };

    mockAnnouncementRepo = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn(async (d) => ({ id: 1, ...d })),
      update: jest.fn(async () => ({ affected: 1 })),
      delete: jest.fn(async () => ({ affected: 1 })),
    };

    mockReadRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((d) => ({ ...d })),
      save: jest.fn(async (d) => d),
    };

    mockPermCache = {
      hasAny: jest.fn().mockResolvedValue(true),
    };

    service = new AnnouncementsService(mockAnnouncementRepo, mockReadRepo, mockPermCache);
  });

  describe('Group Targeting Filter', () => {
    it('applies SQL filter checking groupId = ANY(target_group_ids) or target_group_ids IS NULL', async () => {
      await service.findActiveForUser(10, 3);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(a.target_group_ids IS NULL OR :groupId = ANY(a.target_group_ids))',
        { groupId: 3 },
      );
    });

    it('when user has no groupId, queries only target_group_ids IS NULL', async () => {
      await service.findActiveForUser(10, undefined);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('a.target_group_ids IS NULL');
    });

    it('returns 404 if user attempts to mark as read an announcement not targeted to their group', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce(null); // not found under user filter

      await expect(service.markAsRead(99, 10, 4)).rejects.toThrow(NotFoundException);
    });

    it('marks announcement as read successfully when visible to user', async () => {
      mockQueryBuilder.getOne.mockResolvedValueOnce({
        id: 1,
        title: 'Company Notice',
        target_group_ids: [4],
      });

      const res = await service.markAsRead(1, 10, 4);
      expect(res).toEqual({ success: true });
      expect(mockReadRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          announcement_id: 1,
          user_id: 10,
        }),
      );
    });
  });

  describe('HTML Content Sanitization', () => {
    it('sanitizes HTML content on create', async () => {
      await service.create({
        title: 'Notice',
        content: '<p>Safe</p><script>alert(1)</script><img src=x onerror=alert(1)>',
      });

      expect(mockAnnouncementRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Notice',
          content: '<p>Safe</p>',
        }),
      );
    });

    it('sanitizes HTML content on update', async () => {
      await service.update(1, {
        content: '<b>Bold</b><script>alert(1)</script>',
      });

      expect(mockAnnouncementRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          content: '<b>Bold</b>',
        }),
      );
    });
  });

  describe('Explicit Permission Enforcement (Task P11a-r3)', () => {
    it('admin bypasses permission checks on all admin endpoints', async () => {
      const adminUser = { id: 1, username: 'admin' };

      await service.findAll({}, adminUser);
      await service.findOne(1, adminUser);
      await service.create({ title: 'Admin Notice', content: 'Test' }, adminUser);
      await service.update(1, { title: 'Admin Update' }, adminUser);
      await service.delete(1, adminUser);

      expect(mockPermCache.hasAny).not.toHaveBeenCalled();
    });

    it('rejects findAll and findOne with 403 when user lacks USERS:view', async () => {
      mockPermCache.hasAny.mockResolvedValue(false);
      const staffUser = { id: 2, username: 'staff', groupId: 1 };

      await expect(service.findAll({}, staffUser)).rejects.toThrow(ForbiddenException);
      await expect(service.findOne(1, staffUser)).rejects.toThrow(ForbiddenException);
      expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'USERS', action: 'view' }]);
    });

    it('rejects create with 403 when user lacks USERS:create', async () => {
      mockPermCache.hasAny.mockResolvedValue(false);
      const staffUser = { id: 2, username: 'staff', groupId: 1 };

      await expect(
        service.create({ title: 'Notice', content: 'Content' }, staffUser),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'USERS', action: 'create' }]);
    });

    it('rejects update with 403 when user lacks USERS:update', async () => {
      mockPermCache.hasAny.mockResolvedValue(false);
      const staffUser = { id: 2, username: 'staff', groupId: 1 };

      await expect(service.update(1, { title: 'Updated' }, staffUser)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'USERS', action: 'update' }]);
    });

    it('rejects delete with 403 when user lacks USERS:delete', async () => {
      mockPermCache.hasAny.mockResolvedValue(false);
      const staffUser = { id: 2, username: 'staff', groupId: 1 };

      await expect(service.delete(1, staffUser)).rejects.toThrow(ForbiddenException);
      expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'USERS', action: 'delete' }]);
    });

    it('allows actions when user group has the respective permission', async () => {
      mockPermCache.hasAny.mockResolvedValue(true);
      const staffUser = { id: 2, username: 'staff', groupId: 1 };

      await expect(service.findAll({}, staffUser)).resolves.toBeDefined();
      await expect(service.findOne(1, staffUser)).resolves.toBeDefined();
      await expect(
        service.create({ title: 'Notice', content: 'Content' }, staffUser),
      ).resolves.toBeDefined();
      await expect(service.update(1, { title: 'Updated' }, staffUser)).resolves.toBeDefined();
      await expect(service.delete(1, staffUser)).resolves.toBeDefined();
    });
  });
});
