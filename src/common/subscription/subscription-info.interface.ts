export const SUBSCRIPTION_INFO_PROVIDER = 'SUBSCRIPTION_INFO_PROVIDER';

export interface SubscriptionInfo {
  plan_id: string;
  plan_name: string;
  status: 'active' | 'trialing' | 'past_due' | 'suspended' | string;
  trial_ends_at: string | null;        // ISO
  current_period_end: string | null;   // ISO
  support_contact?: { email?: string; phone?: string; url?: string } | null;
}

export interface SubscriptionInfoProvider {
  getCurrent(): Promise<SubscriptionInfo | null>;
}
