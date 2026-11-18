import { Public } from './auth/public.decorator';
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
    @Public()
    @Get('test')
    test() {
        return { status: 'OK', message: 'Server is running', timestamp: new Date().toISOString() };
    }
}
