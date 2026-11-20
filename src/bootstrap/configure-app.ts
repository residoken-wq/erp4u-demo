import * as fs from 'fs';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { validateSecurityConfig } from '../common/security/secrets';
import { isCorsOriginAllowed } from '../common/utils/cors.util';

export interface ConfigureCoreAppOptions {
  corsOrigins?: string[];
  uploadDir?: string;
  bodyLimit?: string;
  globalPrefix?: string;
  trustProxy?: boolean | number | string;
  skipSecurityValidation?: boolean;
}

/**
 * Common configuration for ERP4U core application.
 * Used by both standalone core (main.ts) and cloud wrapper (erp4u-cloud).
 */
export async function configureCoreApp(
  app: NestExpressApplication,
  opts?: ConfigureCoreAppOptions,
): Promise<void> {
  if (!opts?.skipSecurityValidation) {
    validateSecurityConfig();
  }

  // Trust reverse proxy (Nginx / NPM) for X-Forwarded-* headers
  app.set('trust proxy', opts?.trustProxy ?? 1);

  // Create uploads folder if not exists
  const uploadDir = opts?.uploadDir || join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Serve Static Assets (Uploads)
  app.useStaticAssets(uploadDir, {
    prefix: '/uploads',
  });

  // Increase body size limit
  const bodyParser = await import('body-parser');
  const bodyLimit = opts?.bodyLimit || '50mb';
  app.use(bodyParser.json({ limit: bodyLimit }));
  app.use(bodyParser.urlencoded({ limit: bodyLimit, extended: true }));

  // Global API prefix
  app.setGlobalPrefix(opts?.globalPrefix || 'api');

  // Dynamic CORS for demo & local development
  const allowedOrigins =
    opts?.corsOrigins ||
    (process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'http://localhost:8080',
        ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, allowedOrigins, process.env.NODE_ENV)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  if (!opts?.skipSecurityValidation) {
    validateSecurityConfig();
  }
}
