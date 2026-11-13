import { Global, Module } from '@nestjs/common';
import { AuditLockService } from './audit-lock.service.js';
import { IndicadoresService } from './indicadores.service.js';
import { VerificacionService } from './verificacion.service.js';

/** Servicios del dominio auditor compartidos por todos los módulos. */
@Global()
@Module({
  providers: [AuditLockService, IndicadoresService, VerificacionService],
  exports: [AuditLockService, IndicadoresService, VerificacionService],
})
export class CoreModule {}
