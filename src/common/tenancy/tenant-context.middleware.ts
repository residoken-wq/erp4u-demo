import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { TenantContext } from './tenant-context';
import { TENANT_RESOLVER, TenantResolver } from './tenant-resolver.interface';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_RESOLVER)
    private readonly resolver: TenantResolver,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    this.resolver
      .resolve(req)
      .then((ctx) => {
        TenantContext.run(ctx, () => {
          next();
        });
      })
      .catch((err) => {
        next(err);
      });
  }
}
