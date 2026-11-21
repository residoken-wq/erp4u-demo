import * as glob from 'glob';
import * as path from 'path';
import { ModulesContainer } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { REQUIRES_PACKAGE_KEY } from '../requires-package.decorator';
import { PackageKey } from '../package.registry';
import { Erp4uCoreModule } from '../../../erp4u-core.module';
import { createMockDataSourceFactory } from '../../../__tests__/erp4u-core.module.spec';

describe('Check 1: Controller Entitlement Coverage Spec', () => {
  const srcDir = path.resolve(__dirname, '../../..');
  const controllerFiles = glob
    .sync('**/*.controller.ts', { cwd: srcDir })
    .filter((f) => !f.endsWith('.spec.ts'));

  const CORE_WHITELIST_HANDLERS: Record<string, string[]> = {
    PublicController: ['getMeta', 'proxyImage'],
  };

  it('found controller files to verify', () => {
    expect(controllerFiles.length).toBeGreaterThan(30);
  });

  for (const relPath of controllerFiles) {
    const fullPath = path.join(srcDir, relPath);

    it(`verifies package entitlement annotation on: ${relPath}`, async () => {
      try {
        // Dynamic import controller
        const mod = await import(fullPath);

        // Find exported classes in the module
        const controllerClasses = Object.values(mod).filter(
          (exp: any) =>
            typeof exp === 'function' &&
            (Reflect.getMetadata('path', exp) !== undefined ||
              exp.name.endsWith('Controller')),
        );

        expect(controllerClasses.length).toBeGreaterThanOrEqual(1);

        for (const ctrlClass of controllerClasses as any[]) {
          const className = ctrlClass.name;

          if (className === 'PublicController' || className === 'PortalController') {
            // Check handler-level metadata
            const proto = ctrlClass.prototype;
            const propNames = Object.getOwnPropertyNames(proto).filter(
              (prop) => prop !== 'constructor' && typeof proto[prop] === 'function',
            );

            const whitelisted = CORE_WHITELIST_HANDLERS[className] || [];

            for (const method of propNames) {
              const hasPath = Reflect.getMetadata('path', proto[method]) !== undefined;
              if (!hasPath) {
                continue; // internal helper, not a route handler
              }

              const pkg = Reflect.getMetadata(REQUIRES_PACKAGE_KEY, proto[method]);
              const isWhitelisted = whitelisted.includes(method);

              if (!pkg && !isWhitelisted) {
                throw new Error(
                  `Handler "${method}" in ${className} (${relPath}) is missing @RequiresPackage and is not whitelisted for CORE.`,
                );
              }

              if (pkg) {
                expect(Object.values(PackageKey)).toContain(pkg);
              }
            }
          } else {
            // Check class-level metadata
            const pkg = Reflect.getMetadata(REQUIRES_PACKAGE_KEY, ctrlClass);
            if (!pkg) {
              throw new Error(
                `Controller class ${className} in ${relPath} is missing @RequiresPackage or @CorePackage metadata.`,
              );
            }
            expect(Object.values(PackageKey)).toContain(pkg);
          }
        }
      } catch (err: any) {
        console.error(`ERROR in ${relPath}:`, err);
        throw err;
      }
    });
  }
});

describe('Check 2: Controller coverage when includePremium: false', () => {
  const PREMIUM_CONTROLLERS = [
    'AiController',
    'ChatbotAdminConfigController',
    'ChatbotFlowController',
    'ChatbotInboxController',
    'ChatbotKbController',
    'PublicChatController',
    'TikTokAuthController',
    'TikTokCommentController',
    'TikTokInboxController',
    'TikTokWebhookController',
    'SocialController',
    'ZnsController',
    'DesignsController',
    'BlogsController',
    'WebsiteProjectsController',
    'WebsitePublicController',
  ];

  it('registers 0 add-on controllers when includePremium: false while retaining core controllers', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        Erp4uCoreModule.forRoot({
          includePremium: false,
          dataSourceFactory: createMockDataSourceFactory(),
        }),
      ],
    }).compile();

    const modulesContainer = moduleRef.get(ModulesContainer);
    const registeredControllerNames = new Set<string>();

    for (const moduleInstance of modulesContainer.values()) {
      for (const controllerWrapper of moduleInstance.controllers.values()) {
        if (controllerWrapper.metatype) {
          registeredControllerNames.add(controllerWrapper.metatype.name);
        }
      }
    }

    // Verify none of the add-on controllers are registered
    for (const premiumCtrl of PREMIUM_CONTROLLERS) {
      expect(registeredControllerNames.has(premiumCtrl)).toBe(false);
    }

    // Verify core controllers are still registered
    expect(registeredControllerNames.has('AppController')).toBe(true);
    expect(registeredControllerNames.has('SalesController')).toBe(true);
    expect(registeredControllerNames.has('ProductsController')).toBe(true);
    expect(registeredControllerNames.has('HrController')).toBe(true);
    expect(registeredControllerNames.has('PublicController')).toBe(true);
    expect(registeredControllerNames.has('PortalController')).toBe(true);

    await moduleRef.close();
  });
});
