import { Body, Controller, Delete, Get, Inject, Param, Post, Put, Query, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-node';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AppEnv } from '../../config/env.js';
import type { ArchivoSubido } from './archivos.js';
import { ApiMessage, RawResponse } from '../../common/decorators.js';
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
    @Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>,
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

  @ApiTags('evidencias')
  @Post('evidencias/:id/archivo')
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { archivo: { type: 'string', format: 'binary' } }, required: ['archivo'] },
  })
  @ApiOperation({ summary: 'Adjuntar o reemplazar el archivo de una evidencia (bucket S3, máx. EVIDENCIA_MAX_MB)' })
  async adjuntarArchivo(@Param('id', IdPipe) id: number, @UploadedFile() archivo?: ArchivoSubido) {
    const evidencia = await this.evidencias.adjuntarArchivo(
      id,
      archivo,
      this.config.get('EVIDENCIA_MAX_MB', { infer: true }),
    );
    return new ApiMessage(
      `Archivo "${evidencia.archivo_nombre}" adjuntado a la evidencia ${evidencia.codigo_evidencia}.`,
      evidencia,
    );
  }

  @ApiTags('evidencias')
  @Get('evidencias/:id/archivo')
  @ApiOperation({ summary: 'Enlace de descarga o vista previa temporal (5 min) del archivo de la evidencia' })
  enlaceDescarga(@Param('id', IdPipe) id: number, @Query('inline') inline?: string) {
    return this.evidencias.enlaceDescarga(id, inline === '1' || inline === 'true');
  }

  @ApiTags('evidencias')
  @Get('evidencias/:id/contenido')
  @RawResponse()
  @ApiOperation({ summary: 'Contenido del archivo para vista previa autenticada sin bloqueo de iframe' })
  async contenidoArchivo(@Param('id', IdPipe) id: number): Promise<StreamableFile> {
    const { buffer, archivo_nombre, archivo_tipo } = await this.evidencias.obtenerContenido(id);
    const ascii = archivo_nombre.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    return new StreamableFile(buffer, {
      type: archivo_tipo,
      disposition: `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(archivo_nombre)}`,
    });
  }

  @ApiTags('evidencias')
  @Delete('evidencias/:id/archivo')
  @ApiOperation({ summary: 'Quitar el archivo de la evidencia (la evidencia se conserva)' })
  async quitarArchivo(@Param('id', IdPipe) id: number) {
    const evidencia = await this.evidencias.quitarArchivo(id);
    return new ApiMessage(`Archivo quitado de la evidencia ${evidencia.codigo_evidencia}.`, evidencia);
  }
}
