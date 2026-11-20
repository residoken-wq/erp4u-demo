import {
  BadRequestException,
  Inject,
  Injectable,
  NestMiddleware,
} from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import {
  DEFAULT_TENANT_CONTEXT,
  TenantContext,
  isTenancyStrict,
} from "./tenant-context";
import { TENANT_RESOLVER, TenantResolver } from "./tenant-resolver.interface";

export const HEALTH_PATHS = new Set(["/health", "/api/health"]);

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_RESOLVER)
    private readonly resolver: TenantResolver,
  ) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const rawPath = req.originalUrl || req.path || req.url || "";
    const pathWithoutQuery = rawPath.split("?")[0];
    const normalizedPath =
      pathWithoutQuery.length > 1 && pathWithoutQuery.endsWith("/")
        ? pathWithoutQuery.slice(0, -1)
        : pathWithoutQuery;
    const isHealthCheck = HEALTH_PATHS.has(normalizedPath);

    this.resolver
      .resolve(req)
      .then((ctx) => {
        if (!ctx) {
          if (isTenancyStrict() && !isHealthCheck) {
            const err = new BadRequestException("TENANT_NOT_RESOLVED");
            (err as any).code = "TENANT_NOT_RESOLVED";
            next(err);
            return;
          }
          TenantContext.run(DEFAULT_TENANT_CONTEXT, () => {
            next();
          });
          return;
        }

        TenantContext.run(ctx, () => {
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
