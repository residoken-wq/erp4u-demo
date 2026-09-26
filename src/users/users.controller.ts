import { AuthOnly, Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private readonly service: UsersService) { }

    // --- USER APIs ---
    @AuthOnly()
    @Get()
    getAll() {
        return this.service.getAllUsers();
    }

    @AuthOnly()
    @Get('online')
    getOnline() {
        return this.service.getOnlineUsers();
    }

    @Perm('USERS', 'create')
    @Post()
    create(@Body() body: any) {
        return this.service.createUser(body);
    }

    @Perm('USERS', 'update')
    @Put(':id')
    update(@Param('id') id: number, @Body() body: any) {
        return this.service.updateUser(id, body);
    }

    @Perm('USERS', 'delete')
    @Delete(':id')
    delete(@Param('id') id: number) {
        return this.service.deleteUser(id);
    }

    @AuthOnly()
    @Post(':id/change-password')
    changePass(@Param('id') id: number, @Body() body: any) {
        return this.service.changePassword(id, body.password);
    }

    // --- GROUP APIs ---
    @Perm('USERS', 'view')
    @Get('groups')
    getGroups() {
        return this.service.getAllGroups();
    }

    @Perm('USERS', 'view')
    @Get('groups/:id')
    getGroupDetail(@Param('id') id: number) {
        return this.service.getGroupDetail(id);
    }

    @Perm('USERS', 'create')
    @Post('groups')
    createGroup(@Body() body: any) {
        return this.service.createGroup(body);
    }

    // Update Group + Permission (Gọi service updateGroupPermissions)
    @Perm('USERS', 'create')
    @Post('groups/:id/permissions') // Sửa lại route cho khớp với Frontend gọi
    updatePerms(@Param('id') id: number, @Body() body: any) {
        return this.service.updateGroupPermissions(id, body);
    }

    // API dự phòng nếu frontend gọi route cũ
    @Perm('USERS', 'create')
    @Post('groups/:id/update')
    updateGroup(@Param('id') id: number, @Body() body: any) {
        return this.service.updateGroupPermissions(id, body);
    }
}