import { Public } from './auth/public.decorator';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CorePackage } from './common/packages/requires-package.decorator';
import { DEFAULT_TENANT_CONTEXT, TenantContext } from './common/tenancy/tenant-context';

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
}
