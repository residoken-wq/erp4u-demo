import { Controller, Get, Post, Param, UseGuards, Request, Sse, MessageEvent } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Observable } from 'rxjs';
import { map, filter } from 'rxjs/operators';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly service: NotificationsService) { }

    @Get()
    findAll(@Request() req: any) {
        return this.service.findByUser(req.user.id);
    }

    @Post(':id/read')
    read(@Param('id') id: number) {
        return this.service.markAsRead(id);
    }

    @Post('read-all')
    readAll(@Request() req: any) {
        return this.service.markAllRead(req.user.id);
    }

    @Sse('stream')
    stream(@Request() req: any): Observable<MessageEvent> {
        const userId = req.user?.id;
        return this.service.getStream().pipe(
            filter(event => !userId || event.userId === userId),
            map(event => ({
                data: JSON.stringify(event.data),
                type: 'notification',
            }))
        );
    }
}
