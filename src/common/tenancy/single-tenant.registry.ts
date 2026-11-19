import { Injectable } from '@nestjs/common';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from './tenant-context';
import { TenantRegistry } from './tenant-registry.interface';

@Injectable()
export class SingleTenantRegistry implements TenantRegistry {
  async list(): Promise<TenantContext[]> {
    return [DEFAULT_TENANT_CONTEXT];
  }
}
