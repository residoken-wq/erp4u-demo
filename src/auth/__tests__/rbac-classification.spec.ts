import { generateRbacInventory } from '../rbac-inventory';
import { RBAC_UNCLASSIFIED_ALLOWLIST } from '../rbac-unclassified.allowlist';

describe('RBAC Route Classification CI Guard (SEC-3 / P12a)', () => {
  const routes = generateRbacInventory();

  it('every route in the application must be classified or explicitly allowlisted', () => {
    const unclassifiedRoutes = routes.filter((r) => r.tier === 'UNCLASSIFIED');
    const unexpectedUnclassified: string[] = [];

    for (const r of unclassifiedRoutes) {
      const allowed = RBAC_UNCLASSIFIED_ALLOWLIST.find(
        (a) => a.method === r.method && a.path === r.path,
      );
      if (!allowed) {
        unexpectedUnclassified.push(
          `[${r.method}] ${r.path} at ${r.file} (${r.controller}.${r.handler})`,
        );
      }
    }

    if (unexpectedUnclassified.length > 0) {
      fail(
        `Phát hiện ${unexpectedUnclassified.length} route MỚI chưa được phân loại phân quyền (@Perm, @AnyPerm, @AuthOnly, @Public):\n` +
          unexpectedUnclassified.join('\n') +
          `\n\nVui lòng khai báo phân quyền cho route hoặc ghi chú lý do vào src/auth/rbac-unclassified.allowlist.ts.`,
      );
    }
  });

  it('no dead entries in the allowlist (all allowlisted routes must exist and remain UNCLASSIFIED)', () => {
    for (const allowed of RBAC_UNCLASSIFIED_ALLOWLIST) {
      const found = routes.find(
        (r) => r.method === allowed.method && r.path === allowed.path,
      );
      expect(found).toBeDefined();
      expect(found?.tier).toBe('UNCLASSIFIED');
    }
  });

  it('all routes must have valid metadata attributes', () => {
    expect(routes.length).toBeGreaterThan(400);
    for (const r of routes) {
      expect(r.method).toMatch(/^(GET|POST|PUT|DELETE|PATCH|ALL|OPTIONS|HEAD)$/);
      expect(r.path.startsWith('/')).toBe(true);
      expect(r.file).toMatch(/\.controller\.ts:\d+$/);
      expect(r.package).toBeTruthy();
    }
  });
});
