import { Perm } from './permissions.decorator';
import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RbacModeService } from './rbac-mode.service';
import { RbacAccessLogService } from './rbac-access-log.service';
import { PermissionCacheService } from './permission-cache.service';
import { CorePackage } from '../common/packages/requires-package.decorator';

@Controller(['auth/rbac', 'rbac'])
@CorePackage()
@UseGuards(JwtAuthGuard)
export class RbacController {
  constructor(
    private readonly rbacModeService: RbacModeService,
    private readonly logService: RbacAccessLogService,
    private readonly permCacheService: PermissionCacheService,
  ) {}

  @Perm('SYSTEM', 'view')
  @Get('mode')
  async getMode() {
    return this.rbacModeService.getModeInfo();
  }

  @Perm('SYSTEM', 'update')
  @Put('mode')
  async setMode(@Body() body: { mode: string }, @Req() req: any) {
    const user = req.user;
    await this.rbacModeService.setMode(body.mode, user);
    return this.rbacModeService.getModeInfo();
  }

  @Perm('SYSTEM', 'view')
  @Get('readiness')
  async getReadiness(@Query('days') days?: string, @Req() req?: any) {
    const user = req?.user;
    const isAdmin = user?.username === 'admin';
    let hasSystemView = false;
    if (!isAdmin) {
      const groupId = user?.groupId || user?.group_id;
      if (groupId) {
        hasSystemView = await this.permCacheService.hasAny(groupId, [
          { module: 'SYSTEM', action: 'view' },
        ]);
      }
    }
    if (!isAdmin && !hasSystemView) {
      throw new ForbiddenException(
        'Chỉ admin hoặc nhóm có quyền SYSTEM:view mới có thể xem báo cáo sẵn sàng',
      );
    }

    const daysNum = parseInt(days as string, 10) || 7;
    return this.logService.getReadiness(daysNum);
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
