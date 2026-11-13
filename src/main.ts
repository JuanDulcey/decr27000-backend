import 'reflect-metadata';
import { Logger, LogLevel } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestNodeApplication, NodeAdapter } from '@nestjs/platform-node';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import type { AppEnv } from './config/env.js';

async function bootstrap(): Promise<void> {
  const production = process.env.NODE_ENV === 'production';
  const logger: LogLevel[] = production
    ? ['error', 'warn', 'log']
    : ['error', 'warn', 'log', 'debug'];

  // NodeAdapter: el adaptador HTTP más rápido de Nest 12 (sobre node:http, sin Express ni Fastify).
  const app = await NestFactory.create<NestNodeApplication>(AppModule, new NodeAdapter(), {
    logger,
  });
  configureApp(app);

  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port, '0.0.0.0');
  Logger.log(`decr27000-backend escuchando en el puerto ${port} (prefijo /api)`, 'Bootstrap');
}

await bootstrap();
