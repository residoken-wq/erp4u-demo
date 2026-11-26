import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { COST_VISIBLE_METADATA } from './cost-visibility.constants';
import { CostVisibleOptions } from './cost-visibility.decorator';
import { stripCostFields, sanitizeWritePayload } from './cost-filter.util';
import { PermissionCacheService } from '../permission-cache.service';

@Injectable()
export class CostVisibilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CostVisibilityInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly permCacheService: PermissionCacheService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const meta = this.reflector.getAllAndOverride<CostVisibleOptions>(COST_VISIBLE_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!meta) {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest();
    const user = req?.user;

    // Resolve permissions with per-request caching
    const modules = meta.modules && meta.modules.length > 0 ? meta.modules : ['PRODUCT'];
    const cacheKey = modules.slice().sort().join(',');

    if (!req._costVisibilityCache) {
      req._costVisibilityCache = {};
    }

    if (!req._costVisibilityCache[cacheKey]) {
      const canViewCost = await this.permCacheService.canViewCostPrice(user, modules);
      const canViewPurchaseCost = await this.permCacheService.canViewPurchaseCost(user, modules);
      req._costVisibilityCache[cacheKey] = { canViewCost, canViewPurchaseCost };
    }

    const { canViewCost, canViewPurchaseCost } = req._costVisibilityCache[cacheKey];

    // Mục 3: Ghi dữ liệu không được ghi đè giá vốn
    if (['POST', 'PUT', 'PATCH'].includes(req?.method) && req?.body && typeof req.body === 'object') {
      sanitizeWritePayload(req.body, {
        canViewCost,
        canViewPurchaseCost,
        costKeys: meta.keys,
        purchaseKeys: meta.purchaseKeys,
      });
      this.logger.debug(
        `[CostVisibility] Sanitized write payload for user=${user?.username || 'anonymous'} method=${req.method}`,
      );
    }

    // Response filtering
    return next.handle().pipe(
      map((data) =>
        stripCostFields(data, {
          canViewCost,
          canViewPurchaseCost,
          costKeys: meta.keys,
          purchaseKeys: meta.purchaseKeys,
        }),
      ),
    );
  }
}
