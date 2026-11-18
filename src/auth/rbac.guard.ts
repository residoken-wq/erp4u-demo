import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ApiKeyGuard } from './api-key.guard';
import { RBAC_KEY, RbacRule, PERMISSION_KEY } from './permissions.decorator';
import { PermAction } from './permission-catalog';
import { RbacModeService, RbacMode } from './rbac-mode.service';
import { RbacAccessLogService } from './rbac-access-log.service';
import { PermissionCacheService } from './permission-cache.service';

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly rbacModeService: RbacModeService,
    private readonly accessLog: RbacAccessLogService,
    private readonly permCacheService: PermissionCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    let mode: RbacMode = 'SHADOW';
    try {
      mode = await this.rbacModeService.get();
      if (mode === 'OFF') {
        return true;
      }

      // 1. Check Public
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) {
        return true;
      }

      // 2. Check ApiKeyGuard
      const guards = [
        ...(this.reflector.get<any[]>('__guards__', context.getHandler()) || []),
        ...(this.reflector.get<any[]>('__guards__', context.getClass()) || []),
      ];
      const hasApiKeyGuard = guards.some(
        (g) => g === ApiKeyGuard || g?.name === 'ApiKeyGuard' || (typeof g === 'function' && g.name === 'ApiKeyGuard'),
      );
      if (hasApiKeyGuard) {
        return true;
      }

      // 3. Read rules (new or legacy)
      let rule = this.reflector.getAllAndOverride<RbacRule>(RBAC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      const legacy = this.reflector.getAllAndOverride<{ moduleCode: string; action: string }>(
        PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (!rule && legacy) {
        const action = legacy.action.replace('can_', '') as PermAction;
        rule = {
          tier: 'PERM',
          any: [{ module: legacy.moduleCode, action }],
        };
      }

      const classified = !!rule;
      if (!rule) {
        rule = { tier: 'AUTH' };
      }

      // 4. Verify token
      const req = context.switchToHttp().getRequest();
      const user = this.verifyBearer(req);

      // 5. Decision
      let decision: 'ALLOW' | 'DENY_NO_AUTH' | 'DENY_NO_PERM' = 'ALLOW';
      let failedModule = '';
      let failedAction = '';

      if (!user) {
        decision = 'DENY_NO_AUTH';
      } else if (user.username === 'admin') {
        decision = 'ALLOW';
      } else if (rule.tier === 'PERM') {
        const hasPerm = await this.permCacheService.hasAny(user.groupId, rule.any);
        if (!hasPerm) {
          decision = 'DENY_NO_PERM';
          if (rule.any && rule.any.length > 0) {
            failedModule = rule.any[0].module;
            failedAction = rule.any[0].action;
          }
        }
      }

      // 6. Record log if not ALLOW or unclassified
      let logDecision: string | null = null;
      if (decision !== 'ALLOW') {
        logDecision = decision;
      } else if (!classified) {
        logDecision = 'UNCLASSIFIED';
      }

      if (logDecision) {
        let requiredStr: string | null = null;
        if (rule.tier === 'PERM') {
          requiredStr = rule.any.map((r) => `${r.module}:${r.action}`).join(' | ');
        } else {
          requiredStr = 'AUTH';
        }

        const route = this.getRoutePattern(req);
        const userAgent = req.headers['user-agent'] || null;
        const ip = req.ip || req.connection?.remoteAddress || null;

        this.accessLog
          .record({
            mode,
            decision: logDecision,
            method: req.method,
            route,
            required: requiredStr,
            user_id: user?.id || null,
            username: user?.username || null,
            group_id: user?.groupId || null,
            ip,
            user_agent: userAgent,
          })
          .catch(() => {});
      }

      // 7. Enforce or shadow
      if (mode === 'SHADOW') {
        return true;
      }

      // ENFORCE (Phase 2 onwards)
      if (decision === 'DENY_NO_AUTH') {
        throw new UnauthorizedException('Yêu cầu xác thực tài khoản');
      }
      if (decision === 'DENY_NO_PERM') {
        throw new ForbiddenException(
          `Bạn không có quyền "${failedAction}" trong module "${failedModule}".`,
        );
      }

      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        throw err;
      }
      // Any internal error in SHADOW mode returns true gracefully
      if (mode === 'SHADOW' || !mode) {
        return true;
      }
      throw err;
    }
  }

  private verifyBearer(req: any): { id: number; username: string; groupId: number } | null {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7).trim();
    if (!token) return null;

    try {
      const payload = this.jwtService.verify(token);
      return {
        id: payload.sub,
        username: payload.username,
        groupId: payload.group_id,
      };
    } catch {
      return null;
    }
  }

  private getRoutePattern(req: any): string {
    const baseUrl = req.baseUrl || '';
    const routePath = req.route?.path || '';
    let full = baseUrl + routePath;
    if (!full) {
      full = req.originalUrl?.split('?')[0] || req.url || '';
    }
    full = full.replace(/\/+/g, '/');
    if (full.length > 1 && full.endsWith('/')) {
      full = full.slice(0, -1);
    }
    return full;
  }
}
