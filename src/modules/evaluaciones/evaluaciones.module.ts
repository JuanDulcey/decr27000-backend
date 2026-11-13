import { Module } from '@nestjs/common';
import { EvaluacionesController } from './evaluaciones.controller.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { EvidenciasService } from './evidencias.service.js';

/** Evaluación de controles (RF03) y evidencias (RF04). */
@Module({
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService, EvidenciasService],
})
export class EvaluacionesModule {}
