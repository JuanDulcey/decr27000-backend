import { Module } from '@nestjs/common';
import { AuditoriasController } from './auditorias.controller.js';
import { AuditoriasService } from './auditorias.service.js';

@Module({
  controllers: [AuditoriasController],
  providers: [AuditoriasService],
  exports: [AuditoriasService],
})
export class AuditoriasModule {}
