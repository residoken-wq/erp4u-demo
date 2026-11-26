import { useState, useEffect } from 'react';

/**
 * Hook phân quyền CRUD cho từng module.
 * 
 * @param moduleCode - Mã module (VD: 'SALES', 'PRODUCT', 'INVENTORY', 'FINANCE', 'PRODUCTION', 'HR', 'USERS')
 * @param action - Tuỳ chọn: 'view' | 'create' | 'update' | 'delete' | 'view_cost_price'
 * @returns Object chứa các cờ quyền nếu không truyền action, hoặc boolean nếu có action.
 * 
 * @example
 * const { canCreate, canDelete } = usePermission('SALES');
 * // hoặc:
 * const canCreate = usePermission('SALES', 'create');
 */
export interface PermissionFlags {
    canView: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewCost: boolean;
}

export const getPermissionFlags = (moduleCode: string | string[]): PermissionFlags => {
    const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (!userStr) {
        return { canView: false, canCreate: false, canUpdate: false, canDelete: false, canViewCost: false };
    }

    try {
        const user = JSON.parse(userStr);

        // Admin bypass tất cả
        if (user.username === 'admin') {
            return { canView: true, canCreate: true, canUpdate: true, canDelete: true, canViewCost: true };
        }

        const permissions = user.permissions || [];
        const modules = Array.isArray(moduleCode) ? moduleCode : [moduleCode];
        const matchingPerms = permissions.filter((p: any) => modules.includes(p.module_code));

        if (matchingPerms.length === 0) {
            return { canView: false, canCreate: false, canUpdate: false, canDelete: false, canViewCost: false };
        }

        return {
            canView: matchingPerms.some((p: any) => p.can_view === true || p.can_view === 1),
            canCreate: matchingPerms.some((p: any) => p.can_create === true || p.can_create === 1),
            canUpdate: matchingPerms.some((p: any) => p.can_update === true || p.can_update === 1),
            canDelete: matchingPerms.some((p: any) => p.can_delete === true || p.can_delete === 1),
            canViewCost: matchingPerms.some((p: any) => p.view_cost_price === true || p.view_cost_price === 1),
        };
    } catch {
        return { canView: false, canCreate: false, canUpdate: false, canDelete: false, canViewCost: false };
    }
};

export const checkPermission = (moduleCode: string | string[], action: string): boolean => {
    const flags = getPermissionFlags(moduleCode);
    switch (action) {
        case 'view':
        case 'canView':
            return flags.canView;
        case 'create':
        case 'canCreate':
            return flags.canCreate;
        case 'update':
        case 'canUpdate':
            return flags.canUpdate;
        case 'delete':
        case 'canDelete':
            return flags.canDelete;
        case 'view_cost_price':
        case 'viewCost':
        case 'canViewCost':
            return flags.canViewCost;
        default:
            return false;
    }
};

function usePermission(moduleCode: string | string[]): PermissionFlags;
function usePermission(moduleCode: string | string[], action: string): boolean;
function usePermission(moduleCode: string | string[], action?: string): PermissionFlags | boolean {
    const [perms, setPerms] = useState<PermissionFlags>(() => getPermissionFlags(moduleCode));

    useEffect(() => {
        const update = () => {
            setPerms(getPermissionFlags(moduleCode));
        };

        update();

        if (typeof window !== 'undefined') {
            window.addEventListener('erp4u:auth-updated', update);
            window.addEventListener('storage', update);

            return () => {
                window.removeEventListener('erp4u:auth-updated', update);
                window.removeEventListener('storage', update);
            };
        }
    }, [moduleCode]);

    if (action) {
        return checkPermission(moduleCode, action);
    }
    return perms;
}

export { usePermission };
export default usePermission;
