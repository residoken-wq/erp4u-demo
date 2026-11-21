import { PackageKey as BackendPackageKey } from '../package.registry';
import {
  PackageKey as FrontendPackageKey,
  ROUTE_PACKAGES,
  getPackageLabel,
  AddonKey,
  ROUTE_ADDONS,
  getRouteAddon,
  getAddonLabel,
} from '../../../../frontend/src/config/packages';
import {
  createIsEnabled,
  createIsAddonInstalled,
  loadEntitlementsOnce,
  resetEntitlementsCache,
} from '../../../../frontend/src/hooks/entitlementsStore';

describe('Frontend Entitlements Store & Package Config (P6b + P7c4d)', () => {
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
    expect(ROUTE_PACKAGES['/website-products']).toBe(FrontendPackageKey.WEBSITE);
    expect(getPackageLabel(FrontendPackageKey.WEBSITE)).toBe('Website & CMS');
  });

  it('verifies ROUTE_ADDONS mapping and getRouteAddon resolver (P7c4d)', () => {
    // AI
    expect(ROUTE_ADDONS['/chatbot/inbox']).toBe(AddonKey.AI);
    expect(ROUTE_ADDONS['/chatbot/requests']).toBe(AddonKey.AI);
    expect(ROUTE_ADDONS['/ai-dashboard']).toBe(AddonKey.AI);
    expect(getRouteAddon('/chatbot/inbox/123')).toBe(AddonKey.AI);
    expect(getRouteAddon('/chatbot/requests/456')).toBe(AddonKey.AI);

    // OMNICHANNEL
    expect(ROUTE_ADDONS['/social/channels']).toBe(AddonKey.OMNICHANNEL);
    expect(ROUTE_ADDONS['/social/orders']).toBe(AddonKey.OMNICHANNEL);
    expect(ROUTE_ADDONS['/marketing']).toBe(AddonKey.OMNICHANNEL);

    // DESIGN
    expect(ROUTE_ADDONS['/designs']).toBe(AddonKey.DESIGN);
    expect(ROUTE_ADDONS['/print-production']).toBe(AddonKey.DESIGN);

    // WEBSITE
    expect(ROUTE_ADDONS['/website-products']).toBe(AddonKey.WEBSITE);

    // Core route has no addon
    expect(getRouteAddon('/products')).toBeUndefined();
    expect(getRouteAddon('/planning')).toBeUndefined();

    expect(getAddonLabel(AddonKey.AI)).toBe('AI Assistant & Chatbot');
    expect(getAddonLabel(AddonKey.OMNICHANNEL)).toBe('Omnichannel (TikTok, Social, ZNS)');
    expect(getAddonLabel(AddonKey.DESIGN)).toBe('Thiết kế in/thêu');
    expect(getAddonLabel(AddonKey.WEBSITE)).toBe('Website & CMS');
  });

  it('parses addons payload from /api/me/entitlements (pure core returns all false)', async () => {
    const mockFetcher = jest.fn().mockResolvedValue({
      data: {
        mode: 'all' as const,
        packages: [{ key: 'CORE', enabled: true }],
        addons: {
          AI: false,
          OMNICHANNEL: false,
          DESIGN: false,
          WEBSITE: false,
        },
      },
    });

    const snapshot = await loadEntitlementsOnce(mockFetcher);
    const isAddonInstalled = createIsAddonInstalled(snapshot.addons);

    expect(snapshot.addons.AI).toBe(false);
    expect(snapshot.addons.OMNICHANNEL).toBe(false);
    expect(snapshot.addons.DESIGN).toBe(false);
    expect(snapshot.addons.WEBSITE).toBe(false);

    expect(isAddonInstalled(AddonKey.AI)).toBe(false);
    expect(isAddonInstalled(AddonKey.OMNICHANNEL)).toBe(false);
    expect(isAddonInstalled(AddonKey.DESIGN)).toBe(false);
    expect(isAddonInstalled(AddonKey.WEBSITE)).toBe(false);
  });

  it('createIsAddonInstalled returns true when plugin registers addon in cloud', async () => {
    const mockFetcher = jest.fn().mockResolvedValue({
      data: {
        mode: 'all' as const,
        packages: [{ key: 'CORE', enabled: true }],
        addons: {
          AI: true,
          OMNICHANNEL: true,
          DESIGN: false,
          WEBSITE: false,
        },
      },
    });

    const snapshot = await loadEntitlementsOnce(mockFetcher);
    const isAddonInstalled = createIsAddonInstalled(snapshot.addons);

    expect(isAddonInstalled(AddonKey.AI)).toBe(true);
    expect(isAddonInstalled(AddonKey.OMNICHANNEL)).toBe(true);
    expect(isAddonInstalled(AddonKey.DESIGN)).toBe(false);
    expect(isAddonInstalled(AddonKey.WEBSITE)).toBe(false);
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
