import { useMemo } from 'react';

/**
 * Hook phân quyền CRUD cho từng module.
 * 
 * @param moduleCode - Mã module (VD: 'SALES', 'PRODUCT', 'INVENTORY', 'FINANCE', 'PRODUCTION', 'HR', 'USERS')
 * @returns Object chứa các cờ quyền: canView, canCreate, canUpdate, canDelete, canViewCost
 * 
 * @example
 * const { canCreate, canDelete } = usePermission('SALES');
 * // Sử dụng:
 * {canCreate && <Button>Thêm mới</Button>}
 */
const usePermission = (moduleCode: string) => {
    return useMemo(() => {
        const userStr = localStorage.getItem('user');
        if (!userStr) {
            return { canView: false, canCreate: false, canUpdate: false, canDelete: false, canViewCost: false };
        }

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
    }, [moduleCode]);
};

export default usePermission;
