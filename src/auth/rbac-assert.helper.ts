import { ForbiddenException } from '@nestjs/common';
import { PermissionCacheService } from './permission-cache.service';
import { PermAction } from './permission-catalog';

export async function assertPermission(
  user: any,
  permCache: PermissionCacheService | undefined,
  module: string,
  action: PermAction,
): Promise<void> {
  if (!user) {
    throw new ForbiddenException('Access denied');
  }
  if (user.username === 'admin') {
    return;
  }
  const groupId = user.groupId || user.group_id;
  if (!groupId || !permCache) {
    throw new ForbiddenException(`Quyền ${module}:${action} bị từ chối`);
  }
  const allowed = await permCache.hasAny(groupId, [{ module, action }]);
  if (!allowed) {
    throw new ForbiddenException(`Quyền ${module}:${action} bị từ chối`);
  }
}

export async function assertAnyPermission(
  user: any,
  permCache: PermissionCacheService | undefined,
  perms: { module: string; action: PermAction }[],
): Promise<void> {
  if (!user) {
    throw new ForbiddenException('Access denied');
  }
  if (user.username === 'admin') {
    return;
  }
  const groupId = user.groupId || user.group_id;
  if (!groupId || !permCache) {
    throw new ForbiddenException('Access denied');
  }
  const allowed = await permCache.hasAny(groupId, perms);
  if (!allowed) {
    throw new ForbiddenException('Access denied');
  }
}
