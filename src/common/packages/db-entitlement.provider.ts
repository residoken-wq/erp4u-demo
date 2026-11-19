import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EntitlementProvider, PackageEntitlementItem } from './entitlement-provider.interface';
import { PackageKey, PACKAGE_DEPENDENCIES } from './package.registry';
import { TenantEntitlement } from './tenant-entitlement.entity';

@Injectable()
export class DbEntitlementProvider implements EntitlementProvider {
  private readonly logger = new Logger(DbEntitlementProvider.name);
  private cache: Map<string, TenantEntitlement> | null = null;
  private cacheExpiresAt: number = 0;
  private readonly CACHE_TTL_MS = 60 * 1000; // 60 seconds

  constructor(
    @InjectRepository(TenantEntitlement)
    private readonly repo: Repository<TenantEntitlement>,
  ) {}

  invalidate(): void {
    this.cache = null;
    this.cacheExpiresAt = 0;
  }

  private async getRecordsMap(): Promise<Map<string, TenantEntitlement>> {
    const now = Date.now();
    if (this.cache && this.cacheExpiresAt > now) {
      return this.cache;
    }

    const records = await this.repo.find({
      where: { tenant_id: 'default' },
    });

    const map = new Map<string, TenantEntitlement>();
    for (const record of records) {
      map.set(record.package_key, record);
    }

    this.cache = map;
    this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    return map;
  }

  async isEnabled(pkg: PackageKey): Promise<boolean> {
    if (pkg === PackageKey.CORE) {
      return true;
    }

    const map = await this.getRecordsMap();
    return this.checkPackageEnabled(pkg, map, new Set<PackageKey>());
  }

  private checkPackageEnabled(
    pkg: PackageKey,
    map: Map<string, TenantEntitlement>,
    visited: Set<PackageKey>,
  ): boolean {
    if (pkg === PackageKey.CORE) {
      return true;
    }

    if (visited.has(pkg)) {
      return false; // prevent cycles
    }
    visited.add(pkg);

    const record = map.get(pkg);
    if (!record || !record.enabled) {
      return false;
    }

    if (record.valid_until && new Date(record.valid_until).getTime() <= Date.now()) {
      return false;
    }

    const deps = PACKAGE_DEPENDENCIES[pkg] || [];
    for (const dep of deps) {
      if (!this.checkPackageEnabled(dep, map, visited)) {
        return false;
      }
    }

    return true;
  }

  async getLimits(pkg: PackageKey): Promise<Record<string, number> | null> {
    const map = await this.getRecordsMap();
    const record = map.get(pkg);
    return record?.limits || null;
  }

  async list(): Promise<PackageEntitlementItem[]> {
    const map = await this.getRecordsMap();
    const result: PackageEntitlementItem[] = [];

    for (const key of Object.values(PackageKey)) {
      const record = map.get(key);
      const enabled = await this.isEnabled(key);
      result.push({
        key,
        enabled,
        validUntil: record?.valid_until ? new Date(record.valid_until) : null,
        limits: record?.limits || null,
      });
    }

    return result;
  }
}
