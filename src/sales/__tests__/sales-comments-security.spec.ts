import { SalesService } from '../sales.service';
import { NotFoundException, ForbiddenException, BadRequestException, HttpException } from '@nestjs/common';

describe('Sales Comments & Customer Portal Security (Task P11a)', () => {
  let service: SalesService;
  let mockOrderRepo: any;
  let mockCommentRepo: any;
  let mockUserRepo: any;
  let mockNotificationsService: any;
  let mockProductsService: any;
  let mockTransRepo: any;
  let mockSystemService: any;
  let mockPermCache: any;

  beforeEach(() => {
    mockOrderRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (o) => o),
    };
    mockCommentRepo = {
      create: jest.fn((c) => ({ ...c })),
      save: jest.fn(async (c) => ({ id: 101, ...c })),
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      find: jest.fn().mockResolvedValue([]),
    };
    mockUserRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockNotificationsService = {
      create: jest.fn(async () => ({})),
    };
    mockProductsService = {
      findOneBySku: jest.fn(),
      populateComboDescriptions: jest.fn(),
    };
    mockTransRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockSystemService = {
      logAction: jest.fn(),
    };
    mockPermCache = {
      hasAny: jest.fn().mockResolvedValue(true),
    };

    service = new SalesService(
      mockOrderRepo,
      {} as any,
      {} as any,
      {} as any,
      mockCommentRepo,
      {} as any,
      {} as any,
      mockSystemService,
      mockTransRepo,
      {} as any,
      {} as any,
      mockUserRepo,
      {} as any,
      {} as any,
      {} as any,
      mockProductsService,
      {} as any,
      {} as any,
      mockNotificationsService,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      undefined,
      undefined,
      undefined,
      mockPermCache,
    );
  });

  describe('Customer Portal Quote Comments', () => {
    const mockOrder = {
      id: 1,
      uuid: 'uuid-1234',
      customer_name: 'Khách hàng A',
      customer: { name: 'Công ty A' },
    };

    it('forces sender_type=CUSTOMER, comment_type=CUSTOMER, is_visible=true and ignores malicious body fields', async () => {
      mockOrderRepo.findOne.mockResolvedValueOnce(mockOrder);

      const maliciousBody = {
        content: '<p>Xin chào</p><script>alert(1)</script>',
        sender: 'STAFF',
        comment_type: 'INTERNAL',
        mentioned_user_ids: '1,2,3',
        name: 'Giả mạo',
      };

      const result = await service.portalAddComment('uuid-1234', maliciousBody);

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sender_type: 'CUSTOMER',
          comment_type: 'CUSTOMER',
          is_visible: true,
          mentioned_user_ids: undefined,
          sender_name: 'Giả mạo',
        }),
      );
      expect(mockCommentRepo.create.mock.calls[0][0].content).not.toContain('<script>');
      expect(result).not.toHaveProperty('mentioned_user_ids');
    });

    it('rejects 21st comment in one hour with 429 Too Many Requests', async () => {
      mockOrderRepo.findOne.mockResolvedValueOnce(mockOrder);
      mockCommentRepo.count.mockResolvedValueOnce(20); // Already 20 comments this hour

      await expect(
        service.portalAddComment('uuid-1234', { content: 'Tin nhắn thứ 21' }),
      ).rejects.toThrow(HttpException);
    });

    it('rejects empty content after sanitization with 400', async () => {
      mockOrderRepo.findOne.mockResolvedValueOnce(mockOrder);
      await expect(
        service.portalAddComment('uuid-1234', { content: '<script>alert(1)</script>' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('customer cannot delete a STAFF comment (returns 404)', async () => {
      mockOrderRepo.findOne.mockResolvedValueOnce(mockOrder);
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 50,
        order: { id: mockOrder.id },
        sender_type: 'STAFF', // Staff comment
        content: 'Bình luận của nhân viên',
      });

      await expect(service.portalDeleteComment('uuid-1234', 50)).rejects.toThrow(NotFoundException);
    });

    it('customer can delete their own CUSTOMER comment', async () => {
      mockOrderRepo.findOne.mockResolvedValueOnce(mockOrder);
      const customerComment = {
        id: 51,
        order: { id: mockOrder.id },
        sender_type: 'CUSTOMER',
        content: 'Tin nhắn của tôi',
      };
      mockCommentRepo.findOne.mockResolvedValueOnce(customerComment);

      const res = await service.portalDeleteComment('uuid-1234', 51);
      expect(res).toEqual({ success: true });
      expect(customerComment).toHaveProperty('deleted_at');
    });
  });

  describe('getQuoteByUuid filtering', () => {
    it('filters out INTERNAL comments, strips mentioned_user_ids, sanitizes assigned_to and customer CRM fields', async () => {
      const mockHrService = {
        findEmployeeByUserId: jest.fn().mockResolvedValueOnce({
          phone: '0900000001',
          user: { email: 'assigned@example.com' },
        }),
      };
      (service as any).hrService = mockHrService;

      const rawOrder = {
        id: 1,
        uuid: 'test-uuid',
        order_code: 'SO-001',
        items: [],
        assigned_to: {
          id: 5,
          full_name: 'Nhân viên A',
          email: 'secret@example.com',
          ip_address: '1.2.3.4',
          group: { name: 'Admin' },
          username: 'admin',
        },
        customer: {
          id: 10,
          name: 'Khách Test',
          portrait_notes: '<p>Ghi chú mật</p>',
          credit_limit: 100000000,
          potential_value: 50000000,
        },
        comments: [
          { id: 1, sender_type: 'CUSTOMER', is_visible: true, content: 'Comment 1', deleted_at: null },
          { id: 2, sender_type: 'STAFF', comment_type: 'INTERNAL', is_visible: false, content: 'Internal note', deleted_at: null },
          { id: 3, sender_type: 'STAFF', comment_type: 'CUSTOMER', is_visible: true, content: 'Public reply', mentioned_user_ids: '5', deleted_at: null },
          { id: 4, sender_type: 'CUSTOMER', content: 'Deleted comment', deleted_at: new Date() },
        ],
      };
      mockOrderRepo.findOne.mockResolvedValueOnce(rawOrder);

      const quote: any = await service.getQuoteByUuid('test-uuid');

      // Comments: INTERNAL and deleted comments must be excluded
      expect(quote.comments).toHaveLength(2);
      expect(quote.comments.map((c: any) => c.id)).toEqual([1, 3]);
      expect(quote.comments[1]).not.toHaveProperty('mentioned_user_ids');

      // assigned_to: exactly 4 keys: id, full_name, phone, email
      expect(quote.assigned_to).toEqual({
        id: 5,
        full_name: 'Nhân viên A',
        phone: '0900000001',
        email: 'assigned@example.com',
      });
      expect(Object.keys(quote.assigned_to).sort()).toEqual(['email', 'full_name', 'id', 'phone']);
      expect(quote.assigned_to.ip_address).toBeUndefined();
      expect(quote.assigned_to.group).toBeUndefined();
      expect(quote.assigned_to.username).toBeUndefined();

      // customer: CRM fields stripped
      expect(quote.customer.portrait_notes).toBeUndefined();
      expect(quote.customer.credit_limit).toBeUndefined();
    });
  });

  describe('Staff Sales Order Comments', () => {
    it('editing another user comment returns 403', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 10,
        sender_type: 'STAFF',
        created_by_user_id: 100, // User A
        content: 'Original',
      });

      const userB = { id: 200, username: 'userB' };
      await expect(service.updateStaffComment(10, 'Edited', userB)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('editing a CUSTOMER comment returns 403 even for admin', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 10,
        sender_type: 'CUSTOMER',
        content: 'Customer text',
      });

      const admin = { id: 1, username: 'admin' };
      await expect(service.updateStaffComment(10, 'Edited', admin)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('owner or admin can edit STAFF comment and sets edited_at', async () => {
      const comment = {
        id: 10,
        sender_type: 'STAFF',
        created_by_user_id: 100,
        content: 'Original',
        edited_at: null,
      };
      mockCommentRepo.findOne.mockResolvedValue(comment);

      const userA = { id: 100, username: 'userA', groupId: 1 };
      await service.updateStaffComment(10, 'Edited content', userA);

      expect(comment.content).toBe('Edited content');
      expect(comment.edited_at).toBeInstanceOf(Date);
    });

    it('toggle visibility only allowed for CUSTOMER comments', async () => {
      mockCommentRepo.findOne.mockResolvedValueOnce({
        id: 10,
        comment_type: 'INTERNAL',
        is_visible: false,
      });

      await expect(service.toggleCommentVisibility(10)).rejects.toThrow(BadRequestException);
    });

    it('filters out non-existent or inactive user mentions', async () => {
      mockOrderRepo.findOne.mockResolvedValueOnce({ id: 1, order_code: 'SO-01' });
      // User 2 is active, user 99 does not exist, user 3 is inactive
      mockUserRepo.find.mockResolvedValueOnce([{ id: 2 }]);

      const staffUser = { id: 10, full_name: 'Staff A', groupId: 1 };
      await service.addStaffComment(
        1,
        {
          content: 'Hello @user',
          comment_type: 'INTERNAL',
          mentioned_user_ids: '2,99,3',
        },
        staffUser,
      );

      expect(mockCommentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mentioned_user_ids: '2',
        }),
      );
    });

    describe('Explicit SALES Permissions (Task P11a-r3)', () => {
      it('admin bypasses permission checks for sales comment operations', async () => {
        mockOrderRepo.findOne.mockResolvedValue({ id: 1, order_code: 'SO-01' });
        mockCommentRepo.findOne.mockResolvedValue({
          id: 10,
          sender_type: 'STAFF',
          created_by_user_id: 1,
          comment_type: 'CUSTOMER',
          is_visible: true,
        });

        const admin = { id: 1, username: 'admin' };
        await service.getComments(1, admin);
        await service.addStaffComment(1, { content: 'Admin chat', comment_type: 'INTERNAL' }, admin);
        await service.updateStaffComment(10, 'Admin edit', admin);
        await service.toggleCommentVisibility(10, admin);
        await service.softDeleteStaffComment(10, admin);

        expect(mockPermCache.hasAny).not.toHaveBeenCalled();
      });

      it('rejects addStaffComment with 403 when user lacks SALES:create', async () => {
        mockPermCache.hasAny.mockResolvedValue(false);
        const staff = { id: 2, username: 'staff', groupId: 1 };

        await expect(
          service.addStaffComment(1, { content: 'Chat', comment_type: 'INTERNAL' }, staff),
        ).rejects.toThrow(ForbiddenException);
        expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'SALES', action: 'create' }]);
      });

      it('rejects updateStaffComment with 403 when user lacks SALES:update', async () => {
        mockPermCache.hasAny.mockResolvedValue(false);
        const staff = { id: 2, username: 'staff', groupId: 1 };

        await expect(service.updateStaffComment(10, 'Edit', staff)).rejects.toThrow(
          ForbiddenException,
        );
        expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'SALES', action: 'update' }]);
      });

      it('rejects getComments with 403 when user lacks SALES:view', async () => {
        mockPermCache.hasAny.mockResolvedValue(false);
        const staff = { id: 2, username: 'staff', groupId: 1 };

        await expect(service.getComments(1, staff)).rejects.toThrow(ForbiddenException);
        expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'SALES', action: 'view' }]);
      });

      it('rejects softDeleteStaffComment with 403 when user lacks SALES:delete', async () => {
        mockPermCache.hasAny.mockResolvedValue(false);
        const staff = { id: 2, username: 'staff', groupId: 1 };

        await expect(service.softDeleteStaffComment(10, staff)).rejects.toThrow(ForbiddenException);
        expect(mockPermCache.hasAny).toHaveBeenCalledWith(1, [{ module: 'SALES', action: 'delete' }]);
      });
    });
  });
});
