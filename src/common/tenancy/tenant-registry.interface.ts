import { TenantContext } from './tenant-context';

export const TENANT_REGISTRY = 'TENANT_REGISTRY';

export interface TenantRegistry {
  list(): Promise<TenantContext[]>;
}
