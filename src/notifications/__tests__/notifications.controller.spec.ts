import { UnauthorizedException } from '@nestjs/common';
import { NotificationsController } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from '../../common/tenancy/tenant-context';

describe('NotificationsController (Task P11c & P11c-r2)', () => {
  let controller: NotificationsController;
  let mockService: Partial<NotificationsService>;
  let mockJwtService: any;
  const originalStrict = process.env.TENANCY_STRICT;

  beforeEach(() => {
    mockService = {
      subscribeClient: jest.fn(),
      findByUser: jest.fn(),
      markAsRead: jest.fn(),
      markAllRead: jest.fn(),
    };

    mockJwtService = {
      decode: jest.fn(),
    };

    controller = new NotificationsController(
      mockService as NotificationsService,
      mockJwtService,
    );

    delete process.env.TENANCY_STRICT;
  });

  afterEach(() => {
    if (originalStrict === undefined) {
      delete process.env.TENANCY_STRICT;
    } else {
      process.env.TENANCY_STRICT = originalStrict;
    }
  });

  describe('stream query token rejection', () => {
    it('throws UnauthorizedException when token is in query string', () => {
      const req: any = {
        query: { token: 'some_token' },
        user: { id: 1 },
        headers: {},
      };
      const res: any = {};

      expect(() => controller.stream(req, res)).toThrow(UnauthorizedException);
      expect(() => controller.stream(req, res)).toThrow('Token via query string is not accepted');
      expect(mockService.subscribeClient).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when access_token is in query string', () => {
      const req: any = {
        query: { access_token: 'some_token' },
        user: { id: 1 },
        headers: {},
      };
      const res: any = {};

      expect(() => controller.stream(req, res)).toThrow(UnauthorizedException);
      expect(mockService.subscribeClient).not.toHaveBeenCalled();
    });
  });

  describe('stream tenancy isolation & fail-closed behavior (P11c-r2)', () => {
    it('throws UnauthorizedException (fail-closed) when TENANCY_STRICT=true and no store is active', () => {
      process.env.TENANCY_STRICT = 'true';

      const req: any = {
        user: { id: 1 },
        headers: { authorization: 'Bearer valid.jwt.token' },
      };
      const res: any = {};

      expect(() => controller.stream(req, res)).toThrow(UnauthorizedException);
      expect(() => controller.stream(req, res)).toThrow('Tenant context is required');
      expect(mockService.subscribeClient).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when running multi-tenant (token has tid) but no store is active', () => {
      process.env.TENANCY_STRICT = 'false';

      const req: any = {
        user: { id: 1, tid: 'tenant_custom' },
        headers: { authorization: 'Bearer valid.jwt.token' },
      };
      const res: any = {};

      expect(() => controller.stream(req, res)).toThrow(UnauthorizedException);
      expect(() => controller.stream(req, res)).toThrow('Tenant context is required');
      expect(mockService.subscribeClient).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when running multi-tenant (x-tenant-id header present) but no store is active', () => {
      process.env.TENANCY_STRICT = 'false';

      const req: any = {
        user: { id: 1 },
        headers: {
          authorization: 'Bearer valid.jwt.token',
          'x-tenant-id': 'tenant_xyz',
        },
      };
      const res: any = {};

      expect(() => controller.stream(req, res)).toThrow(UnauthorizedException);
      expect(mockService.subscribeClient).not.toHaveBeenCalled();
    });

    it('successfully subscribes client with active tenantId when running inside TenantContext.run', () => {
      const customTenant = { tenantId: 'tenant_company_a', schema: 'tenant_company_a' };
      const req: any = {
        user: { id: 42, tid: 'tenant_company_a' },
        headers: { authorization: 'Bearer valid.jwt.token' },
      };
      const res: any = {};
      mockJwtService.decode.mockReturnValue({ exp: 1700000000 });

      TenantContext.run(customTenant, () => {
        controller.stream(req, res);
      });

      expect(mockService.subscribeClient).toHaveBeenCalledWith({
        tenantId: 'tenant_company_a',
        userId: 42,
        req,
        res,
        jwtExp: 1700000000,
      });
    });

    it('successfully subscribes client with default tenant in single-tenant demo mode', () => {
      delete process.env.TENANCY_STRICT;

      const req: any = {
        user: { id: 5 },
        headers: {},
      };
      const res: any = {};

      controller.stream(req, res);

      expect(mockService.subscribeClient).toHaveBeenCalledWith({
        tenantId: DEFAULT_TENANT_CONTEXT.tenantId,
        userId: 5,
        req,
        res,
        jwtExp: undefined,
      });
    });
  });

  describe('findAll, read, readAll delegate to service', () => {
    it('findAll uses req.user.id', async () => {
      const req: any = { user: { id: 7 } };
      await controller.findAll(req);
      expect(mockService.findByUser).toHaveBeenCalledWith(7);
    });

    it('read delegates to service.markAsRead', async () => {
      const req: any = { user: { id: 7 } };
      await controller.read('12', req);
      expect(mockService.markAsRead).toHaveBeenCalledWith(12, 7);
    });

    it('readAll delegates to service.markAllRead', async () => {
      const req: any = { user: { id: 7 } };
      await controller.readAll(req);
      expect(mockService.markAllRead).toHaveBeenCalledWith(7);
    });
  });
});
