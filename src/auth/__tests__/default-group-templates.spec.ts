import { DEFAULT_GROUP_TEMPLATES } from '../default-group-templates';
import { PERMISSION_MODULES } from '../permission-catalog';

describe('Default Group Templates Unit Tests (P12b2 D3)', () => {
  const catalogModuleCodes = new Set(PERMISSION_MODULES.map((m) => m.code));

  it('defines exactly the 7 required default groups', () => {
    const names = DEFAULT_GROUP_TEMPLATES.map((g) => g.name);
    expect(names).toEqual([
      'Quản trị',
      'Kinh doanh',
      'Kho',
      'Mua hàng',
      'Sản xuất',
      'Kế toán',
      'Nhân sự',
    ]);
  });

  it('every template only uses module codes that exist in the permission catalog', () => {
    for (const group of DEFAULT_GROUP_TEMPLATES) {
      for (const perm of group.permissions) {
        expect(catalogModuleCodes.has(perm.module_code)).toBe(true);
      }
    }
  });

  it('ONLY "Quản trị" has USERS or SYSTEM module permissions', () => {
    for (const group of DEFAULT_GROUP_TEMPLATES) {
      const hasUsers = group.permissions.some((p) => p.module_code === 'USERS');
      const hasSystem = group.permissions.some((p) => p.module_code === 'SYSTEM');

      if (group.name === 'Quản trị') {
        expect(hasUsers).toBe(true);
        expect(hasSystem).toBe(true);
      } else {
        expect(hasUsers).toBe(false);
        expect(hasSystem).toBe(false);
      }
    }
  });

  it('all 7 groups have DASHBOARD:view = true', () => {
    for (const group of DEFAULT_GROUP_TEMPLATES) {
      const dashboardPerm = group.permissions.find((p) => p.module_code === 'DASHBOARD');
      expect(dashboardPerm).toBeDefined();
      expect(dashboardPerm?.can_view).toBe(true);
    }
  });

  it('Kinh doanh has SALES + PROJECTS (minimum privilege for sales)', () => {
    const group = DEFAULT_GROUP_TEMPLATES.find((g) => g.name === 'Kinh doanh')!;
    const sales = group.permissions.find((p) => p.module_code === 'SALES');
    const projects = group.permissions.find((p) => p.module_code === 'PROJECTS');

    expect(sales?.can_view).toBe(true);
    expect(sales?.can_create).toBe(true);
    expect(projects?.can_view).toBe(true);
    expect(projects?.can_create).toBe(true);

    // No inventory or finance or hr
    expect(group.permissions.some((p) => p.module_code === 'INVENTORY')).toBe(false);
    expect(group.permissions.some((p) => p.module_code === 'FINANCE')).toBe(false);
    expect(group.permissions.some((p) => p.module_code === 'HR')).toBe(false);
  });

  it('Kho has INVENTORY', () => {
    const group = DEFAULT_GROUP_TEMPLATES.find((g) => g.name === 'Kho')!;
    const inv = group.permissions.find((p) => p.module_code === 'INVENTORY');
    expect(inv?.can_view).toBe(true);
    expect(inv?.can_create).toBe(true);

    expect(group.permissions.some((p) => p.module_code === 'SALES')).toBe(false);
    expect(group.permissions.some((p) => p.module_code === 'FINANCE')).toBe(false);
  });

  it('Mua hàng has PURCHASE and PRODUCT (view only)', () => {
    const group = DEFAULT_GROUP_TEMPLATES.find((g) => g.name === 'Mua hàng')!;
    const po = group.permissions.find((p) => p.module_code === 'PURCHASE');
    const prod = group.permissions.find((p) => p.module_code === 'PRODUCT');

    expect(po?.can_view).toBe(true);
    expect(po?.can_create).toBe(true);

    expect(prod?.can_view).toBe(true);
    expect(prod?.can_create).toBe(false);
    expect(prod?.can_update).toBe(false);
    expect(prod?.can_delete).toBe(false);
  });

  it('Sản xuất has PRODUCTION and PRODUCT/INVENTORY (view only)', () => {
    const group = DEFAULT_GROUP_TEMPLATES.find((g) => g.name === 'Sản xuất')!;
    const prod = group.permissions.find((p) => p.module_code === 'PRODUCTION');
    const product = group.permissions.find((p) => p.module_code === 'PRODUCT');
    const inv = group.permissions.find((p) => p.module_code === 'INVENTORY');

    expect(prod?.can_view).toBe(true);
    expect(prod?.can_create).toBe(true);

    expect(product?.can_view).toBe(true);
    expect(product?.can_create).toBe(false);
    expect(inv?.can_view).toBe(true);
    expect(inv?.can_create).toBe(false);
  });

  it('Kế toán has FINANCE and SALES/PURCHASE (view only, view_cost_price = true)', () => {
    const group = DEFAULT_GROUP_TEMPLATES.find((g) => g.name === 'Kế toán')!;
    const fin = group.permissions.find((p) => p.module_code === 'FINANCE');
    const sales = group.permissions.find((p) => p.module_code === 'SALES');
    const po = group.permissions.find((p) => p.module_code === 'PURCHASE');

    expect(fin?.can_view).toBe(true);
    expect(fin?.can_create).toBe(true);
    expect(fin?.view_cost_price).toBe(true);

    expect(sales?.can_view).toBe(true);
    expect(sales?.can_create).toBe(false);
    expect(po?.can_view).toBe(true);
    expect(po?.can_create).toBe(false);
  });

  it('Nhân sự has HR', () => {
    const group = DEFAULT_GROUP_TEMPLATES.find((g) => g.name === 'Nhân sự')!;
    const hr = group.permissions.find((p) => p.module_code === 'HR');
    expect(hr?.can_view).toBe(true);
    expect(hr?.can_create).toBe(true);
    expect(group.permissions.some((p) => p.module_code === 'SALES')).toBe(false);
  });

  it('Quản trị has all modules with full CRUD and view_cost_price', () => {
    const group = DEFAULT_GROUP_TEMPLATES.find((g) => g.name === 'Quản trị')!;
    expect(group.permissions.length).toBe(PERMISSION_MODULES.length);
    for (const p of group.permissions) {
      expect(p.can_view).toBe(true);
      expect(p.can_create).toBe(true);
      expect(p.can_update).toBe(true);
      expect(p.can_delete).toBe(true);
      expect(p.view_cost_price).toBe(true);
    }
  });
});
