import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { AddonKey, PackageKey } from '../config/packages';
import {
  createIsEnabled,
  createIsAddonInstalled,
  DEFAULT_ADDONS,
  EntitlementsMode,
  getCachedEntitlements,
  loadEntitlementsOnce,
  resetEntitlementsCache,
} from './entitlementsStore';

export interface UseEntitlementsResult {
  loading: boolean;
  mode: EntitlementsMode;
  isEnabled: (pkg: PackageKey) => boolean;
  isAddonInstalled: (addon: AddonKey | string) => boolean;
  addons: Record<string, boolean>;
}

const EntitlementsContext = createContext<UseEntitlementsResult | null>(null);

interface EntitlementsProviderProps {
  enabled: boolean;
  children: React.ReactNode;
}

export const EntitlementsProvider: React.FC<EntitlementsProviderProps> = ({ enabled, children }) => {
  const initialCached = getCachedEntitlements();
  const [loading, setLoading] = useState<boolean>(enabled && !initialCached);
  const [mode, setMode] = useState<EntitlementsMode>(initialCached?.mode ?? 'all');
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean> | null>(
    initialCached?.enabledMap ?? null,
  );
  const [addons, setAddons] = useState<Record<string, boolean>>(
    initialCached?.addons ?? DEFAULT_ADDONS,
  );

  useEffect(() => {
    if (!enabled) {
      resetEntitlementsCache();
      setLoading(false);
      setMode('all');
      setEnabledMap(null);
      setAddons(DEFAULT_ADDONS);
      return;
    }

    const cached = getCachedEntitlements();
    if (cached) {
      setMode(cached.mode);
      setEnabledMap(cached.enabledMap);
      setAddons(cached.addons ?? DEFAULT_ADDONS);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    loadEntitlementsOnce(() => api.get('/me/entitlements')).then((snapshot) => {
      if (!active) return;
      setMode(snapshot.mode);
      setEnabledMap(snapshot.enabledMap);
      setAddons(snapshot.addons ?? DEFAULT_ADDONS);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  const value = useMemo<UseEntitlementsResult>(
    () => ({
      loading,
      mode,
      isEnabled: createIsEnabled(enabledMap),
      isAddonInstalled: createIsAddonInstalled(addons),
      addons,
    }),
    [loading, mode, enabledMap, addons],
  );

  return React.createElement(EntitlementsContext.Provider, { value }, children);
};

export function useEntitlements(): UseEntitlementsResult {
  const ctx = useContext(EntitlementsContext);
  if (ctx) {
    return ctx;
  }

  // Fallback if called outside EntitlementsProvider
  const initialCached = getCachedEntitlements();
  const [loading, setLoading] = useState<boolean>(!initialCached && Boolean(localStorage.getItem('token')));
  const [mode, setMode] = useState<EntitlementsMode>(initialCached?.mode ?? 'all');
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean> | null>(
    initialCached?.enabledMap ?? null,
  );
  const [addons, setAddons] = useState<Record<string, boolean>>(
    initialCached?.addons ?? DEFAULT_ADDONS,
  );

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    loadEntitlementsOnce(() => api.get('/me/entitlements')).then((snapshot) => {
      if (!active) return;
      setMode(snapshot.mode);
      setEnabledMap(snapshot.enabledMap);
      setAddons(snapshot.addons ?? DEFAULT_ADDONS);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return useMemo(
    () => ({
      loading,
      mode,
      isEnabled: createIsEnabled(enabledMap),
      isAddonInstalled: createIsAddonInstalled(addons),
      addons,
    }),
    [loading, mode, enabledMap, addons],
  );
}

export { resetEntitlementsCache };
