import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AnnouncementType } from './announcement.entity';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
    constructor(private readonly service: AnnouncementsService) { }

    // ==================== ADMIN ENDPOINTS ====================

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

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.service.findOne(+id);
    }

    @Post()
    create(@Body() data: any, @Request() req: any) {
        return this.service.create({
            ...data,
            created_by: req.user.userId
        });
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() data: any) {
        return this.service.update(+id, data);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(+id);
    }

    // ==================== EMPLOYEE ENDPOINTS ====================

    /**
     * Lấy announcements đang hiệu lực cho user hiện tại
     */
    @Get('user/active')
    findActiveForCurrentUser(@Request() req: any) {
        // Lấy department từ user profile nếu có
        const userDepartment = req.user.department;
        return this.service.findActiveForUser(req.user.userId, userDepartment);
    }

    /**
     * Lấy announcements chưa đọc cho user hiện tại
     */
    @Get('user/unread')
    findUnreadForCurrentUser(@Request() req: any) {
        const userDepartment = req.user.department;
        return this.service.findUnreadForUser(req.user.userId, userDepartment);
    }

    /**
     * Đếm số announcements chưa đọc
     */
    @Get('user/unread-count')
    getUnreadCount(@Request() req: any) {
        const userDepartment = req.user.department;
        return this.service.getUnreadCount(req.user.userId, userDepartment);
    }

    /**
     * Đánh dấu announcement đã đọc
     */
    @Post(':id/read')
    markAsRead(@Param('id') id: string, @Request() req: any) {
        return this.service.markAsRead(+id, req.user.userId);
    }

    /**
     * Đánh dấu tất cả announcements đã đọc
     */
    @Post('user/read-all')
    markAllAsRead(@Request() req: any) {
        return this.service.markAllAsRead(req.user.userId);
    }
}
