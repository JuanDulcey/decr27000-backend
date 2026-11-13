import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { AppEnv } from './config/env.js';

/**
 * Orígenes permitidos (CORS con lista blanca, decisión P10):
 * FRONTEND_URL, previews de Vercel del proyecto, localhost y CORS_ORIGINS adicionales.
 */
export function buildCorsOriginCheck(env: Pick<AppEnv, 'FRONTEND_URL' | 'CORS_ORIGINS'>) {
  const exact = new Set([env.FRONTEND_URL, ...env.CORS_ORIGINS]);
  const patterns = [
    /^https:\/\/decr27000-frontend(-[a-z0-9-]+)?\.vercel\.app$/,
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  ];
  return (origin: string | undefined): boolean =>
    !origin || exact.has(origin) || patterns.some((re) => re.test(origin));
}

/** Configuración común de la app; la usan main.ts y las pruebas e2e. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<AppEnv, true>>(ConfigService);
  const env = {
    FRONTEND_URL: config.get('FRONTEND_URL', { infer: true }),
    CORS_ORIGINS: config.get('CORS_ORIGINS', { infer: true }),
  };

  app.setGlobalPrefix('api');
  // La API solo devuelve JSON: la CSP no aplica (y bloquearía la UI de Swagger).
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const isAllowed = buildCorsOriginCheck(env);
  app.enableCors({
    origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) =>
      cb(null, isAllowed(origin)),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const doc = new DocumentBuilder()
      .setTitle('DECR 27000 — AuditSys Mini API')
      .setDescription(
        'API REST para la gestión de auditorías de seguridad de la información ' +
          '(ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022).',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc));
  }

  app.enableShutdownHooks();
}
