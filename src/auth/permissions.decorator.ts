import { SetMetadata } from '@nestjs/common';
import { PermAction } from './permission-catalog';

export const PERMISSION_KEY = 'required_permission';

/**
 * Decorator để yêu cầu quyền truy cập cụ thể cho một route (Legacy).
 * 
 * @param moduleCode - Mã module (VD: 'SALES', 'PRODUCT', 'INVENTORY')
 * @param action - Hành động yêu cầu: 'can_view' | 'can_create' | 'can_update' | 'can_delete'
 */
export const RequirePermission = (moduleCode: string, action: string) =>
    SetMetadata(PERMISSION_KEY, { moduleCode, action });

export const RBAC_KEY = 'rbac_rule';
export type RbacRule =
  | { tier: 'AUTH'; selfOr?: { module: string; action: PermAction } }
  | { tier: 'PERM'; any: { module: string; action: PermAction }[] };

export const AuthOnly = () => SetMetadata(RBAC_KEY, { tier: 'AUTH' } as RbacRule);
export const Perm = (module: string, action: PermAction) =>
  SetMetadata(RBAC_KEY, { tier: 'PERM', any: [{ module, action }] } as RbacRule);
export const AnyPerm = (...pairs: [string, PermAction][]) =>
  SetMetadata(RBAC_KEY, { tier: 'PERM', any: pairs.map(([module, action]) => ({ module, action })) } as RbacRule);
