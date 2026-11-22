import { useState, useEffect } from 'react';

let cachedIsDemo: boolean | null = null;
let inFlightPromise: Promise<boolean> | null = null;

export type DemoModeFetcher = () => Promise<{ data?: { demo?: boolean } }>;

let configuredFetcher: DemoModeFetcher | null = null;

/**
 * Configure a custom fetcher (useful for testing or server environments).
 */
export function setDemoModeFetcher(fetcher: DemoModeFetcher | null): void {
  configuredFetcher = fetcher;
}

const resolveDefaultFetcher = async (): Promise<DemoModeFetcher> => {
  if (configuredFetcher) {
    return configuredFetcher;
  }
  const mod = await import('../utils/api');
  const api = mod.default || mod;
  return () => api.get('/public/meta', { timeout: 5000 });
};

/**
 * Fetch demo mode flag from /public/meta once with fail-closed semantics.
 * Defaults to false; on network error, timeout, or anything other than demo === true, returns false.
 * Module-level promise and value cache ensures only one network request is made.
 */
export async function loadDemoModeOnce(customFetcher?: DemoModeFetcher): Promise<boolean> {
  if (cachedIsDemo !== null) {
    return cachedIsDemo;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const fetcher = customFetcher || (await resolveDefaultFetcher());
      const res = await fetcher();
      const isDemo = res?.data?.demo === true;
      cachedIsDemo = isDemo;
      return isDemo;
    } catch {
      cachedIsDemo = false;
      return false;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

export function getCachedDemoMode(): boolean | null {
  return cachedIsDemo;
}

export function resetDemoModeCache(): void {
  cachedIsDemo = null;
  inFlightPromise = null;
}

/**
 * Hook to retrieve demo mode state.
 * Returns isDemo (boolean, default false, fail-closed).
 * State while waiting is false so UI never flashes demo content and hides it.
 */
export function useDemoMode(fetcher?: DemoModeFetcher): boolean {
  const [isDemo, setIsDemo] = useState<boolean>(() => cachedIsDemo === true);

  useEffect(() => {
    let active = true;

    if (cachedIsDemo !== null) {
      setIsDemo(cachedIsDemo === true);
      return;
    }

    loadDemoModeOnce(fetcher).then((val) => {
      if (active) {
        setIsDemo(val === true);
      }
    });

    return () => {
      active = false;
    };
  }, [fetcher]);

  return isDemo;
}

export default useDemoMode;
