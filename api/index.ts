import 'reflect-metadata';
import * as crypto from 'crypto';
if (!global.crypto) {
  (global as any).crypto = crypto;
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();
let isReady = false;
let initPromise: Promise<void> | null = null;

async function bootstrap() {
  server.use(express.json({ limit: '50mb' }));
  server.use(express.urlencoded({ limit: '50mb', extended: true }));

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.init();
  isReady = true;
}

export default async function handler(req: any, res: any) {
  if (!isReady) {
    if (!initPromise) {
      initPromise = bootstrap();
    }
    await initPromise;
  }
  return server(req, res);
}
