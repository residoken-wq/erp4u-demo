import * as glob from 'glob';
import * as path from 'path';
import { REQUIRES_PACKAGE_KEY } from '../requires-package.decorator';
import { PackageKey } from '../package.registry';

describe('Check 1: Controller Entitlement Coverage Spec', () => {
  const srcDir = path.resolve(__dirname, '../../..');
  const controllerFiles = glob
    .sync('**/*.controller.ts', { cwd: srcDir })
    .filter((f) => !f.endsWith('.spec.ts'));

  const CORE_WHITELIST_HANDLERS: Record<string, string[]> = {
    PublicController: ['getMeta', 'proxyImage'],
  };

  it('found controller files to verify', () => {
    expect(controllerFiles.length).toBeGreaterThan(40);
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
