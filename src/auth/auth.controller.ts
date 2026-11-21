import { AuthOnly } from './permissions.decorator';
import { Public } from './public.decorator';
import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PERMISSION_MODULES, ACTION_COLUMN } from './permission-catalog';
import { CorePackage } from '../common/packages/requires-package.decorator';
import {
  RateLimitService,
  LoginRateLimitGuard,
} from '../common/security/rate-limit';

@Controller('auth')
@CorePackage()
export class AuthController {
  constructor(
    private authService: AuthService,
    private rateLimitService: RateLimitService,
  ) {}

  @Public()
  @UseGuards(LoginRateLimitGuard)
  @Post('login')
  async login(@Body() body: any, @Req() req: any) {
    const ip = this.rateLimitService.getClientIp(req);
    const username = this.rateLimitService.normalizeIdentifier(body?.username);
    const user = await this.authService.validateUser(body?.username, body?.password);

    if (!user) {
      // Record failure for IP
      const ipKey = this.rateLimitService.buildKey('login:ip', ip);
      await this.rateLimitService.recordFailure(
        ipKey,
        this.rateLimitService.getLoginIpWindowMs(),
      );

      // Record failure for IP + username
      if (username) {
        const userKey = this.rateLimitService.buildKey(
          'login:account',
          `${ip}:${username}`,
        );
        await this.rateLimitService.recordFailure(
          userKey,
          this.rateLimitService.getLoginUserWindowMs(),
        );
      }

      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
    }

    // Login successful: reset counter for IP + username
    if (username) {
      const userKey = this.rateLimitService.buildKey(
        'login:account',
        `${ip}:${username}`,
      );
      await this.rateLimitService.reset(userKey);
    }

    return this.authService.login(user);
  }

  @AuthOnly()
  @Get('permission-catalog')
  @UseGuards(JwtAuthGuard)
  catalog() {
    return { modules: PERMISSION_MODULES, actions: Object.keys(ACTION_COLUMN) };
  }

  @AuthOnly()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    return this.authService.me(req.user);
  }
}
