import { NotificationsService } from '../notifications.service';
import { NotFoundException } from '@nestjs/common';

describe('Notifications Security (Task P11a)', () => {
  let service: NotificationsService;
  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(async (n) => ({ id: 1, ...n })),
      create: jest.fn((n) => ({ ...n })),
      find: jest.fn().mockResolvedValue([]),
    };

    service = new NotificationsService(mockRepo);
  });

  describe('markAsRead', () => {
    it('returns 404 when notification belongs to another user', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null); // not found with { id: 1, user_id: 10 }

      await expect(service.markAsRead(1, 10)).rejects.toThrow(NotFoundException);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { id: 1, user_id: 10 } });
      expect(mockRepo.update).not.toHaveBeenCalled();
    });

    it('marks notification as read successfully when belonging to user', async () => {
      mockRepo.findOne.mockResolvedValueOnce({ id: 1, user_id: 10, is_read: false });

      const res = await service.markAsRead(1, 10);
      expect(res).toEqual({ success: true });
      expect(mockRepo.update).toHaveBeenCalledWith({ id: 1, user_id: 10 }, { is_read: true });
    });
  });
});
