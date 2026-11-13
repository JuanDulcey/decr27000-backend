import { Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../../common/decorators.js';
import { IdPipe } from '../../common/dto-helpers.js';
import { InformesService } from './informes.service.js';

@ApiTags('informes')
@ApiBearerAuth()
@Controller()
export class InformesController {
  constructor(@Inject(InformesService) private readonly informes: InformesService) {}

  @Get('auditorias/:id/indicadores')
  @ApiOperation({ summary: 'Indicadores de cumplimiento con fórmulas explícitas (RF07, CP-09)' })
  indicadores(@Param('id', IdPipe) id: number) {
    return this.informes.indicadoresDe(id);
  }

  @Get('auditorias/:id/trazabilidad')
  @ApiOperation({ summary: 'Matriz Auditoría → Control → Evidencia → Hallazgo → Recomendación (RNF05)' })
  trazabilidad(@Param('id', IdPipe) id: number) {
    return this.informes.trazabilidad(id);
  }

  @Get('auditorias/:id/informes')
  @ApiOperation({ summary: 'Informe en vivo (8 secciones) e historial de versiones (RF08)' })
  informe(@Param('id', IdPipe) id: number) {
    return this.informes.informe(id);
  }

  @Post('auditorias/:id/informes')
  @ApiOperation({ summary: 'Congelar una nueva versión del informe con su snapshot (CP-10)' })
  async generar(@Param('id', IdPipe) id: number) {
    const informe = await this.informes.generar(id);
    return new ApiMessage(
      `Versión v${informe.version_actual} del informe consolidado generada y almacenada en base de datos.`,
      informe,
    );
  }

  @Get('informes/:id')
  @ApiOperation({ summary: 'Versión congelada del informe (snapshot)' })
  version(@Param('id', IdPipe) id: number) {
    return this.informes.version(id);
  }
}
