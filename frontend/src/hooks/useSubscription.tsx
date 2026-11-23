import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../utils/api';
import {
  SubscriptionInfo,
  UserQuotaUsage,
  PackageEntitlementItem,
  SubscriptionApiResponse,
  TagConfig,
  getSubscriptionTagConfig,
  getCachedSubscription,
  resetSubscriptionCache,
  loadSubscriptionOnce,
} from './subscriptionStore';

export * from './subscriptionStore';

export interface UseSubscriptionResult {
  subscription: SubscriptionInfo | null;
  users: UserQuotaUsage;
  packages: PackageEntitlementItem[];
  loading: boolean;
  refetch: () => Promise<void>;
}

const defaultUsage: UserQuotaUsage = { used: 0, max: null };

const SubscriptionContext = createContext<UseSubscriptionResult>({
  subscription: null,
  users: defaultUsage,
  packages: [],
  loading: false,
  refetch: async () => {},
});

export const SubscriptionProvider: React.FC<{
  isAuthenticated: boolean;
  children: React.ReactNode;
}> = ({ isAuthenticated, children }) => {
  const [data, setData] = useState<SubscriptionApiResponse | null>(getCachedSubscription());
  const [loading, setLoading] = useState<boolean>(isAuthenticated && !getCachedSubscription());

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      resetSubscriptionCache();
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.get('/system/subscription');
      if (res?.data) {
        setData(res.data);
      }
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      resetSubscriptionCache();
      setData(null);
      setLoading(false);
      return;
    }

    const cached = getCachedSubscription();
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    loadSubscriptionOnce(() => api.get('/system/subscription')).then((res) => {
      if (!active) return;
      setData(res);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  const value: UseSubscriptionResult = {
    subscription: data?.subscription ?? null,
    users: data?.users ?? defaultUsage,
    packages: data?.packages ?? [],
    loading,
    refetch: fetchSubscription,
  };

  return (
    <SubscriptionContext.Provider { ...{ value } }>
      {children}
    </SubscriptionContext.Provider>
  );
};

export function useSubscription(): UseSubscriptionResult {
  return useContext(SubscriptionContext);
}
