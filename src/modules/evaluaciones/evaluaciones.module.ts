import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-node';
import type { AppEnv } from '../../config/env.js';
import { EvaluacionesController } from './evaluaciones.controller.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { EvidenciasService } from './evidencias.service.js';

/** Evaluación de controles (RF03), evidencias (RF04) y sus archivos en el bucket S3. */
@Module({
  imports: [
    // Archivos en memoria (se envían directo al bucket); un solo archivo por petición.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        limits: { fileSize: config.get('EVIDENCIA_MAX_MB', { infer: true }) * 1024 * 1024, files: 1, fields: 5 },
        defParamCharset: 'utf8',
      }),
    }),
  ],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService, EvidenciasService],
})
export class EvaluacionesModule {}
