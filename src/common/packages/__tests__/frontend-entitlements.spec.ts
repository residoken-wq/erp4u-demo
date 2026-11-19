import { PackageKey as BackendPackageKey } from '../package.registry';
import {
  PackageKey as FrontendPackageKey,
  ROUTE_PACKAGES,
  getPackageLabel,
} from '../../../../frontend/src/config/packages';
import {
  createIsEnabled,
  loadEntitlementsOnce,
  resetEntitlementsCache,
} from '../../../../frontend/src/hooks/entitlementsStore';

describe('Frontend Entitlements Store & Package Config (P6b)', () => {
  beforeEach(() => {
    resetEntitlementsCache();
  });

  it('keeps frontend PackageKey enum in sync with backend PackageKey enum', () => {
    expect(Object.values(FrontendPackageKey).sort()).toEqual(
      Object.values(BackendPackageKey).sort(),
    );
    for (const pkg of Object.values(FrontendPackageKey)) {
      expect(getPackageLabel(pkg)).toBeTruthy();
    }
    expect(ROUTE_PACKAGES['/planning']).toBe(FrontendPackageKey.PRODUCTION);
    expect(ROUTE_PACKAGES['/sales']).toBe(FrontendPackageKey.SALES);
    expect(ROUTE_PACKAGES['/designs']).toBe(FrontendPackageKey.DESIGN);
  });

  it('returns false for PRODUCTION when API returns PRODUCTION disabled', async () => {
    const mockFetcher = jest.fn().mockResolvedValue({
      data: {
        mode: 'db' as const,
        packages: [
          { key: 'CORE', enabled: true, validUntil: null },
          { key: 'SALES', enabled: true, validUntil: null },
          { key: 'PRODUCTION', enabled: false, validUntil: null },
          { key: 'INVENTORY', enabled: false, validUntil: null },
        ],
      },
    });

    const snapshot = await loadEntitlementsOnce(mockFetcher);
    const isEnabled = createIsEnabled(snapshot.enabledMap);

    expect(snapshot.mode).toBe('db');
    expect(isEnabled(FrontendPackageKey.PRODUCTION)).toBe(false);
    expect(isEnabled(FrontendPackageKey.INVENTORY)).toBe(false);
    expect(isEnabled(FrontendPackageKey.SALES)).toBe(true);
    expect(isEnabled(FrontendPackageKey.CORE)).toBe(true);
  });

  it('returns true for all packages when API fails with 500 error (fail-open)', async () => {
    const err: any = new Error('Request failed with status code 500');
    err.response = { status: 500, data: { message: 'Internal Server Error' } };
    const mockFetcher = jest.fn().mockRejectedValue(err);

    const snapshot = await loadEntitlementsOnce(mockFetcher);
    const isEnabled = createIsEnabled(snapshot.enabledMap);

    expect(snapshot.loaded).toBe(true);
    expect(snapshot.mode).toBe('all');
    expect(isEnabled(FrontendPackageKey.PRODUCTION)).toBe(true);
    expect(isEnabled(FrontendPackageKey.SALES)).toBe(true);
    expect(isEnabled(FrontendPackageKey.AI)).toBe(true);
    expect(isEnabled(FrontendPackageKey.CORE)).toBe(true);
  });

  it('caches /me/entitlements result in memory and only calls API once', async () => {
    const mockFetcher = jest.fn().mockResolvedValue({
      data: {
        mode: 'db' as const,
        packages: [
          { key: 'CORE', enabled: true },
          { key: 'PRODUCTION', enabled: false },
        ],
      },
    });

    const first = await loadEntitlementsOnce(mockFetcher);
    const second = await loadEntitlementsOnce(mockFetcher);

    expect(mockFetcher).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });
});
