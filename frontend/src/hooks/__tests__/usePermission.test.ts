import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';
import { getPermissionFlags, checkPermission } from '../usePermission.ts';

describe('usePermission Pure Helpers Unit Tests', () => {
    // Mock localStorage
    const mockStorage: Record<string, string> = {};
    (globalThis as any).localStorage = {
        getItem: (k: string) => mockStorage[k] || null,
        setItem: (k: string, v: string) => { mockStorage[k] = v; },
        removeItem: (k: string) => { delete mockStorage[k]; },
        clear: () => { for (const k in mockStorage) delete mockStorage[k]; }
    };

    beforeEach(() => {
        (globalThis as any).localStorage.clear();
    });

    test('no user in localStorage returns all false flags', () => {
        const flags = getPermissionFlags('SALES');
        assert.deepStrictEqual(flags, {
            canView: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
            canViewCost: false,
        });
        assert.strictEqual(checkPermission('SALES', 'view'), false);
        assert.strictEqual(checkPermission('SALES', 'create'), false);
    });

    test('admin user bypasses all permissions (all true)', () => {
        localStorage.setItem('user', JSON.stringify({
            username: 'admin',
            permissions: [],
        }));

        const flags = getPermissionFlags('ANY_MODULE');
        assert.deepStrictEqual(flags, {
            canView: true,
            canCreate: true,
            canUpdate: true,
            canDelete: true,
            canViewCost: true,
        });
        assert.strictEqual(checkPermission('ANY_MODULE', 'view'), true);
        assert.strictEqual(checkPermission('ANY_MODULE', 'delete'), true);
        assert.strictEqual(checkPermission('ANY_MODULE', 'view_cost_price'), true);
    });

    test('regular user with specific permissions returns exact flags', () => {
        localStorage.setItem('user', JSON.stringify({
            username: 'sales_rep',
            permissions: [
                {
                    module_code: 'SALES',
                    can_view: true,
                    can_create: true,
                    can_update: false,
                    can_delete: false,
                    view_cost_price: false,
                },
                {
                    module_code: 'FINANCE',
                    can_view: true,
                    can_create: false,
                    can_update: false,
                    can_delete: false,
                    view_cost_price: true,
                }
            ],
        }));

        const sales = getPermissionFlags('SALES');
        assert.strictEqual(sales.canView, true);
        assert.strictEqual(sales.canCreate, true);
        assert.strictEqual(sales.canUpdate, false);
        assert.strictEqual(sales.canDelete, false);
        assert.strictEqual(sales.canViewCost, false);

        assert.strictEqual(checkPermission('SALES', 'view'), true);
        assert.strictEqual(checkPermission('SALES', 'create'), true);
        assert.strictEqual(checkPermission('SALES', 'update'), false);
        assert.strictEqual(checkPermission('SALES', 'delete'), false);

        const finance = getPermissionFlags('FINANCE');
        assert.strictEqual(finance.canView, true);
        assert.strictEqual(finance.canCreate, false);
        assert.strictEqual(finance.canViewCost, true);
        assert.strictEqual(checkPermission('FINANCE', 'view_cost_price'), true);

        const hr = getPermissionFlags('HR');
        assert.strictEqual(hr.canView, false);
        assert.strictEqual(checkPermission('HR', 'view'), false);
    });
});
