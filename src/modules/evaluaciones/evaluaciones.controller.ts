import { Body, Controller, Delete, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../../common/decorators.js';
import { IdPipe } from '../../common/dto-helpers.js';
import { EvaluacionDto, EvidenciaDto } from './evaluaciones.dto.js';
import { EvaluacionesService } from './evaluaciones.service.js';
import { EvidenciasService } from './evidencias.service.js';

@ApiTags('evaluaciones')
@ApiBearerAuth()
@Controller()
export class EvaluacionesController {
  constructor(
    @Inject(EvaluacionesService) private readonly evaluaciones: EvaluacionesService,
    @Inject(EvidenciasService) private readonly evidencias: EvidenciasService,
  ) {}

  @Get('auditorias/:id/evaluaciones')
  @ApiOperation({ summary: 'Controles seleccionados con evidencias, hallazgos y recomendaciones' })
  findByAuditoria(@Param('id', IdPipe) id: number) {
    return this.evaluaciones.findByAuditoria(id);
  }

  @Put('evaluaciones/:id')
  @ApiOperation({ summary: 'Evaluar un control (RF03, CP-04, CP-05)' })
  async update(@Param('id', IdPipe) id: number, @Body() dto: EvaluacionDto) {
    return new ApiMessage('Evaluación del control guardada correctamente.', await this.evaluaciones.update(id, dto));
  }

  @ApiTags('evidencias')
  @Post('evaluaciones/:id/evidencias')
  @ApiOperation({ summary: 'Registrar evidencia con código EV-nn (RF04, CP-06)' })
  async createEvidencia(@Param('id', IdPipe) id: number, @Body() dto: EvidenciaDto) {
    const evidencia = await this.evidencias.create(id, dto);
    return new ApiMessage(`Evidencia ${evidencia.codigo_evidencia} registrada.`, evidencia);
  }

  @ApiTags('evidencias')
  @Delete('evidencias/:id')
  @ApiOperation({ summary: 'Eliminar evidencia (bloqueado si la auditoría está CERRADA)' })
  async removeEvidencia(@Param('id', IdPipe) id: number) {
    const evidencia = await this.evidencias.remove(id);
    return new ApiMessage(`Evidencia ${evidencia.codigo_evidencia} eliminada.`, evidencia);
  }
}
