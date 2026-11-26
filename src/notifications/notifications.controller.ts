import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthOnly } from '../auth/permissions.decorator';
import { CorePackage } from '../common/packages/requires-package.decorator';

@Controller('notifications')
@CorePackage()
@UseGuards(JwtAuthGuard) // <--- SECURE ENDPOINT
@AuthOnly()
export class NotificationsController {
    constructor(private readonly service: NotificationsService) { }

    @Get()
    findAll(@Request() req: any) {
        return this.service.findByUser(req.user.id); // <--- Use ID from Token
    }

    @Post(':id/read')
    read(@Param('id') id: string, @Request() req: any) {
        const userId = req.user.id || req.user.userId;
        return this.service.markAsRead(Number(id), userId);
    }

    @Post('read-all')
    readAll(@Request() req: any) {
        return this.service.markAllRead(req.user.id);
    }
}