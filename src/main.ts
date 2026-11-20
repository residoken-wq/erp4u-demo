import * as crypto from 'crypto';

if (!global.crypto) {
  (global as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { isCorsOriginAllowed } from './common/utils/cors.util';
import { configureCoreApp } from './bootstrap/configure-app';
export { isCorsOriginAllowed };

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    await configureCoreApp(app);

    const port = process.env.PORT || 3000;
    const includePremium = process.env.CORE_INCLUDE_PREMIUM !== 'false';
    await app.listen(port, '0.0.0.0');
    console.log('==============================================');
    console.log('🚀 ERP4U Backend API running on port ' + port);
    console.log('📦 Premium Add-ons: ' + (includePremium ? 'ENABLED' : 'DISABLED'));
    console.log('📘 Swagger/API endpoint: http://localhost:' + port + '/api');
    console.log('==============================================');
  } catch (err) {
    console.error('FATAL STARTUP ERROR:', err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== 'test') {
  bootstrap();
}
