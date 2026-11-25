import { Public } from './auth/public.decorator';
import { Controller, Get, ServiceUnavailableException, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { DataSource } from 'typeorm';
import { CorePackage } from './common/packages/requires-package.decorator';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from './common/tenancy/tenant-context';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { handleProxyImage } from './common/security/proxy-image.util';

@Controller()
@CorePackage()
export class AppController {
    constructor(private readonly dataSource: DataSource) {}

    @Public()
    @Get('test')
    test() {
        return { status: 'OK', message: 'Server is running', timestamp: new Date().toISOString() };
    }

    @Public()
    @Get('health')
    async health() {
        try {
            const store = TenantContext.getStore();
            if (store) {
                await this.dataSource.query('SELECT 1');
            } else {
                await TenantContext.run(DEFAULT_TENANT_CONTEXT, async () => {
                    await this.dataSource.query('SELECT 1');
                });
            }
            return { status: 'ok' };
        } catch {
            throw new ServiceUnavailableException({ status: 'error' });
        }
    }

    @UseGuards(JwtAuthGuard)
    @Get('proxy-image')
    async proxyImage(@Query('url') url: string, @Res() res: Response) {
        return handleProxyImage(url, res);
    }
}
