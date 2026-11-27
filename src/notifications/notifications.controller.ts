import {
    Controller,
    Get,
    Post,
    Param,
    UseGuards,
    Request,
    Res,
    UnauthorizedException,
    BadRequestException,
    Optional,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthOnly } from '../auth/permissions.decorator';
import { CorePackage } from '../common/packages/requires-package.decorator';
import { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { TenantContext, DEFAULT_TENANT_CONTEXT, isTenancyStrict } from '../common/tenancy/tenant-context';

@Controller('notifications')
@CorePackage()
@UseGuards(JwtAuthGuard) // <--- SECURE ENDPOINT
@AuthOnly()
export class NotificationsController {
    constructor(
        private readonly service: NotificationsService,
        @Optional() private readonly jwtService?: JwtService,
    ) { }

    @Get('stream')
    stream(
        @Request() req: any,
        @Res() res: Response,
    ) {
        if (req.query?.token || req.query?.access_token) {
            throw new UnauthorizedException('Token via query string is not accepted');
        }

        const userId = req.user?.id || req.user?.userId;
        let tenantId: string;
        try {
            if (isTenancyStrict() && !TenantContext.getStore()) {
                throw new UnauthorizedException('Tenant context is required');
            }
            if ((req.user?.tid || req.headers?.['x-tenant-id']) && !TenantContext.getStore()) {
                throw new UnauthorizedException('Tenant context is required');
            }
            tenantId = TenantContext.current().tenantId;
        } catch (err) {
            if (err instanceof UnauthorizedException || err instanceof BadRequestException) {
                throw err;
            }
            throw new UnauthorizedException('Tenant context is required');
        }

        let jwtExp: number | undefined;
        const authHeader = req.headers?.authorization || req.headers?.Authorization;
        if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7).trim();
            try {
                if (this.jwtService) {
                    const decoded: any = this.jwtService.decode(token);
                    if (decoded && typeof decoded.exp === 'number') {
                        jwtExp = decoded.exp;
                    }
                } else {
                    const parts = token.split('.');
                    if (parts.length === 3) {
                        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
                        if (payload && typeof payload.exp === 'number') {
                            jwtExp = payload.exp;
                        }
                    }
                }
            } catch {
                // ignore
            }
        }

        this.service.subscribeClient({
            tenantId,
            userId: Number(userId),
            req,
            res,
            jwtExp,
        });
    }

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