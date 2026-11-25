import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../system/system-config.entity';
import { ActivityLog } from '../system/entities/activity-log.entity';
import { TenantContext } from '../common/tenancy/tenant-context';
import { PermissionCacheService } from './permission-cache.service';
import { assertPermission } from './rbac-assert.helper';

export type RbacMode = 'SHADOW' | 'ENFORCE';

export interface RbacModeInfo {
  mode: RbacMode;
  effective_mode: RbacMode;
  forced: boolean;
}

let hasWarnedInvalidForceMode = false;

@Injectable()
export class RbacModeService {
  private cache = new Map<string, { mode: RbacMode; fetchedAt: number }>();
  private readonly CACHE_TTL_MS = 30 * 1000;

  constructor(
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
    @Optional()
    @InjectRepository(ActivityLog)
    private activityLogRepo?: Repository<ActivityLog>,
    @Optional()
    @Inject(forwardRef(() => PermissionCacheService))
    private permCacheService?: PermissionCacheService,
  ) {
    this.checkForceModeEnv();
  }

  private checkForceModeEnv(): void {
    const raw = process.env.RBAC_FORCE_MODE;
    if (raw !== undefined && raw.trim() !== '') {
      const normalized = raw.trim().toUpperCase();
      if (normalized !== 'SHADOW' && normalized !== 'ENFORCE') {
        if (!hasWarnedInvalidForceMode) {
          console.warn(
            `[RBAC] Giá trị RBAC_FORCE_MODE="${raw}" không hợp lệ, chỉ chấp nhận SHADOW hoặc ENFORCE. Bỏ qua.`,
          );
          hasWarnedInvalidForceMode = true;
        }
      }
    }
  }

  getForcedMode(): RbacMode | null {
    const raw = process.env.RBAC_FORCE_MODE;
    if (raw !== undefined && raw.trim() !== '') {
      const normalized = raw.trim().toUpperCase();
      if (normalized === 'SHADOW' || normalized === 'ENFORCE') {
        return normalized as RbacMode;
      }
    }
    return null;
  }

  async getTenantMode(tenantId?: string): Promise<RbacMode> {
    const tId = tenantId || TenantContext.current().tenantId;
    const now = Date.now();
    const cached = this.cache.get(tId);
    if (cached && now - cached.fetchedAt < this.CACHE_TTL_MS) {
      return cached.mode;
    }

    let mode: RbacMode = 'SHADOW';
    try {
      const record = await this.configRepo.findOne({ where: { key: 'RBAC_MODE' } });
      const val = record?.value?.trim().toUpperCase();
      if (val === 'OFF') {
        console.warn(
          `[RBAC] Chế độ OFF trong DB của tenant "${tId}" đã bị bãi bỏ. Đọc là SHADOW.`,
        );
        mode = 'SHADOW';
      } else if (val === 'ENFORCE') {
        mode = 'ENFORCE';
      } else {
        mode = 'SHADOW';
      }
      this.cache.set(tId, { mode, fetchedAt: now });
      return mode;
    } catch (e) {
      console.error(`[RBAC] Lỗi khi truy vấn chế độ RBAC cho tenant "${tId}":`, e);
      if (cached) {
        return cached.mode;
      }
      return 'SHADOW';
    }
  }

  async get(): Promise<RbacMode> {
    const forced = this.getForcedMode();
    if (forced) {
      return forced;
    }
    return this.getTenantMode();
  }

  async getModeInfo(): Promise<RbacModeInfo> {
    const mode = await this.getTenantMode();
    const forcedMode = this.getForcedMode();
    return {
      mode,
      effective_mode: forcedMode || mode,
      forced: forcedMode !== null,
    };
  }

  async setMode(mode: string, user: any): Promise<RbacMode> {
    const normalized = (mode || '').trim().toUpperCase();
    if (normalized !== 'SHADOW' && normalized !== 'ENFORCE') {
      throw new BadRequestException(
        'Chế độ RBAC không hợp lệ. Chỉ chấp nhận SHADOW hoặc ENFORCE',
      );
    }

    // Explicit authorization check: admin (exact match) or SYSTEM:update
    const userInfo = typeof user === 'string' ? { username: user } : (user || {});
    await assertPermission(
      userInfo,
      this.permCacheService,
      'SYSTEM',
      'update',
      'Chỉ admin hoặc nhóm có quyền SYSTEM:update mới có thể thay đổi chế độ RBAC',
    );

    const tId = TenantContext.current().tenantId;
    const oldMode = await this.getTenantMode(tId);

    let config = await this.configRepo.findOne({ where: { key: 'RBAC_MODE' } });
    if (!config) {
      config = this.configRepo.create({
        key: 'RBAC_MODE',
        value: normalized,
        description: 'Chế độ phân quyền RBAC: SHADOW | ENFORCE',
      });
    } else {
      config.value = normalized;
    }

    await this.configRepo.save(config);
    this.cache.set(tId, { mode: normalized as RbacMode, fetchedAt: Date.now() });

    // Record activity log
    try {
      if (this.activityLogRepo) {
        await this.activityLogRepo.save(
          this.activityLogRepo.create({
            user_id: userInfo.id || userInfo.userId || null,
            username: userInfo.username || 'unknown',
            full_name: userInfo.full_name || '',
            action: 'UPDATE',
            module: 'SYSTEM',
            entity_id: 'RBAC_MODE',
            description: `Đổi chế độ RBAC từ ${oldMode} sang ${normalized}`,
            details: { old: oldMode, new: normalized, tenant_id: tId },
          }),
        );
      }
    } catch (err) {
      console.error('[RBAC] Lỗi khi ghi activity log:', err);
    }

    console.warn(
      `[RBAC] mode changed from ${oldMode} to ${normalized} by ${userInfo.username || 'unknown'} (tenant=${tId})`,
    );

    return normalized as RbacMode;
  }

  clearCache(tenantId?: string): void {
    const tId = tenantId || TenantContext.current().tenantId;
    this.cache.delete(tId);
  }

  clearAllCache(): void {
    this.cache.clear();
  }
}
