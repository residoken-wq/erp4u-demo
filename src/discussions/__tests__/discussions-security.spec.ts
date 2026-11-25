import { DiscussionsService } from '../discussions.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('Discussions Security & Permissions (Task P11a)', () => {
  let service: DiscussionsService;
  let mockRepo: any;
  let mockCommentRepo: any;
  let mockNotiService: any;
  let mockPermCache: any;

  beforeEach(() => {
    mockRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (d) => ({ id: 1, ...d })),
      delete: jest.fn(async () => ({ affected: 1 })),
      update: jest.fn(async () => ({ affected: 1 })),
      increment: jest.fn(async () => ({ affected: 1 })),
    };
    mockCommentRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (c) => ({ id: 10, ...c })),
      findOne: jest.fn(),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    mockNotiService = {
      create: jest.fn(async () => ({})),
    };
    mockPermCache = {
      hasAny: jest.fn(),
    };

    service = new DiscussionsService(mockRepo, mockCommentRepo, mockNotiService, mockPermCache);
  });

  describe('isModerator', () => {
    it('grants moderator strictly when username is admin', async () => {
      expect(await service.isModerator({ username: 'admin' })).toBe(true);
      expect(await service.isModerator({ username: 'admin_user', role: 'ADMIN' })).toBe(false);
      expect(await service.isModerator({ is_admin: true })).toBe(false);
    });

    it('grants moderator when user group has SYSTEM:update via PermissionCacheService', async () => {
      mockPermCache.hasAny.mockResolvedValueOnce(true);
      const isMod = await service.isModerator({ username: 'lead', groupId: 5 });
      expect(isMod).toBe(true);
      expect(mockPermCache.hasAny).toHaveBeenCalledWith(5, [{ module: 'SYSTEM', action: 'update' }]);
    });

    it('denies moderator when user group lacks SYSTEM:update', async () => {
      mockPermCache.hasAny.mockResolvedValueOnce(false);
      const isMod = await service.isModerator({ username: 'staff', groupId: 2 });
      expect(isMod).toBe(false);
    });
  });

  describe('Group Scope Isolation', () => {
    it('user in Group X viewing discussion in Group Y returns 404', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Group Y discussion',
        group_id: 2, // Group Y
        creator_id: 100,
        comments: [],
      });
      mockPermCache.hasAny.mockResolvedValue(false);

      const userGroupX = { id: 10, username: 'userX', groupId: 1 };
      await expect(service.findOne(1, userGroupX)).rejects.toThrow(NotFoundException);
    });

    it('moderator can view discussion in any group', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Group Y discussion',
        group_id: 2,
        creator_id: 100,
        comments: [],
      });
      const admin = { id: 99, username: 'admin' };
      const res = await service.findOne(1, admin);
      expect(res.id).toBe(1);
      expect(res.can_pin).toBe(true);
    });

    it('non-moderator creating discussion in another group returns 403', async () => {
      mockPermCache.hasAny.mockResolvedValue(false);
      const user = { id: 10, username: 'userX', groupId: 1 };
      await expect(
        service.create({ title: 'Topic', content: 'Hello', group_id: 2 }, user),
      ).rejects.toThrow(ForbiddenException);
    });

    it('non-moderator creating discussion in own group or public succeeds', async () => {
      mockPermCache.hasAny.mockResolvedValue(false);
      const user = { id: 10, username: 'userX', groupId: 1 };

      const publicRes = await service.create({ title: 'Public Topic', content: 'Hello', group_id: null as any }, user);
      expect(publicRes).toBeDefined();

      const groupRes = await service.create({ title: 'Group 1 Topic', content: 'Hello', group_id: 1 }, user);
      expect(groupRes).toBeDefined();
    });

    it('moderator can create discussion in any group', async () => {
      const admin = { id: 99, username: 'admin' };
      const res = await service.create({ title: 'Admin in Group 2', content: 'Hello', group_id: 2 }, admin);
      expect(res).toBeDefined();
    });
  });

  describe('Ownership and Permissions on Edit/Delete/Pin', () => {
    it('user B editing user A discussion returns 403', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        creator_id: 100, // User A
        group_id: null,
      });
      mockPermCache.hasAny.mockResolvedValue(false);

      const userB = { id: 200, username: 'userB' };
      await expect(service.update(1, { title: 'New' }, userB)).rejects.toThrow(ForbiddenException);
    });

    it('user B deleting user A discussion returns 403', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        creator_id: 100,
        group_id: null,
      });
      mockPermCache.hasAny.mockResolvedValue(false);

      const userB = { id: 200, username: 'userB' };
      await expect(service.remove(1, userB)).rejects.toThrow(ForbiddenException);
    });

    it('non-moderator attempting to pin returns 403', async () => {
      mockPermCache.hasAny.mockResolvedValue(false);
      const regularUser = { id: 100, username: 'userA' };
      await expect(service.pin(1, true, regularUser)).rejects.toThrow(ForbiddenException);
    });

    it('moderator can pin discussion', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 1,
        creator_id: 100,
        group_id: null,
        comments: [],
      });
      const admin = { id: 1, username: 'admin' };
      const res = await service.pin(1, true, admin);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { is_pinned: true });
    });
  });

  describe('Creation and Token Identity', () => {
    it('takes creator_id from token user and ignores fake body', async () => {
      const user = { id: 42, username: 'realUser' };
      const fakeDto: any = {
        title: 'Safe Title',
        content: '<p>Content</p><script>alert(1)</script>',
        creator_id: 999, // Fake creator ID
      };

      const result = await service.create(fakeDto, user);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 42,
          title: 'Safe Title',
        }),
      );
      // Script is sanitized out
      expect(mockRepo.create.mock.calls[0][0].content).not.toContain('<script>');
    });

    it('rejects empty content after sanitization', async () => {
      const user = { id: 42, username: 'realUser' };
      await expect(
        service.create({ title: 'Test', content: '<script>alert(1)</script>' } as any, user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Comments and NotificationsService', () => {
    it('creates notification via NotificationsService instead of direct repo save', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Discussion Topic',
        creator_id: 100,
        group_id: null,
      });
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        title: 'Discussion Topic',
        creator_id: 100,
        group_id: null,
        comments: [],
      });

      const commenter = { id: 200, username: 'commenter' };
      await service.addComment(1, { content: 'Nice topic!' }, commenter);

      expect(mockNotiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 100,
          title: '💬 Bình luận mới',
          link: '/workspace/discussions/1',
        }),
      );
    });
  });
});
