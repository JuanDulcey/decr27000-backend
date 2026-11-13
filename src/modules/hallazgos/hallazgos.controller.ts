import { Body, Controller, Delete, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage } from '../../common/decorators.js';
import { IdPipe } from '../../common/dto-helpers.js';
import { HallazgoDto, RecomendacionDto, UpdateHallazgoDto, UpdateRecomendacionDto } from './hallazgos.dto.js';
import { HallazgosService } from './hallazgos.service.js';

@ApiTags('hallazgos')
@ApiBearerAuth()
@Controller()
export class HallazgosController {
  constructor(@Inject(HallazgosService) private readonly hallazgos: HallazgosService) {}

  @Get('auditorias/:id/hallazgos')
  @ApiOperation({ summary: 'Hallazgos de la auditoría con su control y recomendaciones' })
  findByAuditoria(@Param('id', IdPipe) id: number) {
    return this.hallazgos.findByAuditoria(id);
  }

  @Post('evaluaciones/:id/hallazgos')
  @ApiOperation({ summary: 'Registrar hallazgo H-nn con recomendación inicial opcional (RF05, CP-07)' })
  async create(@Param('id', IdPipe) id: number, @Body() dto: HallazgoDto) {
    const hallazgo = await this.hallazgos.create(id, dto);
    return new ApiMessage(`Hallazgo ${hallazgo.codigo} registrado exitosamente.`, hallazgo);
  }

  @Put('hallazgos/:id')
  @ApiOperation({ summary: 'Editar hallazgo' })
  async update(@Param('id', IdPipe) id: number, @Body() dto: UpdateHallazgoDto) {
    return new ApiMessage('Hallazgo actualizado.', await this.hallazgos.update(id, dto));
  }

  @Delete('hallazgos/:id')
  @ApiOperation({ summary: 'Eliminar hallazgo y sus recomendaciones' })
  async remove(@Param('id', IdPipe) id: number) {
    const hallazgo = await this.hallazgos.remove(id);
    return new ApiMessage(`Hallazgo ${hallazgo?.codigo} eliminado junto con sus recomendaciones.`, hallazgo);
  }

  @ApiTags('recomendaciones')
  @Post('hallazgos/:id/recomendaciones')
  @ApiOperation({ summary: 'Asociar recomendación a un hallazgo (RF06, CP-08)' })
  async createRecomendacion(@Param('id', IdPipe) id: number, @Body() dto: RecomendacionDto) {
    return new ApiMessage('Recomendación asociada al hallazgo.', await this.hallazgos.createRecomendacion(id, dto));
  }

  @ApiTags('recomendaciones')
  @Put('recomendaciones/:id')
  @ApiOperation({ summary: 'Editar recomendación' })
  async updateRecomendacion(@Param('id', IdPipe) id: number, @Body() dto: UpdateRecomendacionDto) {
    return new ApiMessage('Recomendación actualizada.', await this.hallazgos.updateRecomendacion(id, dto));
  }

  @ApiTags('recomendaciones')
  @Delete('recomendaciones/:id')
  @ApiOperation({ summary: 'Eliminar recomendación' })
  async removeRecomendacion(@Param('id', IdPipe) id: number) {
    return new ApiMessage('Recomendación eliminada.', await this.hallazgos.removeRecomendacion(id));
  }
}
