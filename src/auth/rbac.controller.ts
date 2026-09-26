import { Perm } from './permissions.decorator';
import { Controller, Get, Put, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { RbacModeService } from './rbac-mode.service';
import { RbacAccessLogService } from './rbac-access-log.service';

@Controller('auth/rbac')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class RbacController {
  constructor(
    private readonly rbacModeService: RbacModeService,
    private readonly logService: RbacAccessLogService,
  ) {}

  @Perm('SYSTEM', 'view')
  @Get('mode')
  async getMode() {
    const mode = await this.rbacModeService.get();
    return { mode };
  }

  @Perm('SYSTEM', 'update')
  @Put('mode')
  async setMode(@Body() body: { mode: string }, @Req() req: any) {
    const username = req.user?.username || 'admin';
    const mode = await this.rbacModeService.setMode(body.mode, username);
    return { mode };
  }

  @Perm('SYSTEM', 'view')
  @Get('report')
  async getReport(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('decision') decision?: string,
  ) {
    return this.logService.getReport(from, to, decision);
  }

  @Perm('SYSTEM', 'view')
  @Get('unclassified')
  async getUnclassified() {
    return this.logService.getUnclassifiedRoutes();
  }
}
