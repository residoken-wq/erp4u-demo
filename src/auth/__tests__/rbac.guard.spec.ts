import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RbacGuard } from '../rbac.guard';
import { RbacModeService } from '../rbac-mode.service';
import { RbacAccessLogService } from '../rbac-access-log.service';
import { PermissionCacheService } from '../permission-cache.service';
import { IS_PUBLIC_KEY } from '../public.decorator';
import { RBAC_KEY } from '../permissions.decorator';
import { ApiKeyGuard } from '../api-key.guard';

describe('RbacGuard (SHADOW, ENFORCE & Fail-Closed)', () => {
  let guard: RbacGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;
  let rbacModeService: jest.Mocked<RbacModeService>;
  let accessLog: jest.Mocked<RbacAccessLogService>;
  let permCacheService: jest.Mocked<PermissionCacheService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
      get: jest.fn(),
    } as any;

    jwtService = {
      verify: jest.fn(),
    } as any;

    rbacModeService = {
      get: jest.fn().mockResolvedValue('SHADOW'),
    } as any;

    accessLog = {
      record: jest.fn().mockResolvedValue(undefined),
    } as any;

    permCacheService = {
      hasAny: jest.fn().mockResolvedValue(false),
    } as any;

    guard = new RbacGuard(reflector, jwtService, rbacModeService, accessLog, permCacheService);
  });

  function createMockContext(headers: Record<string, string> = {}): ExecutionContext {
    const req = {
      headers,
      method: 'GET',
      originalUrl: '/test-route',
      baseUrl: '',
      route: { path: '/test-route' },
      ip: '127.0.0.1',
    };
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
    } as any;
  }

  describe('Public & ApiKey bypass', () => {
    it('allows public route without token in ENFORCE mode', async () => {
      rbacModeService.get.mockResolvedValue('ENFORCE');
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC_KEY) return true;
        return undefined;
      });

      const ctx = createMockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('allows ApiKeyGuard protected route in ENFORCE mode', async () => {
      rbacModeService.get.mockResolvedValue('ENFORCE');
      reflector.getAllAndOverride.mockReturnValue(undefined);
      reflector.get.mockReturnValue([ApiKeyGuard]);

      const ctx = createMockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });
  });

  describe('SHADOW mode behavior', () => {
    it('allows request without token and records DENY_NO_AUTH log', async () => {
      rbacModeService.get.mockResolvedValue('SHADOW');
      reflector.getAllAndOverride.mockReturnValue(undefined); // unclassified -> tier AUTH

      const ctx = createMockContext();
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(accessLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'DENY_NO_AUTH', mode: 'SHADOW' }),
      );
    });

    it('allows request with lacking permission and records DENY_NO_PERM log', async () => {
      rbacModeService.get.mockResolvedValue('SHADOW');
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === RBAC_KEY) return { tier: 'PERM', any: [{ module: 'SALES', action: 'view' }] };
        return undefined;
      });
      jwtService.verify.mockReturnValue({ sub: 10, username: 'user1', group_id: 3 });
      permCacheService.hasAny.mockResolvedValue(false);

      const ctx = createMockContext({ authorization: 'Bearer valid.jwt.token' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(accessLog.record).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'DENY_NO_PERM', mode: 'SHADOW' }),
      );
    });
  });

  describe('ENFORCE mode behavior', () => {
    beforeEach(() => {
      rbacModeService.get.mockResolvedValue('ENFORCE');
    });

    it('throws 401 UnauthorizedException when request lacks token', async () => {
      reflector.getAllAndOverride.mockReturnValue(undefined); // AUTH tier

      const ctx = createMockContext();
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    });

    it('throws 403 ForbiddenException when user lacks required permission', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === RBAC_KEY) return { tier: 'PERM', any: [{ module: 'SALES', action: 'create' }] };
        return undefined;
      });
      jwtService.verify.mockReturnValue({ sub: 10, username: 'user1', group_id: 3 });
      permCacheService.hasAny.mockResolvedValue(false);

      const ctx = createMockContext({ authorization: 'Bearer valid.jwt.token' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
    });

    it('allows admin user even if group lacks permission', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === RBAC_KEY) return { tier: 'PERM', any: [{ module: 'SALES', action: 'create' }] };
        return undefined;
      });
      jwtService.verify.mockReturnValue({ sub: 1, username: 'admin', group_id: 1 });

      const ctx = createMockContext({ authorization: 'Bearer admin.jwt.token' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
      expect(permCacheService.hasAny).not.toHaveBeenCalled();
    });

    it('allows user with sufficient permission', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === RBAC_KEY) return { tier: 'PERM', any: [{ module: 'SALES', action: 'create' }] };
        return undefined;
      });
      jwtService.verify.mockReturnValue({ sub: 10, username: 'seller', group_id: 2 });
      permCacheService.hasAny.mockResolvedValue(true);

      const ctx = createMockContext({ authorization: 'Bearer valid.jwt.token' });
      const result = await guard.canActivate(ctx);
      expect(result).toBe(true);
    });

    it('fails closed (throws ForbiddenException) on internal guard error in ENFORCE', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === RBAC_KEY) return { tier: 'PERM', any: [{ module: 'SALES', action: 'create' }] };
        return undefined;
      });
      jwtService.verify.mockReturnValue({ sub: 10, username: 'seller', group_id: 2 });
      permCacheService.hasAny.mockRejectedValue(new Error('DB Connection lost'));

      const ctx = createMockContext({ authorization: 'Bearer valid.jwt.token' });
      await expect(guard.canActivate(ctx)).rejects.toThrow(
        new ForbiddenException('Lỗi phân quyền hệ thống. Truy cập bị chặn để đảm bảo an toàn.'),
      );
    });
  });
});
