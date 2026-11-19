import { Injectable } from '@nestjs/common';
import { EntitlementProvider, PackageEntitlementItem } from './entitlement-provider.interface';
import { PackageKey } from './package.registry';

@Injectable()
export class AllEnabledProvider implements EntitlementProvider {
  async isEnabled(_pkg: PackageKey): Promise<boolean> {
    return true;
  }

  async getLimits(_pkg: PackageKey): Promise<Record<string, number> | null> {
    return null;
  }

  async list(): Promise<PackageEntitlementItem[]> {
    return Object.values(PackageKey).map((key) => ({
      key,
      enabled: true,
      validUntil: null,
      limits: null,
    }));
  }

  invalidate(): void {
    // No-op for all-enabled provider
  }
}
