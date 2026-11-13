import { Body, Controller, Get, HttpCode, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../../common/decorators.js';
import { IdPipe } from '../../common/dto-helpers.js';
import { AuditoriaDto, CambioEstadoDto, SeleccionControlesDto } from './auditorias.dto.js';
import { AuditoriasService } from './auditorias.service.js';

const ETIQUETA: Record<string, string> = {
  BORRADOR: 'BORRADOR',
  EN_EJECUCION: 'EN EJECUCIÓN',
  EN_REVISION: 'EN REVISIÓN',
  CERRADA: 'CERRADA',
};

@ApiTags('auditorias')
@ApiBearerAuth()
@Controller('auditorias')
export class AuditoriasController {
  constructor(@Inject(AuditoriasService) private readonly auditorias: AuditoriasService) {}

  @Get()
  @ApiOperation({ summary: 'Auditorías con métricas resumidas' })
  findAll() {
    return this.auditorias.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de la auditoría con indicadores y verificación de cierre' })
  findOne(@Param('id', IdPipe) id: number) {
    return this.auditorias.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear auditoría en estado BORRADOR (RF01, CP-01, CP-02)' })
  async create(@Body() dto: AuditoriaDto) {
    return new ApiMessage('Auditoría creada en estado BORRADOR.', await this.auditorias.create(dto));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Editar datos generales (bloqueado si está CERRADA)' })
  async update(@Param('id', IdPipe) id: number, @Body() dto: AuditoriaDto) {
    return new ApiMessage('Datos de la auditoría actualizados correctamente.', await this.auditorias.update(id, dto));
  }

  @Patch(':id/estado')
  @ApiOperation({ summary: 'Cambiar estado del ciclo de vida (RN02, RN04, RN06, CP-08)' })
  async cambiarEstado(@Param('id', IdPipe) id: number, @Body() dto: CambioEstadoDto) {
    const auditoria = await this.auditorias.cambiarEstado(id, dto.estado);
    return new ApiMessage(`Estado de la auditoría actualizado a ${ETIQUETA[auditoria.estado]}.`, auditoria);
  }

  @Get(':id/verificacion-cierre')
  @ApiOperation({ summary: 'Checklist en vivo de las reglas de revisión y cierre' })
  verificacionCierre(@Param('id', IdPipe) id: number) {
    return this.auditorias.verificacionCierre(id);
  }

  @Put(':id/seleccion-controles')
  @HttpCode(200)
  @ApiOperation({ summary: 'Guardar la selección de 10 a 15 controles (RF02, CP-03)' })
  async guardarSeleccion(@Param('id', IdPipe) id: number, @Body() dto: SeleccionControlesDto) {
    const r = await this.auditorias.guardarSeleccion(id, dto.controles_ids);
    return new ApiMessage(
      `Selección de ${r.controles_seleccionados} controles guardada (${r.agregados} agregado(s), ` +
        `${r.retirados} retirado(s)). Estado: ${ETIQUETA[r.estado]}.`,
      r,
    );
  }
}
