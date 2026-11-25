import { Perm } from './permissions.decorator';
import {
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RbacModeService } from './rbac-mode.service';
import { RbacAccessLogService } from './rbac-access-log.service';
import { PermissionCacheService } from './permission-cache.service';
import { CorePackage } from '../common/packages/requires-package.decorator';
import { assertAdmin, assertPermission } from './rbac-assert.helper';

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
  async getMode(@Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'SYSTEM', 'view');
    return this.rbacModeService.getModeInfo();
  }

  @Perm('SYSTEM', 'update')
  @Put('mode')
  async setMode(@Body() body: { mode: string }, @Req() req: any) {
    const user = req?.user;
    await this.rbacModeService.setMode(body.mode, user);
    return this.rbacModeService.getModeInfo();
  }

  @Perm('SYSTEM', 'view')
  @Get('readiness')
  async getReadiness(@Query('days') days?: string, @Req() req?: any) {
    await assertPermission(req?.user, this.permCacheService, 'SYSTEM', 'view');
    const daysNum = parseInt(days as string, 10) || 7;
    return this.logService.getReadiness(daysNum);
  }

  @Perm('SYSTEM', 'view')
  @Get('report')
  async getReport(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('decision') decision?: string,
  ) {
    assertAdmin(req?.user);
    return this.logService.getReport(from, to, decision);
  }

  @Perm('SYSTEM', 'view')
  @Get('unclassified')
  async getUnclassified(@Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'SYSTEM', 'view');
    return this.logService.getUnclassifiedRoutes();
  }
}
