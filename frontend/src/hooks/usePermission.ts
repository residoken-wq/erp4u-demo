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

export const getPermissionFlags = (moduleCode: string): PermissionFlags => {
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
        const perm = permissions.find((p: any) => p.module_code === moduleCode);

        if (!perm) {
            return { canView: false, canCreate: false, canUpdate: false, canDelete: false, canViewCost: false };
        }

        return {
            canView: !!(perm.can_view === true || perm.can_view === 1),
            canCreate: !!(perm.can_create === true || perm.can_create === 1),
            canUpdate: !!(perm.can_update === true || perm.can_update === 1),
            canDelete: !!(perm.can_delete === true || perm.can_delete === 1),
            canViewCost: !!(perm.view_cost_price === true || perm.view_cost_price === 1),
        };
    } catch {
        return { canView: false, canCreate: false, canUpdate: false, canDelete: false, canViewCost: false };
    }
};

export const checkPermission = (moduleCode: string, action: string): boolean => {
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

function usePermission(moduleCode: string): PermissionFlags;
function usePermission(moduleCode: string, action: string): boolean;
function usePermission(moduleCode: string, action?: string): PermissionFlags | boolean {
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
