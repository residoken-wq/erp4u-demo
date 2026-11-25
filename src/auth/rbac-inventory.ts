import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { RBAC_KEY, PERMISSION_KEY, RbacRule } from './permissions.decorator';
import { REQUIRES_PACKAGE_KEY } from '../common/packages/requires-package.decorator';

export type RbacTier =
  | 'PUBLIC'
  | 'APIKEY'
  | 'AUTH'
  | 'PERM'
  | 'LEGACY'
  | 'UNCLASSIFIED';

export interface RbacRouteInventoryItem {
  method: string;
  path: string;
  tier: RbacTier;
  moduleAction: string;
  package: string;
  file: string;
  controller: string;
  handler: string;
}

const HTTP_METHODS: Record<number, string> = {
  0: 'GET',
  1: 'POST',
  2: 'PUT',
  3: 'DELETE',
  4: 'PATCH',
  5: 'ALL',
  6: 'OPTIONS',
  7: 'HEAD',
};

function normalizePath(ctrlPath: string, methodPath: string): string {
  let c = ctrlPath || '';
  let m = methodPath || '';
  if (!c.startsWith('/')) c = '/' + c;
  if (!m.startsWith('/') && m !== '') m = '/' + m;
  let full = `${c}${m}`.replace(/\/+/g, '/');
  if (full.length > 1 && full.endsWith('/')) {
    full = full.slice(0, -1);
  }
  return full || '/';
}

function findControllerFiles(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        findControllerFiles(fullPath, fileList);
      }
    } else if (file.endsWith('.controller.ts') && !file.endsWith('.spec.ts') && !file.endsWith('.int-spec.ts')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function getMethodLineMap(filePath: string, className: string): Map<string, number> {
  const map = new Map<string, number>();
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);

    function visit(node: ts.Node) {
      if (ts.isClassDeclaration(node) && node.name?.text === className) {
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && member.name && ts.isIdentifier(member.name)) {
            const methodName = member.name.text;
            const { line } = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile));
            map.set(methodName, line + 1);
          }
        }
      }
      ts.forEachChild(node, visit);
    }

    visit(sourceFile);
  } catch (err) {
    // Fallback if AST parsing encounters issue
  }
  return map;
}

export function generateRbacInventory(options?: {
  srcDir?: string;
  controllers?: any[];
}): RbacRouteInventoryItem[] {
  const routes: RbacRouteInventoryItem[] = [];
  const srcDir = options?.srcDir || path.resolve(process.cwd(), 'src');

  let controllerEntries: Array<{ ControllerClass: any; filePath: string }> = [];

  if (options?.controllers && options.controllers.length > 0) {
    for (const ctrl of options.controllers) {
      controllerEntries.push({ ControllerClass: ctrl, filePath: '' });
    }
  } else {
    const controllerFiles = findControllerFiles(srcDir);
    for (const filePath of controllerFiles) {
      try {
        const mod = require(path.resolve(filePath));
        for (const key of Object.keys(mod)) {
          const exportItem = mod[key];
          if (
            typeof exportItem === 'function' &&
            (Reflect.getMetadata('path', exportItem) !== undefined ||
              Reflect.getMetadata('__controller__', exportItem) !== undefined)
          ) {
            controllerEntries.push({ ControllerClass: exportItem, filePath });
          }
        }
      } catch (err: any) {
        console.warn(`[rbac:inventory] Could not load ${filePath}:`, err.message);
      }
    }
  }

  for (const { ControllerClass, filePath } of controllerEntries) {
    const className = ControllerClass.name || 'AnonymousController';
    const rawCtrlPaths = Reflect.getMetadata('path', ControllerClass);
    const ctrlPaths: string[] = Array.isArray(rawCtrlPaths)
      ? rawCtrlPaths
      : rawCtrlPaths !== undefined
      ? [rawCtrlPaths]
      : [''];

    const ctrlIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ControllerClass) === true;
    const ctrlGuards: any[] = Reflect.getMetadata('__guards__', ControllerClass) || [];
    const ctrlHasApiKey = ctrlGuards.some(
      (g) => g === ApiKeyGuard || g?.name === 'ApiKeyGuard' || (typeof g === 'function' && g.name === 'ApiKeyGuard'),
    );
    const ctrlRbacRule: RbacRule | undefined = Reflect.getMetadata(RBAC_KEY, ControllerClass);
    const ctrlLegacy = Reflect.getMetadata(PERMISSION_KEY, ControllerClass);
    const ctrlPackage = Reflect.getMetadata(REQUIRES_PACKAGE_KEY, ControllerClass);

    const lineMap = filePath ? getMethodLineMap(filePath, className) : new Map<string, number>();
    const relFile = filePath ? path.relative(process.cwd(), filePath).replace(/\\/g, '/') : 'unknown';

    const proto = ControllerClass.prototype;
    if (!proto) continue;

    const propertyNames = Object.getOwnPropertyNames(proto);
    for (const prop of propertyNames) {
      if (prop === 'constructor') continue;

      const descriptor = Object.getOwnPropertyDescriptor(proto, prop);
      if (!descriptor || typeof descriptor.value !== 'function') continue;

      const targetMethod = proto[prop];
      const methodVerbNum = Reflect.getMetadata('method', targetMethod);
      if (methodVerbNum === undefined) continue;

      const methodVerb = HTTP_METHODS[methodVerbNum] || 'UNKNOWN';
      const rawMethodPath = Reflect.getMetadata('path', targetMethod);
      const methodPaths: string[] = Array.isArray(rawMethodPath)
        ? rawMethodPath
        : rawMethodPath !== undefined
        ? [rawMethodPath]
        : [''];

      const methodIsPublic = Reflect.getMetadata(IS_PUBLIC_KEY, targetMethod) === true;
      const methodGuards: any[] = Reflect.getMetadata('__guards__', targetMethod) || [];
      const methodHasApiKey = methodGuards.some(
        (g) => g === ApiKeyGuard || g?.name === 'ApiKeyGuard' || (typeof g === 'function' && g.name === 'ApiKeyGuard'),
      );
      const methodRbacRule: RbacRule | undefined = Reflect.getMetadata(RBAC_KEY, targetMethod);
      const methodLegacy = Reflect.getMetadata(PERMISSION_KEY, targetMethod);
      const methodPackage = Reflect.getMetadata(REQUIRES_PACKAGE_KEY, targetMethod);

      // Package resolution
      const resolvedPackage = methodPackage || ctrlPackage || 'core';
      const line = lineMap.get(prop) || 1;
      const filePos = `${relFile}:${line}`;

      // Route paths combination
      for (const cPath of ctrlPaths) {
        for (const mPath of methodPaths) {
          const fullPath = normalizePath(cPath, mPath);

          // Tier resolution
          let tier: RbacTier = 'UNCLASSIFIED';
          let moduleAction = '-';

          if (methodIsPublic || ctrlIsPublic) {
            tier = 'PUBLIC';
            moduleAction = '-';
          } else if (methodHasApiKey || ctrlHasApiKey) {
            tier = 'APIKEY';
            moduleAction = '-';
          } else {
            const rule = methodRbacRule || ctrlRbacRule;
            const legacy = methodLegacy || ctrlLegacy;

            if (rule) {
              if (rule.tier === 'PERM') {
                tier = 'PERM';
                moduleAction = rule.any.map((p) => `${p.module}:${p.action}`).join(' | ');
              } else if (rule.tier === 'AUTH') {
                tier = 'AUTH';
                moduleAction = rule.selfOr ? `selfOr(${rule.selfOr.module}:${rule.selfOr.action})` : 'AUTH';
              }
            } else if (legacy) {
              tier = 'LEGACY';
              const action = legacy.action?.replace('can_', '') || legacy.action;
              moduleAction = `${legacy.moduleCode}:${action}`;
            } else {
              tier = 'UNCLASSIFIED';
              moduleAction = '-';
            }
          }

          routes.push({
            method: methodVerb,
            path: fullPath,
            tier,
            moduleAction,
            package: resolvedPackage,
            file: filePos,
            controller: className,
            handler: prop,
          });
        }
      }
    }
  }

  // Sort routes by path, then method
  routes.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    return a.method.localeCompare(b.method);
  });

  return routes;
}

export function formatInventoryMarkdown(routes: RbacRouteInventoryItem[]): string {
  const counts: Record<RbacTier, number> = {
    PUBLIC: 0,
    APIKEY: 0,
    AUTH: 0,
    PERM: 0,
    LEGACY: 0,
    UNCLASSIFIED: 0,
  };

  for (const r of routes) {
    counts[r.tier] = (counts[r.tier] || 0) + 1;
  }

  const lines: string[] = [];
  lines.push('# Bảng Kiểm Kê Phân Quyền Route (RBAC Route Inventory)');
  lines.push('');
  lines.push(`> Tự động tạo bởi \`npm run rbac:inventory\` vào lúc ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Tổng quan theo tầng');
  lines.push('');
  lines.push(`- **Tổng số route**: ${routes.length}`);
  lines.push(`- **PERM** (Phân quyền chi tiết): ${counts.PERM}`);
  lines.push(`- **AUTH** (Chỉ cần đăng nhập): ${counts.AUTH}`);
  lines.push(`- **PUBLIC** (Công khai): ${counts.PUBLIC}`);
  lines.push(`- **APIKEY** (Xác thực qua API Key): ${counts.APIKEY}`);
  lines.push(`- **LEGACY** (Decorator cũ @RequirePermission): ${counts.LEGACY}`);
  lines.push(`- **UNCLASSIFIED** (Chưa phân loại): ${counts.UNCLASSIFIED}`);
  lines.push('');
  lines.push('## Danh sách chi tiết các Route');
  lines.push('');
  lines.push('| Phương thức | Đường dẫn (Path) | Tầng | Module/Action | Gói | File:Dòng |');
  lines.push('|---|---|---|---|---|---|');

  for (const r of routes) {
    lines.push(`| \`${r.method}\` | \`${r.path}\` | \`${r.tier}\` | ${r.moduleAction} | \`${r.package}\` | [${r.file}](../${r.file}) |`);
  }

  lines.push('');
  return lines.join('\n');
}
