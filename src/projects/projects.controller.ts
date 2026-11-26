import { Perm } from '../auth/permissions.decorator';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';
import { RequiresPackage } from '../common/packages/requires-package.decorator';
import { PackageKey } from '../common/packages/package.registry';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { assertPermission } from '../auth/rbac-assert.helper';
import { CostVisible } from '../auth/cost-visibility';

@Controller('projects')
@RequiresPackage(PackageKey.PROJECTS)
@UseGuards(JwtAuthGuard)
@CostVisible({ modules: ['PROJECTS', 'FINANCE'] })
export class ProjectsController {
  constructor(
    private readonly service: ProjectsService,
    @Optional()
    @Inject(forwardRef(() => PermissionCacheService))
    private readonly permCacheService?: PermissionCacheService,
  ) {}

  @Perm('PROJECTS', 'view')
  @Get()
  async findAll(@Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'view');
    return this.service.findAll(req.user);
  }

  @Perm('PROJECTS', 'view')
  @Get(':id')
  async findOne(@Param('id') id: number, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'view');
    return this.service.findOne(id, req.user);
  }

  @Perm('PROJECTS', 'create')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'create');
    return this.service.create(body, req.user);
  }

  @Perm('PROJECTS', 'update')
  @Put(':id')
  async update(@Param('id') id: number, @Body() body: any, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'update');
    return this.service.update(id, body);
  }

  @Perm('PROJECTS', 'delete')
  @Delete(':id')
  async remove(@Param('id') id: number, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'delete');
    return this.service.remove(id);
  }

  // --- SO PROJECT ---
  @Perm('PROJECTS', 'create')
  @Post('from-so/:soId')
  async createFromSO(@Param('soId') soId: number, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'create');
    return this.service.createSOProject(soId);
  }

  // --- COST SUMMARY ---
  @Perm('PROJECTS', 'view')
  @Get(':id/cost-summary')
  async getCostSummary(@Param('id') id: number, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'view');
    return this.service.getCostSummary(id);
  }

  // Milestones
  @Perm('PROJECTS', 'create')
  @Post(':id/milestones')
  async addMilestone(@Param('id') id: number, @Body() body: any, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'create');
    return this.service.addMilestone(id, body);
  }

  @Perm('PROJECTS', 'update')
  @Put('milestones/:milestoneId')
  async updateMilestone(
    @Param('milestoneId') milestoneId: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'update');
    return this.service.updateMilestone(milestoneId, body);
  }

  @Perm('PROJECTS', 'delete')
  @Delete('milestones/:milestoneId')
  async removeMilestone(
    @Param('milestoneId') milestoneId: number,
    @Req() req: any,
  ) {
    await assertPermission(req?.user, this.permCacheService, 'PROJECTS', 'delete');
    return this.service.removeMilestone(milestoneId);
  }
}
