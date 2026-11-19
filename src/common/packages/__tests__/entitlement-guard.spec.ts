import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementGuard } from '../entitlement.guard';
import { AllEnabledProvider } from '../all-enabled.provider';
import { DbEntitlementProvider } from '../db-entitlement.provider';
import { PackageKey } from '../package.registry';
import { REQUIRES_PACKAGE_KEY } from '../requires-package.decorator';
import { TenantEntitlement } from '../tenant-entitlement.entity';

describe('Check 2: EntitlementGuard Spec', () => {
  let reflector: Reflector;

  const createMockContext = (packageOnHandler?: PackageKey, packageOnClass?: PackageKey): ExecutionContext => {
    const handler = () => {};
    const targetClass = class TestController {};

    if (packageOnHandler) {
      Reflect.defineMetadata(REQUIRES_PACKAGE_KEY, packageOnHandler, handler);
    }
    if (packageOnClass) {
      Reflect.defineMetadata(REQUIRES_PACKAGE_KEY, packageOnClass, targetClass);
    }

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
  });

  describe('Mode "all": AllEnabledProvider', () => {
    it('allows all routes regardless of required package', async () => {
      const provider = new AllEnabledProvider();
      const guard = new EntitlementGuard(reflector, provider);

      // Core route
      expect(await guard.canActivate(createMockContext(PackageKey.CORE))).toBe(true);

      // Sales route
      expect(await guard.canActivate(createMockContext(PackageKey.SALES))).toBe(true);

      // Production route
      expect(await guard.canActivate(createMockContext(PackageKey.PRODUCTION))).toBe(true);

      // Unannotated route
      expect(await guard.canActivate(createMockContext(undefined))).toBe(true);
    });
  });

  describe('Mode "db": DbEntitlementProvider', () => {
    it('only CORE and SALES enabled: handler PRODUCTION returns 402 with exact body', async () => {
      const mockRepo = {
        find: jest.fn().mockResolvedValue([
          {
            tenant_id: 'default',
            package_key: PackageKey.SALES,
            enabled: true,
            valid_until: null,
            limits: null,
          } as TenantEntitlement,
        ]),
      };

      const provider = new DbEntitlementProvider(mockRepo as any);
      const guard = new EntitlementGuard(reflector, provider);

      // Sales should pass
      expect(await guard.canActivate(createMockContext(PackageKey.SALES))).toBe(true);

      // Production should fail with 402
      try {
        await guard.canActivate(createMockContext(PackageKey.PRODUCTION));
        fail('Should have thrown HttpException 402');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(err.getResponse()).toEqual({
          statusCode: 402,
          code: 'PACKAGE_REQUIRED',
          package: 'PRODUCTION',
          message: 'Tính năng thuộc gói PRODUCTION chưa được kích hoạt',
        });
      }
    });

    it('DESIGN enabled but SALES disabled: handler DESIGN returns 402 due to dependency', async () => {
      const mockRepo = {
        find: jest.fn().mockResolvedValue([
          {
            tenant_id: 'default',
            package_key: PackageKey.DESIGN,
            enabled: true,
            valid_until: null,
            limits: null,
          } as TenantEntitlement,
          {
            tenant_id: 'default',
            package_key: PackageKey.SALES,
            enabled: false, // SALES disabled
            valid_until: null,
            limits: null,
          } as TenantEntitlement,
        ]),
      };

      const provider = new DbEntitlementProvider(mockRepo as any);
      const guard = new EntitlementGuard(reflector, provider);

      try {
        await guard.canActivate(createMockContext(PackageKey.DESIGN));
        fail('Should have thrown HttpException 402');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(err.getResponse()).toEqual({
          statusCode: 402,
          code: 'PACKAGE_REQUIRED',
          package: 'DESIGN',
          message: 'Tính năng thuộc gói DESIGN chưa được kích hoạt',
        });
      }
    });

    it('valid_until expired: returns 402', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const mockRepo = {
        find: jest.fn().mockResolvedValue([
          {
            tenant_id: 'default',
            package_key: PackageKey.SALES,
            enabled: true,
            valid_until: pastDate, // expired
            limits: null,
          } as TenantEntitlement,
        ]),
      };

      const provider = new DbEntitlementProvider(mockRepo as any);
      const guard = new EntitlementGuard(reflector, provider);

      try {
        await guard.canActivate(createMockContext(PackageKey.SALES));
        fail('Should have thrown HttpException 402');
      } catch (err: any) {
        expect(err).toBeInstanceOf(HttpException);
        expect(err.getStatus()).toBe(HttpStatus.PAYMENT_REQUIRED);
        expect(err.getResponse()).toEqual({
          statusCode: 402,
          code: 'PACKAGE_REQUIRED',
          package: 'SALES',
          message: 'Tính năng thuộc gói SALES chưa được kích hoạt',
        });
      }
    });
  });
});
