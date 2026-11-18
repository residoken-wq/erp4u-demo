import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../system/system-config.entity';

export type RbacMode = 'OFF' | 'SHADOW' | 'ENFORCE';

@Injectable()
export class RbacModeService {
  private cachedMode: RbacMode | null = null;
  private lastFetchedAt: number = 0;
  private readonly CACHE_TTL_MS = 30 * 1000;

  constructor(
    @InjectRepository(SystemConfig)
    private configRepo: Repository<SystemConfig>,
  ) {}

  async get(): Promise<RbacMode> {
    const now = Date.now();
    if (this.cachedMode && now - this.lastFetchedAt < this.CACHE_TTL_MS) {
      return this.cachedMode;
    }

    try {
      const record = await this.configRepo.findOne({ where: { key: 'RBAC_MODE' } });
      const val = record?.value?.trim().toUpperCase();
      if (val === 'OFF' || val === 'SHADOW' || val === 'ENFORCE') {
        this.cachedMode = val as RbacMode;
      } else {
        this.cachedMode = 'SHADOW';
      }
    } catch (e) {
      this.cachedMode = 'SHADOW';
    }

    this.lastFetchedAt = now;
    return this.cachedMode;
  }

  async setMode(mode: string, username: string): Promise<RbacMode> {
    const normalized = (mode || '').trim().toUpperCase();
    if (normalized === 'ENFORCE') {
      throw new BadRequestException('ENFORCE chỉ bật từ Phase 2');
    }
    if (normalized !== 'OFF' && normalized !== 'SHADOW') {
      throw new BadRequestException('Chế độ RBAC không hợp lệ. Chỉ chấp nhận OFF hoặc SHADOW');
    }

    let config = await this.configRepo.findOne({ where: { key: 'RBAC_MODE' } });
    if (!config) {
      config = this.configRepo.create({
        key: 'RBAC_MODE',
        value: normalized,
        description: 'Chế độ phân quyền RBAC: OFF | SHADOW | ENFORCE',
      });
    } else {
      config.value = normalized;
    }

    await this.configRepo.save(config);
    this.cachedMode = normalized as RbacMode;
    this.lastFetchedAt = Date.now();
    console.warn('[RBAC] mode changed', normalized, 'by', username);

    return this.cachedMode;
  }

  clearCache() {
    this.cachedMode = null;
    this.lastFetchedAt = 0;
  }
}
