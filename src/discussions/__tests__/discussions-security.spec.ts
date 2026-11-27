import { DiscussionsService } from '../discussions.service';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('Discussions Security & Logic (Tasks P11a & P11b)', () => {
  let service: DiscussionsService;
  let mockRepo: any;
  let mockCommentRepo: any;
  let mockReadRepo: any;
  let mockUserRepo: any;
  let mockNotiService: any;
  let mockPermCache: any;

  beforeEach(() => {
    mockRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (d) => ({ id: 1, ...d })),
      delete: jest.fn(async () => ({ affected: 1 })),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    mockCommentRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (c) => ({ id: 10, ...c })),
      findOne: jest.fn(),
      find: jest.fn(async () => []),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    mockReadRepo = {
      create: jest.fn((dto) => ({ ...dto })),
      save: jest.fn(async (r) => ({ id: 100, ...r })),
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      count: jest.fn(async () => 1),
      delete: jest.fn(async () => ({ affected: 1 })),
    };
    mockUserRepo = {
      find: jest.fn(async () => []),
      findOne: jest.fn(async () => null),
    };
    mockNotiService = {
      create: jest.fn(async () => ({})),
    };
    mockPermCache = {
      hasAny: jest.fn(),
    };

    service = new DiscussionsService(
      mockRepo,
      mockCommentRepo,
      mockReadRepo,
      mockUserRepo,
      mockNotiService,
      mockPermCache,
    );
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

  describe('Ownership and Permissions on Edit/Delete/Pin (P11b strictly owner can edit)', () => {
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

    it('moderator CANNOT edit user A discussion (strictly owner only), returns 403', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        creator_id: 100,
        group_id: null,
      });

      const admin = { id: 99, username: 'admin' };
      await expect(service.update(1, { title: 'Admin edit' }, admin)).rejects.toThrow(ForbiddenException);
    });

    it('owner editing own discussion succeeds and updates edited_at', async () => {
      const savedDiscussion: any = {
        id: 1,
        creator_id: 100,
        title: 'Old title',
        content: 'Old content',
        group_id: null,
        comments: [],
      };
      mockRepo.findOne.mockResolvedValue(savedDiscussion);

      const owner = { id: 100, username: 'owner' };
      await service.update(1, { title: 'Updated title', content: 'Updated content' }, owner);

      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: 'Updated title',
          content: 'Updated content',
          edited_at: expect.any(Date),
        }),
      );
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

    it('moderator can delete user A discussion', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        creator_id: 100,
        group_id: null,
      });

      const admin = { id: 99, username: 'admin' };
      const res = await service.remove(1, admin);
      expect(mockRepo.delete).toHaveBeenCalledWith(1);
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
      await service.pin(1, true, admin);
      expect(mockRepo.update).toHaveBeenCalledWith(1, { is_pinned: true });
    });
  });

  describe('Creation and Token Identity', () => {
    it('takes creator_id from token user and ignores fake body', async () => {
      const user = { id: 42, username: 'realUser' };
      const fakeDto: any = {
        title: 'Safe Title',
        content: '<p>Content</p><script>alert(1)</script>',
        creator_id: 999,
      };

      const result = await service.create(fakeDto, user);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          creator_id: 42,
          title: 'Safe Title',
        }),
      );
      expect(mockRepo.create.mock.calls[0][0].content).not.toContain('<script>');
    });

    it('rejects empty content after sanitization', async () => {
      const user = { id: 42, username: 'realUser' };
      await expect(
        service.create({ title: 'Test', content: '<script>alert(1)</script>' } as any, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects creation with type = ANNOUNCEMENT (returns 400)', async () => {
      const user = { id: 42, username: 'realUser' };
      await expect(
        service.create({ title: 'Test', content: 'Content', type: 'ANNOUNCEMENT' } as any, user),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects update with type = ANNOUNCEMENT (returns 400)', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        creator_id: 42,
        group_id: null,
      });
      const user = { id: 42, username: 'realUser' };
      await expect(
        service.update(1, { type: 'ANNOUNCEMENT' } as any, user),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Comment Edit & Permissions', () => {
    it('editing another user comment returns 403', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 10,
        discussion_id: 1,
        user_id: 100, // Author A
        content: 'Original',
      });
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        group_id: null,
      });

      const userB = { id: 200, username: 'userB' };
      await expect(service.updateComment(10, { content: 'Hacked' }, userB)).rejects.toThrow(ForbiddenException);
    });

    it('moderator editing another user comment returns 403 (strictly owner only)', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 10,
        discussion_id: 1,
        user_id: 100,
        content: 'Original',
      });
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        group_id: null,
      });

      const admin = { id: 99, username: 'admin' };
      await expect(service.updateComment(10, { content: 'Admin mod' }, admin)).rejects.toThrow(ForbiddenException);
    });

    it('owner editing comment updates content and sets edited_at', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 10,
        discussion_id: 1,
        user_id: 100,
        content: 'Original',
      });
      mockRepo.findOne.mockResolvedValueOnce({
        id: 1,
        group_id: null,
      });

      const owner = { id: 100, username: 'owner' };
      await service.updateComment(10, { content: '<b>Updated</b><script>alert(1)</script>' }, owner);

      expect(mockCommentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 10,
          content: '<b>Updated</b>',
          edited_at: expect.any(Date),
        }),
      );
    });
  });

  describe('Discussion Reads tracking and view count', () => {
    it('findOne upserts discussion_reads for user and returns view_count from distinct readers', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 1,
        title: 'Topic 1',
        creator_id: 100,
        group_id: null,
        comments: [],
      });
      mockReadRepo.count.mockResolvedValue(5);

      const user = { id: 100, username: 'user' };
      const res = await service.findOne(1, user);

      expect(mockReadRepo.save).toHaveBeenCalled();
      expect(res.view_count).toBe(5);
    });
  });

  describe('NotificationsService and Mentions', () => {
    it('new comment notifies discussion creator and other commenters, but NOT sender', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 1,
        title: 'Discussion Topic',
        creator_id: 100,
        group_id: null,
        comments: [],
      });
      // Previous commenters: user 100 (creator), user 200, user 300
      mockCommentRepo.find.mockResolvedValue([
        { user_id: 100 },
        { user_id: 200 },
        { user_id: 300 },
      ]);

      // User 200 posts a new comment
      const commenter = { id: 200, username: 'user200', full_name: 'User 200' };
      await service.addComment(1, { content: 'Hello all!' }, commenter);

      // Should notify creator 100 and commenter 300, NOT 200
      expect(mockNotiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 100,
          title: '💬 Bình luận mới',
          link: '/workspace/discussions/1',
        }),
      );
      expect(mockNotiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 300,
          title: '💬 Bình luận mới',
          link: '/workspace/discussions/1',
        }),
      );
      // Ensure sender 200 did not receive notification
      expect(mockNotiService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 200 }),
      );
    });

    it('new group discussion notifies active members of the group, not creator', async () => {
      mockUserRepo.find.mockResolvedValueOnce([
        { id: 10, full_name: 'Member 10', group_id: 2, is_active: true },
        { id: 20, full_name: 'Member 20', group_id: 2, is_active: true },
      ]);

      const creator = { id: 1, username: 'creator', groupId: 2, full_name: 'Creator' };
      const created = await service.create(
        { title: 'Group 2 Discussion', content: 'Secret project', group_id: 2 },
        creator,
      );

      expect(mockNotiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 10,
          title: '💬 Thảo luận mới trong nhóm',
          link: `/workspace/discussions/${created.id}`,
        }),
      );
      expect(mockNotiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 20,
          title: '💬 Thảo luận mới trong nhóm',
          link: `/workspace/discussions/${created.id}`,
        }),
      );
      expect(mockNotiService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 1 }),
      );
    });

    it('mentions in group discussion only notify valid active members of that group or moderators', async () => {
      // User 10 is in group 2 (active)
      // User 30 is in group 3 (not moderator)
      // User 99 is in group 3 but is admin (moderator)
      mockUserRepo.find.mockResolvedValueOnce([
        { id: 10, group_id: 2, is_active: true },
        { id: 30, group_id: 3, is_active: true },
        { id: 99, group_id: 3, username: 'admin', is_active: true },
      ]);
      mockUserRepo.find.mockResolvedValueOnce([]); // group members

      const creator = { id: 1, username: 'creator', groupId: 2, full_name: 'Creator' };
      const created = await service.create(
        {
          title: 'Group 2 Discussion',
          content: 'Notice @10 @30 @99',
          group_id: 2,
          mentioned_user_ids: [10, 30, 99],
        },
        creator,
      );

      // User 10 (group member) and User 99 (admin moderator) are notified
      expect(mockNotiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 10,
          title: '📢 Có người nhắc đến bạn',
        }),
      );
      expect(mockNotiService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 99,
          title: '📢 Có người nhắc đến bạn',
        }),
      );
      // User 30 is in group 3 and not moderator -> ignored
      expect(mockNotiService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ user_id: 30 }),
      );
    });
  });
});
