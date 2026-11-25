import { AuthOnly, Perm } from '../auth/permissions.decorator';
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { AnnouncementType } from './announcement.entity';
import { CorePackage } from '../common/packages/requires-package.decorator';

@Controller('announcements')
@CorePackage()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AnnouncementsController {
    constructor(private readonly service: AnnouncementsService) { }

    // ==================== ADMIN ENDPOINTS ====================

    @Perm('USERS', 'view')
    @Get()
    findAll(
        @Query('type') type?: AnnouncementType,
        @Query('is_active') isActive?: string,
    ) {
        return this.service.findAll({
            type,
            is_active: isActive !== undefined ? isActive === 'true' : undefined
        });
    }

    @Perm('USERS', 'view')
    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(+id);
    }

    @Perm('USERS', 'create')
    @Post()
    create(@Body() data: any, @Request() req: any) {
        return this.service.create({
            ...data,
            created_by: req.user.userId || req.user.id
        });
    }

    @Perm('USERS', 'update')
    @Put(':id')
    update(@Param('id') id: string, @Body() data: any) {
        return this.service.update(+id, data);
    }

    @Perm('USERS', 'delete')
    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(+id);
    }

    // ==================== EMPLOYEE ENDPOINTS ====================

    /**
     * Lấy announcements đang hiệu lực cho user hiện tại (lọc theo group của token)
     */
    @AuthOnly()
    @Get('user/active')
    findActiveForCurrentUser(@Request() req: any) {
        const userId = req.user.userId || req.user.id;
        const groupId = req.user.groupId;
        return this.service.findActiveForUser(userId, groupId);
    }

    /**
     * Lấy announcements chưa đọc cho user hiện tại (lọc theo group của token)
     */
    @AuthOnly()
    @Get('user/unread')
    findUnreadForCurrentUser(@Request() req: any) {
        const userId = req.user.userId || req.user.id;
        const groupId = req.user.groupId;
        return this.service.findUnreadForUser(userId, groupId);
    }

    /**
     * Đếm số announcements chưa đọc (lọc theo group của token)
     */
    @AuthOnly()
    @Get('user/unread-count')
    getUnreadCount(@Request() req: any) {
        const userId = req.user.userId || req.user.id;
        const groupId = req.user.groupId;
        return this.service.getUnreadCount(userId, groupId);
    }

    /**
     * Đánh dấu announcement đã đọc (@AuthOnly)
     */
    @AuthOnly()
    @Post(':id/read')
    markAsRead(@Param('id') id: string, @Request() req: any) {
        const userId = req.user.userId || req.user.id;
        const groupId = req.user.groupId;
        return this.service.markAsRead(+id, userId, groupId);
    }

    /**
     * Đánh dấu tất cả announcements đã đọc (@AuthOnly)
     */
    @AuthOnly()
    @Post('user/read-all')
    markAllAsRead(@Request() req: any) {
        const userId = req.user.userId || req.user.id;
        const groupId = req.user.groupId;
        return this.service.markAllAsRead(userId, groupId);
    }
}
