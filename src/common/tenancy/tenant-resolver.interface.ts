import type { Request } from 'express';
import { TenantContext } from './tenant-context';

export const TENANT_RESOLVER = 'TENANT_RESOLVER';

export interface TenantResolver {
  resolve(req: Request): Promise<TenantContext>;
}
