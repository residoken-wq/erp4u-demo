import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { PackageKey } from '../config/packages';
import {
  createIsEnabled,
  EntitlementsMode,
  getCachedEntitlements,
  loadEntitlementsOnce,
  resetEntitlementsCache,
} from './entitlementsStore';

export interface UseEntitlementsResult {
  loading: boolean;
  mode: EntitlementsMode;
  isEnabled: (pkg: PackageKey) => boolean;
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

  useEffect(() => {
    if (!enabled) {
      resetEntitlementsCache();
      setLoading(false);
      setMode('all');
      setEnabledMap(null);
      return;
    }

    const cached = getCachedEntitlements();
    if (cached) {
      setMode(cached.mode);
      setEnabledMap(cached.enabledMap);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    loadEntitlementsOnce(() => api.get('/me/entitlements')).then((snapshot) => {
      if (!active) return;
      setMode(snapshot.mode);
      setEnabledMap(snapshot.enabledMap);
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
    }),
    [loading, mode, enabledMap],
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
    }),
    [loading, mode, enabledMap],
  );
}

export { resetEntitlementsCache };
