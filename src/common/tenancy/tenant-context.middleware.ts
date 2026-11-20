import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from './tenant-context';
import { TENANT_RESOLVER, TenantResolver } from './tenant-resolver.interface';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_RESOLVER)
    private readonly resolver: TenantResolver,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const pathCandidate = (req.path || req.originalUrl || req.url || '').split('?')[0];
    const isHealthCheck =
      pathCandidate === '/health' ||
      pathCandidate === '/api/health' ||
      pathCandidate.endsWith('/health');

    this.resolver
      .resolve(req)
      .then((ctx) => {
        TenantContext.run(ctx || DEFAULT_TENANT_CONTEXT, () => {
          next();
        });
      })
      .catch((err) => {
        if (isHealthCheck) {
          // Health route is allowed to fall back to infrastructure context
          TenantContext.run(DEFAULT_TENANT_CONTEXT, () => {
            next();
          });
        } else {
          next(err);
        }
      });
  }
}
