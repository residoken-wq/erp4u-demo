import { AuthOnly } from './permissions.decorator';
import { Public } from './public.decorator';
import { Controller, Post, Get, Body, Req, UseGuards, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PERMISSION_MODULES, ACTION_COLUMN } from './permission-catalog';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() req: any) {
    const user = await this.authService.validateUser(req.username, req.password);
    if (!user) {
      throw new UnauthorizedException('Sai tên đăng nhập hoặc mật khẩu');
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