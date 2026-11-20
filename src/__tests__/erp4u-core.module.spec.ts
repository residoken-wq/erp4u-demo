import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Erp4uCoreModule } from '../erp4u-core.module';
import {
  TENANT_RESOLVER,
  TenantResolver,
} from '../common/tenancy/tenant-resolver.interface';
import {
  TENANT_REGISTRY,
  TenantRegistry,
} from '../common/tenancy/tenant-registry.interface';
import { SingleTenantResolver } from '../common/tenancy/single-tenant.resolver';
import { SingleTenantRegistry } from '../common/tenancy/single-tenant.registry';
import { TenantContextMiddleware } from '../common/tenancy/tenant-context.middleware';
import {
  ENTITLEMENT_PROVIDER,
  EntitlementProvider,
} from '../common/packages/entitlement-provider.interface';
import { PackageKey } from '../common/packages/package.registry';
import {
  FILE_STORAGE,
  FileStorage,
} from '../common/storage/file-storage.interface';
import { LocalFileStorage } from '../common/storage/local-file-storage.service';
import { UploadService } from '../upload/upload.service';
import { MeEntitlementsController } from '../common/packages/me-entitlements.controller';
import { AiModule } from '../ai/ai.module';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { TikTokModule } from '../tiktok/tiktok.module';
import { SocialModule } from '../social/social.module';
import { ZnsModule } from '../zns/zns.module';
import { DesignsModule } from '../designs/designs.module';
import { WebsiteModule } from '../website/website.module';
import { AiService } from '../ai/ai.service';
import { DesignsService } from '../designs/designs.service';
import { ProductsService } from '../products/products.service';
import { HrService } from '../hr/hr.service';

export function createMockDataSourceFactory() {
  const dummyRepo = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    findByIds: jest.fn().mockResolvedValue([]),
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => x),
    count: jest.fn().mockResolvedValue(0),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    update: jest.fn().mockResolvedValue({ affected: 0 }),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getOne: jest.fn().mockResolvedValue(null),
    })),
  };

  const mockDataSource = {
    isInitialized: true,
    options: { type: 'postgres' },
    entityMetadatas: [],
    subscribers: [],
    getRepository: jest.fn(() => dummyRepo),
    getTreeRepository: jest.fn(() => dummyRepo),
    getMongoRepository: jest.fn(() => dummyRepo),
    getMetadata: jest.fn(() => ({
      tableName: 'mock_table',
      columns: [],
      relations: [],
    })),
    query: jest.fn().mockResolvedValue([]),
    createQueryRunner: jest.fn(() => ({
      connect: jest.fn(),
      release: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      query: jest.fn().mockResolvedValue([]),
      manager: {
        getRepository: jest.fn(() => dummyRepo),
      },
    })),
    destroy: jest.fn().mockResolvedValue(undefined),
  } as unknown as DataSource;

  return async () => mockDataSource;
}

const FAKE_PLUGIN_TOKEN = Symbol('FAKE_PLUGIN_TOKEN');

@Injectable()
class FakePluginService {
  constructor(
    @Inject(TENANT_RESOLVER) public readonly resolver: TenantResolver,
    @Inject(TENANT_REGISTRY) public readonly registry: TenantRegistry,
    @Inject(ENTITLEMENT_PROVIDER)
    public readonly entitlements: EntitlementProvider,
    @Inject(FILE_STORAGE) public readonly storage: FileStorage,
  ) {}
}

@Module({})
class FakePluginModule {
  static register(label: string): DynamicModule {
    return {
      module: FakePluginModule,
      providers: [
        { provide: FAKE_PLUGIN_TOKEN, useValue: label },
        FakePluginService,
      ],
      exports: [FAKE_PLUGIN_TOKEN, FakePluginService],
    };
  }
}

describe('Erp4uCoreModule.forRoot()', () => {
  jest.setTimeout(30_000);

  it('wires custom plugins and overrides TENANT_RESOLVER, TENANT_REGISTRY, ENTITLEMENT_PROVIDER, FILE_STORAGE', async () => {
    const fakeResolver: TenantResolver = {
      resolve: jest.fn(async () => ({
        tenantId: 'tenant_custom',
        schema: 'tenant_custom',
      })),
    };

    const fakeRegistry: TenantRegistry = {
      list: jest.fn(async () => [
        { tenantId: 'tenant_custom', schema: 'tenant_custom' },
      ]),
    };

    const fakeEntitlementProvider: EntitlementProvider = {
      isEnabled: jest.fn(async (pkg: PackageKey) => pkg === PackageKey.CORE),
      getLimits: jest.fn(async () => ({ max_users: 5 })),
      list: jest.fn(async () => [
        { key: PackageKey.CORE, enabled: true, limits: null, validUntil: null },
      ]),
    };

    const fakeFileStorage: FileStorage = {
      put: jest.fn(async (key) => ({
        key: `s3/${key}`,
        url: `https://cdn.example.com/${key}`,
      })),
      get: jest.fn(async () => null),
      delete: jest.fn(async () => true),
      url: jest.fn((key) => `https://cdn.example.com/${key}`),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        Erp4uCoreModule.forRoot({
          plugins: [FakePluginModule.register('cloud-plugin-v1')],
          tenantResolver: fakeResolver,
          tenantRegistry: fakeRegistry,
          entitlementProvider: fakeEntitlementProvider,
          fileStorage: fakeFileStorage,
          dataSourceFactory: createMockDataSourceFactory(),
        }),
      ],
    }).compile();

    // 1. Verify each DI token resolves to the fake implementation
    expect(moduleRef.get(TENANT_RESOLVER)).toBe(fakeResolver);
    expect(moduleRef.get(TENANT_REGISTRY)).toBe(fakeRegistry);
    expect(moduleRef.get(ENTITLEMENT_PROVIDER)).toBe(fakeEntitlementProvider);
    expect(moduleRef.get(FILE_STORAGE)).toBe(fakeFileStorage);

    // 2. Verify plugin module was loaded and receives all overridden core tokens
    expect(moduleRef.get(FAKE_PLUGIN_TOKEN)).toBe('cloud-plugin-v1');
    const pluginService = moduleRef.get(FakePluginService);
    expect(pluginService.resolver).toBe(fakeResolver);
    expect(pluginService.registry).toBe(fakeRegistry);
    expect(pluginService.entitlements).toBe(fakeEntitlementProvider);
    expect(pluginService.storage).toBe(fakeFileStorage);

    // 3. Verify core consumers receive the overridden providers too
    const middleware = moduleRef.get(TenantContextMiddleware);
    await new Promise<void>((resolve, reject) => {
      middleware.use({} as any, {} as any, (err?: any) => {
        if (err) return reject(err);
        resolve();
      });
    });
    expect(fakeResolver.resolve).toHaveBeenCalledTimes(1);

    const uploadService = moduleRef.get(UploadService) as any;
    expect(uploadService.fileStorage).toBe(fakeFileStorage);

    const meEntitlements = moduleRef.get(MeEntitlementsController) as any;
    expect(meEntitlements.entitlementProvider).toBe(fakeEntitlementProvider);

    await moduleRef.close();
  });

  it('uses default single-tenant providers when forRoot() is called without overrides', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        Erp4uCoreModule.forRoot({
          dataSourceFactory: createMockDataSourceFactory(),
        }),
      ],
    }).compile();

    expect(moduleRef.get(TENANT_RESOLVER)).toBeInstanceOf(SingleTenantResolver);
    expect(moduleRef.get(TENANT_REGISTRY)).toBeInstanceOf(SingleTenantRegistry);
    expect(moduleRef.get(FILE_STORAGE)).toBeInstanceOf(LocalFileStorage);

    await moduleRef.close();
  });

  it('compiles with includePremium: false and does not contain add-on modules', async () => {
    const dynamicModule = Erp4uCoreModule.forRoot({
      includePremium: false,
      dataSourceFactory: createMockDataSourceFactory(),
    });

    const premiumModuleTypes = [
      AiModule,
      ChatbotModule,
      TikTokModule,
      SocialModule,
      ZnsModule,
      DesignsModule,
      WebsiteModule,
    ];

    for (const mod of premiumModuleTypes) {
      expect(dynamicModule.imports).not.toContain(mod);
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [dynamicModule],
    }).compile();

    expect(moduleRef.get(ProductsService)).toBeDefined();
    expect(moduleRef.get(HrService)).toBeDefined();

    expect(() => moduleRef.get(AiService)).toThrow();
    expect(() => moduleRef.get(DesignsService)).toThrow();

    await moduleRef.close();
  });

  it('compiles with includePremium: true and contains all add-on modules', async () => {
    const dynamicModule = Erp4uCoreModule.forRoot({
      includePremium: true,
      dataSourceFactory: createMockDataSourceFactory(),
    });

    const premiumModuleTypes = [
      AiModule,
      ChatbotModule,
      TikTokModule,
      SocialModule,
      ZnsModule,
      DesignsModule,
      WebsiteModule,
    ];

    for (const mod of premiumModuleTypes) {
      expect(dynamicModule.imports).toContain(mod);
    }

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [dynamicModule],
    }).compile();

    expect(moduleRef.get(AiService)).toBeDefined();
    expect(moduleRef.get(DesignsService)).toBeDefined();

    await moduleRef.close();
  });
});
