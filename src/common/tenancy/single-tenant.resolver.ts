import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from './tenant-context';
import { TenantResolver } from './tenant-resolver.interface';

@Injectable()
export class SingleTenantResolver implements TenantResolver {
  async resolve(_req: Request): Promise<TenantContext> {
    return DEFAULT_TENANT_CONTEXT;
  }
}
