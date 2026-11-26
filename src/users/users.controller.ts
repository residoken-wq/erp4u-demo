import { AuthOnly, Perm } from '../auth/permissions.decorator';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Inject,
  forwardRef,
  Optional,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { CorePackage } from '../common/packages/requires-package.decorator';
import { PermissionCacheService } from '../auth/permission-cache.service';
import { assertPermission, hasPermission } from '../auth/rbac-assert.helper';

@Controller('users')
@CorePackage()
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly service: UsersService,
    @Optional()
    @Inject(forwardRef(() => PermissionCacheService))
    private readonly permCacheService?: PermissionCacheService,
  ) {}

  // --- USER APIs ---
  // P12b chuyển các màn hình sang /lookups/users
  @AuthOnly()
  @Get()
  async getAll(@Req() req: any) {
    const hasFullView = await hasPermission(req?.user, this.permCacheService, 'USERS', 'view');
    const users = await this.service.getAllUsers();
    if (hasFullView) {
      return users;
    }
    return users.map((u: any) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
      is_active: u.is_active,
      group: u.group ? { id: u.group.id, name: u.group.name } : null,
    }));
  }

  @AuthOnly()
  @Get('online')
  async getOnline(@Req() req: any) {
    const hasFullView = await hasPermission(req?.user, this.permCacheService, 'USERS', 'view');
    const onlineUsers = await this.service.getOnlineUsers();
    if (hasFullView) {
      return onlineUsers;
    }
    return onlineUsers.map((u: any) => ({
      id: u.id,
      username: u.username,
      full_name: u.full_name,
    }));
  }

  @Perm('USERS', 'create')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'create');
    return this.service.createUser(body);
  }

  @Perm('USERS', 'update')
  @Put(':id')
  async update(@Param('id') id: number, @Body() body: any, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'update');
    return this.service.updateUser(+id, body, req?.user);
  }

  @Perm('USERS', 'delete')
  @Delete(':id')
  async delete(@Param('id') id: number, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'delete');
    return this.service.deleteUser(+id, req?.user);
  }

  @AuthOnly()
  @HttpCode(HttpStatus.OK)
  @Post(':id/change-password')
  async changePass(
    @Param('id') id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.service.changePassword(+id, body, req?.user);
  }

  // --- GROUP APIs ---
  @Perm('USERS', 'view')
  @Get('groups')
  async getGroups(@Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'view');
    return this.service.getAllGroups();
  }

  @Perm('USERS', 'view')
  @Get('groups/:id')
  async getGroupDetail(@Param('id') id: number, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'view');
    return this.service.getGroupDetail(+id);
  }

  @Perm('USERS', 'create')
  @Post('groups')
  async createGroup(@Body() body: any, @Req() req: any) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'create');
    return this.service.createGroup(body, req?.user);
  }

  // Update Group + Permission (Gọi service updateGroupPermissions)
  @Perm('USERS', 'create')
  @HttpCode(HttpStatus.OK)
  @Post('groups/:id/permissions') // Sửa lại route cho khớp với Frontend gọi
  async updatePerms(
    @Param('id') id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'create');
    return this.service.updateGroupPermissions(+id, body, req?.user);
  }

  // API dự phòng nếu frontend gọi route cũ
  @Perm('USERS', 'create')
  @HttpCode(HttpStatus.OK)
  @Post('groups/:id/update')
  async updateGroup(
    @Param('id') id: number,
    @Body() body: any,
    @Req() req: any,
  ) {
    await assertPermission(req?.user, this.permCacheService, 'USERS', 'create');
    return this.service.updateGroupPermissions(+id, body, req?.user);
  }
}
