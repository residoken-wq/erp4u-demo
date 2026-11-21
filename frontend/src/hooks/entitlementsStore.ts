import { AddonKey, PackageKey } from '../config/packages';

export type EntitlementsMode = 'all' | 'db';

export interface PackageEntitlementDto {
  key: string;
  enabled: boolean;
  validUntil?: string | null;
}

export interface EntitlementsApiResponse {
  mode: EntitlementsMode;
  packages: PackageEntitlementDto[];
  addons?: Record<string, boolean>;
}

export interface EntitlementsSnapshot {
  loaded: boolean;
  mode: EntitlementsMode;
  /**
   * null means fail-open (all enabled): used during initial load, mode='all', or on network/500 errors.
   */
  enabledMap: Record<string, boolean> | null;
  /**
   * Status of installed premium add-ons (AI, OMNICHANNEL, DESIGN, WEBSITE).
   * Open-core returns all false; cloud plugins register installed addons.
   */
  addons: Record<string, boolean>;
}

export const DEFAULT_ADDONS: Record<string, boolean> = {
  AI: false,
  OMNICHANNEL: false,
  DESIGN: false,
  WEBSITE: false,
};

export type EntitlementsFetcher = () => Promise<{ data: EntitlementsApiResponse }>;

const DEFAULT_SNAPSHOT: EntitlementsSnapshot = {
  loaded: false,
  mode: 'all',
  enabledMap: null,
  addons: DEFAULT_ADDONS,
};

let cachedSnapshot: EntitlementsSnapshot | null = null;
let inFlightPromise: Promise<EntitlementsSnapshot> | null = null;

export function createIsEnabled(enabledMap: Record<string, boolean> | null): (pkg: PackageKey) => boolean {
  return (pkg: PackageKey): boolean => {
    if (pkg === PackageKey.CORE) {
      return true;
    }
    if (!enabledMap) {
      return true;
    }
    return enabledMap[pkg] !== false;
  };
}

export function createIsAddonInstalled(addons: Record<string, boolean>): (addon: AddonKey | string) => boolean {
  return (addon: AddonKey | string): boolean => {
    return Boolean(addons[addon]);
  };
}

export function getCachedEntitlements(): EntitlementsSnapshot | null {
  return cachedSnapshot;
}

export function resetEntitlementsCache(): void {
  cachedSnapshot = null;
  inFlightPromise = null;
}

/**
 * Fetches /me/entitlements once and caches the result in memory.
 * On network or 5xx errors, fails open (treats all packages as enabled so users are never locked out by transient errors).
 */
export async function loadEntitlementsOnce(fetcher: EntitlementsFetcher): Promise<EntitlementsSnapshot> {
  if (cachedSnapshot) {
    return cachedSnapshot;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const res = await fetcher();
      const payload = res?.data;

      if (!payload || !Array.isArray(payload.packages)) {
        const fallback: EntitlementsSnapshot = {
          loaded: true,
          mode: 'all',
          enabledMap: null,
          addons: DEFAULT_ADDONS,
        };
        cachedSnapshot = fallback;
        return fallback;
      }

      const mode: EntitlementsMode = payload.mode === 'db' ? 'db' : 'all';
      const enabledMap: Record<string, boolean> = {};
      for (const item of payload.packages) {
        if (item) {
          const { key: pkgKey, enabled } = item;
          if (typeof pkgKey === 'string') {
            enabledMap[pkgKey] = Boolean(enabled);
          }
        }
      }

      const addons: Record<string, boolean> = {
        ...DEFAULT_ADDONS,
        ...(payload.addons || {}),
      };

      const snapshot: EntitlementsSnapshot = {
        loaded: true,
        mode,
        enabledMap,
        addons,
      };
      cachedSnapshot = snapshot;
      return snapshot;
    } catch {
      // Network error or 500: treat all packages as enabled (only real 402 blocks)
      const failOpen: EntitlementsSnapshot = {
        ...DEFAULT_SNAPSHOT,
        loaded: true,
        mode: 'all',
        enabledMap: null,
        addons: DEFAULT_ADDONS,
      };
      cachedSnapshot = failOpen;
      return failOpen;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}
