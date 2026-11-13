import { Body, Controller, Get, Inject, Param, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ApiMessage, ForbiddenMessage, Roles } from '../../common/decorators.js';
import { IdPipe } from '../../common/dto-helpers.js';
import { CreateControlDto, UpdateControlDto } from './controles.dto.js';
import { ControlesService } from './controles.service.js';

const SOLO_ADMIN =
  'Acceso denegado: solo el rol Administrador puede modificar el catálogo normativo ISO/IEC 27002:2022.';

export const SOLO_ADMIN_CATALOGO = SOLO_ADMIN;

@ApiTags('controles')
@ApiBearerAuth()
@Controller('controles')
export class ControlesController {
  constructor(@Inject(ControlesService) private readonly controles: ControlesService) {}

  @Get()
  @ApiOperation({ summary: 'Catálogo de los 93 controles ISO/IEC 27002:2022 (RF02)' })
  @ApiQuery({ name: 'categoria', required: false, enum: ['ORGANIZACIONAL', 'PERSONAS', 'FISICO', 'TECNOLOGICO'] })
  @ApiQuery({ name: 'q', required: false, description: 'Búsqueda por código, nombre o criterio (sin tildes)' })
  findAll(@Query('categoria') categoria?: string, @Query('q') q?: string) {
    return this.controles.findAll({ categoria, q });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un control' })
  findOne(@Param('id', IdPipe) id: number) {
    return this.controles.findOne(id);
  }

  @Roles('admin')
  @ForbiddenMessage(SOLO_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Crear un control en el catálogo (solo admin, CP-13)' })
  async create(@Body() dto: CreateControlDto) {
    const control = await this.controles.create(dto);
    return new ApiMessage(`Control ${control.codigo_iso} creado en el catálogo maestro.`, control);
  }

  @Roles('admin')
  @ForbiddenMessage(SOLO_ADMIN)
  @Put(':id')
  @ApiOperation({ summary: 'Editar criterio o pregunta orientadora (solo admin, CP-13)' })
  async update(@Param('id', IdPipe) id: number, @Body() dto: UpdateControlDto) {
    const control = await this.controles.update(id, dto);
    return new ApiMessage(`Control ${control.codigo_iso} actualizado en el catálogo maestro.`, control);
  }
}

