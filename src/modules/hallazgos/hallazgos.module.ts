import { Module } from '@nestjs/common';
import { HallazgosController } from './hallazgos.controller.js';
import { HallazgosService } from './hallazgos.service.js';

/** Hallazgos (RF05) y recomendaciones (RF06). */
@Module({
  controllers: [HallazgosController],
  providers: [HallazgosService],
})
export class HallazgosModule {}
