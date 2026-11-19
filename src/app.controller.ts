import { Public } from './auth/public.decorator';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller()
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
            await this.dataSource.query('SELECT 1');
            return { status: 'ok' };
        } catch {
            throw new ServiceUnavailableException({ status: 'error' });
        }
    }
}
