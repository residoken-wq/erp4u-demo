import { ForbiddenException } from '@nestjs/common';
import { PermissionCacheService } from './permission-cache.service';
import { PermAction } from './permission-catalog';

export function assertAdmin(
  user: any,
  message: string = 'Chỉ admin mới có quyền truy cập',
): void {
  if (!user || user.username !== 'admin') {
    throw new ForbiddenException(message);
  }
}

export async function hasPermission(
  user: any,
  permCache: PermissionCacheService | undefined,
  module: string,
  action: PermAction,
): Promise<boolean> {
  if (!user) {
    return false;
  }
  if (user.username === 'admin') {
    return true;
  }
  const groupId = user.groupId || user.group_id;
  if (!groupId || !permCache) {
    return false;
  }
  return permCache.hasAny(groupId, [{ module, action }]);
}

export async function assertPermission(
  user: any,
  permCache: PermissionCacheService | undefined,
  module: string,
  action: PermAction,
  message?: string,
): Promise<void> {
  if (!user) {
    throw new ForbiddenException(message || 'Quyền truy cập bị từ chối');
  }
  const allowed = await hasPermission(user, permCache, module, action);
  if (!allowed) {
    throw new ForbiddenException(message || `Quyền ${module}:${action} bị từ chối`);
  }
}

export async function assertAnyPermission(
  user: any,
  permCache: PermissionCacheService | undefined,
  perms: { module: string; action: PermAction }[],
  message?: string,
): Promise<void> {
  if (!user) {
    throw new ForbiddenException(message || 'Quyền truy cập bị từ chối');
  }
  if (user.username === 'admin') {
    return;
  }
  const groupId = user.groupId || user.group_id;
  if (!groupId || !permCache) {
    throw new ForbiddenException(message || 'Quyền truy cập bị từ chối');
  }
  const allowed = await permCache.hasAny(groupId, perms);
  if (!allowed) {
    throw new ForbiddenException(message || 'Quyền truy cập bị từ chối');
  }
}
