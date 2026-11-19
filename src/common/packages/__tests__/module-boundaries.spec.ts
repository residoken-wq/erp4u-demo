import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as glob from 'glob';
import { PackageKey, PACKAGE_MODULES } from '../package.registry';

export interface BoundaryViolation {
  file: string;
  importSpecifier: string;
  resolvedTarget: string;
  sourcePackage: PackageKey;
  targetPackage: PackageKey;
}

export type BaselineMap = Record<string, string[]>;

/**
 * Exempted paths (allowed to import entities across packages):
 * - src/app.module.ts: registers all TypeORM entities globally in TypeOrmModule.forRootAsync
 * - src/database/seeds/**: deterministic seeders that populate entities across modules
 * - *.spec.ts: unit/integration test files
 */
export function isExemptFile(relPathFromSrc: string): boolean {
  const normalized = relPathFromSrc.split(path.sep).join('/');
  if (normalized.endsWith('.spec.ts')) return true;
  if (normalized === 'app.module.ts') return true;
  if (normalized.startsWith('database/seeds/')) return true;
  return false;
}

export function buildModuleToPackageMap(): Record<string, PackageKey> {
  const map: Record<string, PackageKey> = {};
  for (const [pkg, modules] of Object.entries(PACKAGE_MODULES)) {
    for (const mod of modules) {
      map[mod] = pkg as PackageKey;
    }
  }
  return map;
}

export function extractImportSpecifiers(fileName: string, sourceText: string): string[] {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require';
      if ((isDynamicImport || isRequire) && node.arguments.length > 0 && ts.isStringLiteral(node.arguments[0])) {
        specifiers.push(node.arguments[0].text);
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sf);
  return specifiers;
}

export function isEntityImportPath(resolvedPathFromSrc: string): boolean {
  return /\.entity(\.ts)?$/.test(resolvedPathFromSrc) || /(^|\/)entities(\/|$)/.test(resolvedPathFromSrc);
}

export function scanFileForBoundaryViolations(
  relPathFromSrc: string,
  sourceText: string,
  moduleToPackage: Record<string, PackageKey>,
): BoundaryViolation[] {
  const normalizedRel = relPathFromSrc.split(path.sep).join('/');
  if (isExemptFile(normalizedRel)) {
    return [];
  }

  const sourceModule = normalizedRel.split('/')[0];
  const sourcePackage = moduleToPackage[sourceModule];
  if (!sourcePackage) {
    return [];
  }

  const specifiers = extractImportSpecifiers(normalizedRel, sourceText);
  const seen = new Set<string>();
  const violations: BoundaryViolation[] = [];

  for (const spec of specifiers) {
    if (!spec.startsWith('.') && !spec.startsWith('src/')) {
      continue;
    }

    const resolved = spec.startsWith('src/')
      ? path.posix.normalize(spec.slice(4))
      : path.posix.normalize(path.posix.join(path.posix.dirname(normalizedRel), spec));

    if (!isEntityImportPath(resolved)) {
      continue;
    }

    const targetModule = resolved.split('/')[0];
    const targetPackage = moduleToPackage[targetModule];

    // Allow same-package entity imports and CORE entity imports (everyone can use Core entities)
    if (!targetPackage || targetPackage === PackageKey.CORE || targetPackage === sourcePackage) {
      continue;
    }

    if (seen.has(spec)) {
      continue;
    }
    seen.add(spec);

    violations.push({
      file: `src/${normalizedRel}`,
      importSpecifier: spec,
      resolvedTarget: `src/${resolved}`,
      sourcePackage,
      targetPackage,
    });
  }

  return violations;
}

export function evaluateAgainstBaseline(
  violations: BoundaryViolation[],
  baseline: BaselineMap,
): { newViolations: BoundaryViolation[]; staleEntries: Array<{ file: string; importSpecifier: string }> } {
  const baselineSets = new Map<string, Set<string>>();
  for (const [file, imports] of Object.entries(baseline)) {
    baselineSets.set(file, new Set(imports));
  }

  const foundKeys = new Set<string>();
  const newViolations: BoundaryViolation[] = [];

  for (const v of violations) {
    foundKeys.add(`${v.file}::${v.importSpecifier}`);
    const allowedForFile = baselineSets.get(v.file);
    if (!allowedForFile || !allowedForFile.has(v.importSpecifier)) {
      newViolations.push(v);
    }
  }

  const staleEntries: Array<{ file: string; importSpecifier: string }> = [];
  for (const [file, imports] of Object.entries(baseline)) {
    for (const imp of imports) {
      if (!foundKeys.has(`${file}::${imp}`)) {
        staleEntries.push({ file, importSpecifier: imp });
      }
    }
  }

  return { newViolations, staleEntries };
}

export function formatViolationError(newViolations: BoundaryViolation[]): string {
  const lines = newViolations.map(
    (v) =>
      `  - ${v.file} (${v.sourcePackage}) imports "${v.importSpecifier}" (${v.targetPackage} entity)`,
  );
  return (
    `Phát hiện ${newViolations.length} vi phạm ranh giới module mới ngoài baseline:\n` +
    lines.join('\n') +
    `\n\nHướng dẫn: Không import trực tiếp *.entity hoặc /entities/ từ gói khác — hãy gọi qua service export trong *.module.ts.`
  );
}

describe('Module Boundaries Guard (P6b)', () => {
  const srcDir = path.resolve(__dirname, '../../..');
  const baselinePath = path.resolve(__dirname, '../module-boundaries.baseline.json');
  const moduleToPackage = buildModuleToPackageMap();

  it('enforces module boundaries across src/**/*.ts against baseline (no new cross-package entity imports)', () => {
    const baseline: BaselineMap = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const tsFiles = glob.sync('**/*.ts', { cwd: srcDir }).map((f) => f.split(path.sep).join('/')).sort();

    expect(tsFiles.length).toBeGreaterThan(50);

    const allViolations: BoundaryViolation[] = [];
    for (const relPath of tsFiles) {
      if (isExemptFile(relPath)) continue;
      const fullPath = path.join(srcDir, relPath);
      const content = fs.readFileSync(fullPath, 'utf8');
      allViolations.push(...scanFileForBoundaryViolations(relPath, content, moduleToPackage));
    }

    const { newViolations, staleEntries } = evaluateAgainstBaseline(allViolations, baseline);

    if (staleEntries.length > 0) {
      console.warn(
        `[Module Boundaries] Có ${staleEntries.length} dòng trong baseline đã hết vi phạm — hãy xoá khỏi src/common/packages/module-boundaries.baseline.json:\n` +
          staleEntries.map((s) => `  - ${s.file}: "${s.importSpecifier}"`).join('\n'),
      );
    }

    if (newViolations.length > 0) {
      throw new Error(formatViolationError(newViolations));
    }

    expect(newViolations).toEqual([]);
  });

  describe('Fixture verification (synthetic files, no real files created in src/)', () => {
    it('detects intentional violation: production module importing sales entity', () => {
      const fakeSource = `
        import { Injectable } from '@nestjs/common';
        import { SalesOrder } from '../sales/sales-order.entity';

        @Injectable()
        export class FakeProductionService {
          order?: SalesOrder;
        }
      `;

      const violations = scanFileForBoundaryViolations(
        'production/fake-production.service.ts',
        fakeSource,
        moduleToPackage,
      );

      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        file: 'src/production/fake-production.service.ts',
        importSpecifier: '../sales/sales-order.entity',
        sourcePackage: PackageKey.PRODUCTION,
        targetPackage: PackageKey.SALES,
      });

      const { newViolations } = evaluateAgainstBaseline(violations, {});
      expect(newViolations).toHaveLength(1);
      expect(formatViolationError(newViolations)).toContain('gọi qua service export trong *.module.ts');
    });

    it('allows importing CORE entities from any package', () => {
      const fakeSource = `
        import { Product } from '../products/product.entity';
        import { User } from '../users/entities/user.entity';
      `;

      const violations = scanFileForBoundaryViolations(
        'production/fake-core-consumer.service.ts',
        fakeSource,
        moduleToPackage,
      );

      expect(violations).toEqual([]);
    });

    it('allows importing entities within the same package (e.g. production -> bom)', () => {
      const fakeSource = `
        import { BOM } from '../bom/bom.entity';
      `;

      const violations = scanFileForBoundaryViolations(
        'production/fake-same-pkg.service.ts',
        fakeSource,
        moduleToPackage,
      );

      expect(violations).toEqual([]);
    });

    it('exempts app.module.ts, database/seeds/**, and *.spec.ts', () => {
      const fakeSource = `import { SalesOrder } from '../sales/sales-order.entity';`;

      expect(scanFileForBoundaryViolations('app.module.ts', fakeSource, moduleToPackage)).toEqual([]);
      expect(scanFileForBoundaryViolations('database/seeds/sales-orders.seed.ts', fakeSource, moduleToPackage)).toEqual([]);
      expect(scanFileForBoundaryViolations('production/production.service.spec.ts', fakeSource, moduleToPackage)).toEqual([]);
    });

    it('reports stale baseline entries without failing evaluation', () => {
      const { newViolations, staleEntries } = evaluateAgainstBaseline([], {
        'src/production/resolved.service.ts': ['../sales/sales-order.entity'],
      });

      expect(newViolations).toEqual([]);
      expect(staleEntries).toEqual([
        {
          file: 'src/production/resolved.service.ts',
          importSpecifier: '../sales/sales-order.entity',
        },
      ]);
    });
  });
});
