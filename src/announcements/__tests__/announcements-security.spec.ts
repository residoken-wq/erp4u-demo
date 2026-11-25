import { AnnouncementsService } from '../announcements.service';
import { NotFoundException } from '@nestjs/common';

describe('Announcements Security & Group Targeting (Task P11a)', () => {
  let service: AnnouncementsService;
  let mockAnnouncementRepo: any;
  let mockReadRepo: any;
  let mockQueryBuilder: any;

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
      find: jest.fn(),
      findOne: jest.fn(),
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

    service = new AnnouncementsService(mockAnnouncementRepo, mockReadRepo);
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
});
