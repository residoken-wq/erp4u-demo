import { PackageKey } from './package.registry';

export const ENTITLEMENT_PROVIDER = 'ENTITLEMENT_PROVIDER';

export interface PackageEntitlementItem {
  key: PackageKey;
  enabled: boolean;
  validUntil: Date | null;
  limits: Record<string, number> | null;
}

export interface EntitlementProvider {
  isEnabled(pkg: PackageKey): Promise<boolean>;
  getLimits(pkg: PackageKey): Promise<Record<string, number> | null>;
  list(): Promise<PackageEntitlementItem[]>;
  invalidate?(): void;
}
