import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SystemService } from '../system/system.service';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private systemService: SystemService,
    private reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
    ]);
    if (isPublic) {
        return true;
    }

    const request = context.switchToHttp().getRequest();
    
    // Check for X-API-Key header
    const apiKey = request.headers['x-api-key'];
    
    // Fallback to Bearer token if not standard JWT format
    const authHeader = request.headers['authorization'];
    let bearerToken = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.split(' ')[1];
    }

    const tokenToVerify = apiKey || bearerToken;

    if (!tokenToVerify) {
      throw new UnauthorizedException('API key is missing');
    }

    try {
      const tokenRecord = await this.systemService.validateApiToken(tokenToVerify);
      if (!tokenRecord) {
        throw new UnauthorizedException('Invalid API key');
      }

      // Attach bot info to request
      request.user = {
        id: `bot_${tokenRecord.id}`,
        username: tokenRecord.name,
        is_bot: true,
        permissions: tokenRecord.permissions || []
      };

      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid API key');
    }
  }
}
