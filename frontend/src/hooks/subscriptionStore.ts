export interface SubscriptionInfo {
  plan_id: string;
  plan_name: string;
  status: 'active' | 'trialing' | 'past_due' | 'suspended' | string;
  trial_ends_at: string | null;        // ISO
  current_period_end: string | null;   // ISO
  support_contact?: { email?: string; phone?: string; url?: string } | null;
}

export interface UserQuotaUsage {
  used: number;
  max: number | null;
}

export interface PackageEntitlementItem {
  key: string;
  enabled: boolean;
  validUntil: string | null;
  limits: Record<string, number> | null;
}

export interface SubscriptionApiResponse {
  subscription: SubscriptionInfo | null;
  users: UserQuotaUsage;
  packages: PackageEntitlementItem[];
}

export interface TagConfig {
  label: string;
  color: 'red' | 'orange' | 'blue' | 'default';
  daysRemaining?: number;
}

/**
 * Pure helper for calculating tag label and color.
 * Used by Header tag and verified in unit tests.
 */
export function getSubscriptionTagConfig(
  subscription: SubscriptionInfo | null,
  nowMs: number = Date.now(),
): TagConfig | null {
  if (!subscription) {
    return null;
  }

  const { plan_name, status, trial_ends_at } = subscription;

  if (status === 'past_due' || status === 'suspended') {
    return {
      label: `Gói ${plan_name}`,
      color: 'red',
    };
  }

  if (status === 'trialing') {
    let daysRemaining = 0;
    if (trial_ends_at) {
      const diffMs = new Date(trial_ends_at).getTime() - nowMs;
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    let color: 'red' | 'orange' | 'blue' = 'blue';
    if (daysRemaining <= 1) {
      color = 'red';
    } else if (daysRemaining <= 7) {
      color = 'orange';
    }

    return {
      label: `Gói ${plan_name} · Dùng thử còn ${daysRemaining} ngày`,
      color,
      daysRemaining,
    };
  }

  return {
    label: `Gói ${plan_name}`,
    color: 'blue',
  };
}

let cachedSubscriptionData: SubscriptionApiResponse | null = null;
let subscriptionFetchPromise: Promise<SubscriptionApiResponse | null> | null = null;

export function getCachedSubscription(): SubscriptionApiResponse | null {
  return cachedSubscriptionData;
}

export function resetSubscriptionCache(): void {
  cachedSubscriptionData = null;
  subscriptionFetchPromise = null;
}

export async function loadSubscriptionOnce(
  fetcher: () => Promise<{ data: SubscriptionApiResponse }>,
): Promise<SubscriptionApiResponse | null> {
  if (cachedSubscriptionData) {
    return cachedSubscriptionData;
  }

  if (subscriptionFetchPromise) {
    return subscriptionFetchPromise;
  }

  subscriptionFetchPromise = (async () => {
    try {
      const res = await fetcher();
      if (res?.data) {
        cachedSubscriptionData = res.data;
        return res.data;
      }
      return null;
    } catch {
      // On network/403/500 error, fail silently without throwing
      return null;
    } finally {
      subscriptionFetchPromise = null;
    }
  })();

  return subscriptionFetchPromise;
}
