import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as request from 'supertest';
import { EntitlementGuard } from '../entitlement.guard';
import { ENTITLEMENT_PROVIDER } from '../entitlement-provider.interface';
import { DbEntitlementProvider } from '../db-entitlement.provider';
import { TenantEntitlement } from '../tenant-entitlement.entity';
import { PackageKey } from '../package.registry';
import { PublicController } from '../../../public/public.controller';
import { WebsitePublicController } from '../../../website/website-public.controller';
import { BlogsController } from '../../../website/blogs.controller';
import { BlogsService } from '../../../website/blogs.service';
import { WebsiteProjectsController } from '../../../website/website-projects.controller';
import { WebsiteProjectsService } from '../../../website/website-projects.service';
import { Product } from '../../../products/product.entity';
import { Category } from '../../../categories/category.entity';
import { Customer } from '../../../customers/customer.entity';
import { SystemConfig } from '../../../system/system-config.entity';
import { BlogPost } from '../../../website/entities/blog-post.entity';
import { ProductWebsiteConfig } from '../../../website/entities/product-website-config.entity';
import { WebsitePolicy } from '../../../website/entities/website-policy.entity';
import { WizardConfig } from '../../../website/entities/wizard-config.entity';
import { WebProject } from '../../../website/entities/web-project.entity';
import { SalesService } from '../../../sales/sales.service';
import { SystemService } from '../../../system/system.service';
import { HrService } from '../../../hr/hr.service';
import { DesignsService } from '../../../designs/designs.service';
import { DemoModeService } from '../../services/demo-mode.service';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/permissions.guard';

describe('Website Package Entitlement E2E (P8a)', () => {
  let app: INestApplication;
  let dbProvider: DbEntitlementProvider;
  let entitlementRows: Partial<TenantEntitlement>[] = [];

  const mockEntitlementRepo = {
    find: jest.fn().mockImplementation(async () => entitlementRows),
  };

  const mockBlogQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([
      {
        id: 1,
        slug: 'bai-viet-demo-01',
        title: 'Bài viết Demo 01',
        excerpt: 'Mô tả mẫu',
        featured_image: null,
        category: 'Tin tức',
        published_at: new Date('2026-01-01T00:00:00Z'),
        view_count: 10,
      },
    ]),
  };

  const mockEmptyRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn().mockReturnValue(mockBlogQueryBuilder),
  };

  const mockSalesService = {
    getQuoteByUuid: jest.fn().mockResolvedValue(null),
    createOrder: jest.fn(),
  };

  const mockDesignsService = {
    getDesignOrderByUuid: jest.fn().mockResolvedValue(null),
  };

  const mockSystemService = {
    getCompanyConfig: jest.fn().mockResolvedValue({}),
    getHomeConfig: jest.fn().mockResolvedValue({}),
    getAboutConfig: jest.fn().mockResolvedValue({}),
  };

  const mockHrService = {
    findAllJobs: jest.fn().mockResolvedValue([]),
  };

  const mockDemoModeService = {
    isDemoMode: jest.fn().mockReturnValue(false),
  };

  const mockBlogsService = {
    findAll: jest.fn().mockResolvedValue([]),
    getCategories: jest.fn().mockResolvedValue([]),
  };

  const mockWebsiteProjectsService = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
  };

  beforeAll(async () => {
    process.env.ENTITLEMENTS_MODE = 'db';
    dbProvider = new DbEntitlementProvider(mockEntitlementRepo as any);

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [
        PublicController,
        WebsitePublicController,
        BlogsController,
        WebsiteProjectsController,
      ],
      providers: [
        { provide: getRepositoryToken(Product), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(ProductWebsiteConfig), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(Category), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(Customer), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(BlogPost), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(SystemConfig), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(WebsitePolicy), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(WizardConfig), useValue: mockEmptyRepo },
        { provide: getRepositoryToken(WebProject), useValue: mockEmptyRepo },
        { provide: SalesService, useValue: mockSalesService },
        { provide: SystemService, useValue: mockSystemService },
        { provide: HrService, useValue: mockHrService },
        { provide: DesignsService, useValue: mockDesignsService },
        { provide: DemoModeService, useValue: mockDemoModeService },
        { provide: BlogsService, useValue: mockBlogsService },
        { provide: WebsiteProjectsService, useValue: mockWebsiteProjectsService },
        { provide: ENTITLEMENT_PROVIDER, useValue: dbProvider },
        { provide: APP_GUARD, useClass: EntitlementGuard },
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

  beforeEach(() => {
    dbProvider.invalidate();
  });

  it('ENTITLEMENTS_MODE=db with CORE+SALES (WEBSITE disabled): /api/public/blogs=402, /api/public/portal/quote/:uuid!=402, /api/public/meta=200', async () => {
    entitlementRows = [
      {
        tenant_id: 'default',
        package_key: PackageKey.SALES,
        enabled: true,
        valid_until: null,
        limits: null,
      },
      {
        tenant_id: 'default',
        package_key: PackageKey.WEBSITE,
        enabled: false,
        valid_until: null,
        limits: null,
      },
    ];

    const blogsRes = await request(app.getHttpServer())
      .get('/api/public/blogs')
      .expect(402);

    expect(blogsRes.body).toEqual({
      statusCode: 402,
      code: 'PACKAGE_REQUIRED',
      package: 'WEBSITE',
      message: 'Tính năng thuộc gói WEBSITE chưa được kích hoạt',
    });

    const cmsBlogsRes = await request(app.getHttpServer())
      .get('/api/blogs')
      .expect(402);
    expect(cmsBlogsRes.body.package).toBe('WEBSITE');

    const projectsRes = await request(app.getHttpServer())
      .get('/api/website-projects')
      .expect(402);
    expect(projectsRes.body.package).toBe('WEBSITE');

    const quoteRes = await request(app.getHttpServer())
      .get('/api/public/portal/quote/00000000-0000-0000-0000-000000000001');
    expect(quoteRes.status).not.toBe(402);

    const metaRes = await request(app.getHttpServer())
      .get('/api/public/meta')
      .expect(200);
    expect(metaRes.body).toEqual({ demo: false, version: '1.0.0' });
  });

  it('ENTITLEMENTS_MODE=db with WEBSITE enabled but SALES disabled: /api/public/blogs=402 (WEBSITE => SALES dependency)', async () => {
    entitlementRows = [
      {
        tenant_id: 'default',
        package_key: PackageKey.WEBSITE,
        enabled: true,
        valid_until: null,
        limits: null,
      },
      {
        tenant_id: 'default',
        package_key: PackageKey.SALES,
        enabled: false,
        valid_until: null,
        limits: null,
      },
    ];

    const blogsRes = await request(app.getHttpServer())
      .get('/api/public/blogs')
      .expect(402);

    expect(blogsRes.body).toEqual({
      statusCode: 402,
      code: 'PACKAGE_REQUIRED',
      package: 'WEBSITE',
      message: 'Tính năng thuộc gói WEBSITE chưa được kích hoạt',
    });

    const metaRes = await request(app.getHttpServer())
      .get('/api/public/meta')
      .expect(200);
    expect(metaRes.body).toEqual({ demo: false, version: '1.0.0' });
  });

  it('ENTITLEMENTS_MODE=db with SALES+WEBSITE enabled: /api/public/blogs=200', async () => {
    entitlementRows = [
      {
        tenant_id: 'default',
        package_key: PackageKey.SALES,
        enabled: true,
        valid_until: null,
        limits: null,
      },
      {
        tenant_id: 'default',
        package_key: PackageKey.WEBSITE,
        enabled: true,
        valid_until: null,
        limits: null,
      },
    ];

    const blogsRes = await request(app.getHttpServer())
      .get('/api/public/blogs')
      .expect(200);

    expect(Array.isArray(blogsRes.body)).toBe(true);
    expect(blogsRes.body[0]).toMatchObject({
      slug: 'bai-viet-demo-01',
      title: 'Bài viết Demo 01',
    });
  });
});
