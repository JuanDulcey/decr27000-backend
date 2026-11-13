import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AppError } from '../../common/app-error.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Indicadores de la auditoría activa y auditorías recientes (RF09, CP-11)' })
  @ApiQuery({ name: 'id_auditoria', required: false, description: 'Por defecto, la auditoría más reciente' })
  resumen(@Query('id_auditoria') idAuditoria?: string) {
    if (idAuditoria !== undefined && idAuditoria !== '' && !/^\d+$/.test(idAuditoria)) {
      throw AppError.badRequest(`Identificador inválido: "${idAuditoria}".`, 'id_auditoria');
    }
    return this.dashboard.resumen(idAuditoria ? Number(idAuditoria) : undefined);
  }
}
