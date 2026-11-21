import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service';
import { RateLimitedException } from './rate-limit.exception';

export const RATE_LIMIT_KEY = 'RATE_LIMIT_METADATA';

export interface RateLimitMetadataOptions {
  prefix: string;
  maxGetter: (service: RateLimitService) => number;
  windowMsGetter: (service: RateLimitService) => number;
  identifierExtractor?: (req: any, service: RateLimitService) => string;
}

/**
 * Decorator to configure endpoint rate limiting by IP or custom identifier
 */
export const RateLimit = (options: RateLimitMetadataOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);

/**
 * Standard guard that checks and consumes rate limits for an endpoint.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<RateLimitMetadataOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) return true;

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const max = options.maxGetter(this.rateLimitService);
    const windowMs = options.windowMsGetter(this.rateLimitService);
    const identifier = options.identifierExtractor
      ? options.identifierExtractor(req, this.rateLimitService)
      : this.rateLimitService.getClientIp(req);

    const key = this.rateLimitService.buildKey(options.prefix, identifier);

    try {
      await this.rateLimitService.consume(key, windowMs, max);
      return true;
    } catch (err) {
      if (err instanceof RateLimitedException && res?.setHeader) {
        res.setHeader('Retry-After', String(err.retryAfter));
      }
      throw err;
    }
  }
}

/**
 * Specialized guard for POST /api/auth/login.
 *
 * Checks BEFORE handler runs:
 * 1. IP general limit: 50 failed attempts / 15 mins.
 * 2. IP + username limit: 10 failed attempts / 15 mins.
 *
 * Does NOT increment here. Counters are only incremented upon failed login,
 * and cleared upon successful login.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(private readonly rateLimitService: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    const ip = this.rateLimitService.getClientIp(req);
    const username = this.rateLimitService.normalizeIdentifier(
      req.body?.username,
    );

    // 1. Check IP general limit
    const ipMax = this.rateLimitService.getLoginIpMax();
    const ipKey = this.rateLimitService.buildKey('login:ip', ip);
    const ipCheck = await this.rateLimitService.checkLimit(ipKey, ipMax);
    if (ipCheck.isBlocked) {
      if (res?.setHeader) {
        res.setHeader('Retry-After', String(ipCheck.retryAfter));
      }
      throw new RateLimitedException(ipCheck.retryAfter);
    }

    // 2. Check IP + username limit
    if (username) {
      const userMax = this.rateLimitService.getLoginUserMax();
      const userKey = this.rateLimitService.buildKey(
        'login:account',
        `${ip}:${username}`,
      );
      const userCheck = await this.rateLimitService.checkLimit(userKey, userMax);
      if (userCheck.isBlocked) {
        if (res?.setHeader) {
          res.setHeader('Retry-After', String(userCheck.retryAfter));
        }
        throw new RateLimitedException(userCheck.retryAfter);
      }
    }

    return true;
  }
}
