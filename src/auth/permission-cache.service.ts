import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroupPermission } from '../users/entities/group-permission.entity';
import { PermAction, ACTION_COLUMN } from './permission-catalog';
import { TenantContext } from '../common/tenancy/tenant-context';

interface CacheEntry {
  permissions: GroupPermission[];
  expiresAt: number;
}

@Injectable()
export class PermissionCacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 60 * 1000;

  constructor(
    @InjectRepository(GroupPermission)
    private permRepo: Repository<GroupPermission>,
  ) {}

  private getCacheKey(groupId: number, tenantId?: string): string {
    const tId = tenantId || TenantContext.current().tenantId;
    return `${tId}:${groupId}`;
  }

  async getGroupPermissions(groupId: number): Promise<GroupPermission[]> {
    if (!groupId) return [];

    const now = Date.now();
    const cacheKey = this.getCacheKey(groupId);
    const cached = this.cache.get(cacheKey);
    if (cached && now < cached.expiresAt) {
      return cached.permissions;
    }

    try {
      const permissions = await this.permRepo.find({ where: { group_id: groupId } });
      this.cache.set(cacheKey, {
        permissions,
        expiresAt: now + this.CACHE_TTL_MS,
      });
      return permissions;
    } catch (e) {
      console.error('[PermissionCacheService] Error fetching permissions:', e);
      return cached?.permissions || [];
    }
  }

  async hasAny(groupId: number, anyList: { module: string; action: PermAction }[]): Promise<boolean> {
    if (!groupId || !anyList || anyList.length === 0) return false;

    const permissions = await this.getGroupPermissions(groupId);
    for (const req of anyList) {
      const p = permissions.find((perm) => perm.module_code === req.module);
      if (p) {
        const col = ACTION_COLUMN[req.action];
        if (col && p[col as keyof GroupPermission]) {
          return true;
        }
      }
    }
    return false;
  }

  async assertPermission(user: any, module: string, action: PermAction): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Access denied');
    }
    if (user.username === 'admin') {
      return;
    }
    const groupId = user.groupId || user.group_id;
    if (!groupId) {
      throw new ForbiddenException(`Quyền ${module}:${action} bị từ chối`);
    }
    const allowed = await this.hasAny(groupId, [{ module, action }]);
    if (!allowed) {
      throw new ForbiddenException(`Quyền ${module}:${action} bị từ chối`);
    }
  }

  async assertAnyPermission(user: any, perms: { module: string; action: PermAction }[]): Promise<void> {
    if (!user) {
      throw new ForbiddenException('Access denied');
    }
    if (user.username === 'admin') {
      return;
    }
    const groupId = user.groupId || user.group_id;
    if (!groupId) {
      throw new ForbiddenException('Access denied');
    }
    const allowed = await this.hasAny(groupId, perms);
    if (!allowed) {
      throw new ForbiddenException('Access denied');
    }
  }

  invalidateGroup(groupId?: number): void {
    const tenantId = TenantContext.current().tenantId;
    if (groupId !== undefined) {
      this.cache.delete(`${tenantId}:${groupId}`);
    } else {
      this.invalidateTenant(tenantId);
    }
  }

  invalidateTenant(tenantId?: string): void {
    const targetTenant = tenantId || TenantContext.current().tenantId;
    const prefix = `${targetTenant}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clearAll(): void {
    this.cache.clear();
  }
}
