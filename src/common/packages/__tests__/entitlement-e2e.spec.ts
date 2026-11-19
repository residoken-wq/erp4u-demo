import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import * as request from 'supertest';
import { ProductionController } from '../../../production/production.controller';
import { ProductionService } from '../../../production/production.service';
import { SalesController } from '../../../sales/sales.controller';
import { SalesService } from '../../../sales/sales.service';
import { MeEntitlementsController } from '../me-entitlements.controller';
import { EntitlementGuard } from '../entitlement.guard';
import { ENTITLEMENT_PROVIDER } from '../entitlement-provider.interface';
import { PackageKey } from '../package.registry';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/permissions.guard';

describe('Check 3: Entitlement E2E (Lightweight)', () => {
  let app: INestApplication;

  const mockEntitlementProvider = {
    isEnabled: jest.fn().mockImplementation(async (pkg: PackageKey) => {
      // Only CORE and SALES are enabled in this scenario
      return pkg === PackageKey.CORE || pkg === PackageKey.SALES;
    }),
    getLimits: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue([
      { key: PackageKey.CORE, enabled: true, validUntil: null, limits: null },
      { key: PackageKey.SALES, enabled: true, validUntil: null, limits: null },
      { key: PackageKey.PRODUCTION, enabled: false, validUntil: null, limits: null },
    ]),
  };

  const mockProductionService = {
    getAllOrders: jest.fn().mockReturnValue([{ id: 1, order_code: 'PO-001' }]),
  };

  const mockSalesService = {
    getAllPriceLists: jest.fn().mockReturnValue([{ id: 1, name: 'Bảng giá chuẩn' }]),
  };

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'ENTITLEMENTS_MODE') return 'db';
      return null;
    }),
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProductionController, SalesController, MeEntitlementsController],
      providers: [
        {
          provide: ProductionService,
          useValue: mockProductionService,
        },
        {
          provide: SalesService,
          useValue: mockSalesService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: ENTITLEMENT_PROVIDER,
          useValue: mockEntitlementProvider,
        },
        {
          provide: APP_GUARD,
          useClass: EntitlementGuard,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/production/orders returns 402 Payment Required with PACKAGE_REQUIRED code', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/production/orders')
      .expect(402);

    expect(res.body).toEqual({
      statusCode: 402,
      code: 'PACKAGE_REQUIRED',
      package: 'PRODUCTION',
      message: 'Tính năng thuộc gói PRODUCTION chưa được kích hoạt',
    });
  });

  it('GET /api/sales/price-lists succeeds (≠ 402)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/sales/price-lists')
      .expect(200);

    expect(res.status).not.toBe(402);
    expect(res.body).toEqual([{ id: 1, name: 'Bảng giá chuẩn' }]);
  });

  it('GET /api/me/entitlements returns mode and package list without limits', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/me/entitlements')
      .expect(200);

    expect(res.body).toHaveProperty('mode', 'db');
    expect(res.body).toHaveProperty('packages');
    expect(Array.isArray(res.body.packages)).toBe(true);

    for (const pkg of res.body.packages) {
      expect(pkg).toHaveProperty('key');
      expect(pkg).toHaveProperty('enabled');
      expect(pkg).toHaveProperty('validUntil');
      expect(pkg).not.toHaveProperty('limits'); // Must NOT leak limits in P6a
    }
  });
});
