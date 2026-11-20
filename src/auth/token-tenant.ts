import { UnauthorizedException } from '@nestjs/common';
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
  isTenancyStrict,
} from '../common/tenancy/tenant-context';

export function assertTokenTenant(payload: any): void {
  const strict = isTenancyStrict();

  let currentTenantId: string | undefined;
  try {
    currentTenantId = TenantContext.current()?.tenantId;
  } catch {
    currentTenantId = undefined;
  }

  const tokenTenantId = payload?.tid;

  if (tokenTenantId) {
    if (!currentTenantId || tokenTenantId !== currentTenantId) {
      throw new UnauthorizedException('TOKEN_TENANT_MISMATCH');
    }
    return;
  }

  // Token has no tid (legacy token)
  // Accept ONLY IF current tenant is 'default' AND TENANCY_STRICT is false
  if (!strict && currentTenantId === DEFAULT_TENANT_CONTEXT.tenantId) {
    return;
  }

  throw new UnauthorizedException('TOKEN_TENANT_MISMATCH');
}
