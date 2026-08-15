import * as crypto from 'crypto';

if (!global.crypto) {
  (global as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['error', 'warn', 'log', 'debug'],
    });

    // Create uploads folder if not exists
    const uploadDir = join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Serve Static Assets (Uploads)
    app.useStaticAssets(uploadDir, {
      prefix: '/uploads',
    });

    // Increase body size limit
    const bodyParser = await import('body-parser');
    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

    // Global API prefix
    app.setGlobalPrefix('api');

    // Dynamic CORS for demo & local development
    const allowedOrigins = process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173', 'http://localhost:8080'];

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || process.env.NODE_ENV !== 'production') {
          callback(null, true);
        } else {
          callback(null, true);
        }
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
    });

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    console.log('==============================================');
    console.log('🚀 ERP4U Backend API running on port ' + port);
    console.log('📘 Swagger/API endpoint: http://localhost:' + port + '/api');
    console.log('==============================================');
  } catch (err) {
    console.error('FATAL STARTUP ERROR:', err);
    process.exit(1);
  }
}
bootstrap();
