import { Module } from '@nestjs/common';
import { InformesController } from './informes.controller.js';
import { InformesService } from './informes.service.js';

/** Indicadores (RF07), trazabilidad (RNF05) e informes versionados (RF08). */
@Module({
  controllers: [InformesController],
  providers: [InformesService],
})
export class InformesModule {}
