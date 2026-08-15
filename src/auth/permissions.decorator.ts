import { SetMetadata } from '@nestjs/common';

export const PERMISSION_KEY = 'required_permission';

/**
 * Decorator để yêu cầu quyền truy cập cụ thể cho một route.
 * 
 * @param moduleCode - Mã module (VD: 'SALES', 'PRODUCT', 'INVENTORY')
 * @param action - Hành động yêu cầu: 'can_view' | 'can_create' | 'can_update' | 'can_delete'
 * 
 * @example
 * // Yêu cầu quyền tạo mới trong module SALES
 * @RequirePermission('SALES', 'can_create')
 * @Post()
 * createOrder(@Body() body: any) { ... }
 */
export const RequirePermission = (moduleCode: string, action: string) =>
    SetMetadata(PERMISSION_KEY, { moduleCode, action });
