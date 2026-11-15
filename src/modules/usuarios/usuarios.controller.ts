import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiMessage, CurrentUser, ForbiddenMessage, Roles } from '../../common/decorators.js';
import type { AuthUser } from '../../common/decorators.js';
import { IdPipe } from '../../common/dto-helpers.js';
import { CreateUsuarioDto, ResetPasswordDto, UpdateUsuarioDto } from './usuarios.dto.js';
import { UsuariosService } from './usuarios.service.js';

const SOLO_ADMIN_USUARIOS =
  'Acceso denegado: solo el rol Administrador puede crear, modificar o eliminar usuarios y auditores.';

@ApiTags('usuarios')
@ApiBearerAuth()
@Controller('usuarios')
export class UsuariosController {
  constructor(@Inject(UsuariosService) private readonly usuarios: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Usuarios para el selector "Auditor responsable" (sin contraseñas)' })
  findAll() {
    return this.usuarios.findAll();
  }

  @Roles('admin')
  @ForbiddenMessage(SOLO_ADMIN_USUARIOS)
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo auditor o administrador (solo admin)' })
  async create(@Body() dto: CreateUsuarioDto) {
    const usuario = await this.usuarios.create(dto);
    return new ApiMessage(`Usuario "${usuario.nombre}" (${usuario.rol}) creado correctamente.`, usuario);
  }

  @Roles('admin')
  @ForbiddenMessage(SOLO_ADMIN_USUARIOS)
  @Put(':id')
  @ApiOperation({ summary: 'Actualizar datos y rol de un usuario (solo admin)' })
  async update(
    @Param('id', IdPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() currentUser: AuthUser,
  ) {
    const usuario = await this.usuarios.update(id, dto, currentUser.id_usuario);
    return new ApiMessage(`Usuario "${usuario.nombre}" actualizado correctamente.`, usuario);
  }

  @Roles('admin')
  @ForbiddenMessage(SOLO_ADMIN_USUARIOS)
  @Patch(':id/password')
  @ApiOperation({ summary: 'Restablecer contraseña de un usuario (solo admin)' })
  async resetPassword(@Param('id', IdPipe) id: number, @Body() dto: ResetPasswordDto) {
    const usuario = await this.usuarios.resetPassword(id, dto.password);
    return new ApiMessage(`Contraseña de "${usuario.nombre}" actualizada correctamente.`, usuario);
  }

  @Roles('admin')
  @ForbiddenMessage(SOLO_ADMIN_USUARIOS)
  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un usuario sin auditorías asignadas (solo admin)' })
  async remove(@Param('id', IdPipe) id: number, @CurrentUser() currentUser: AuthUser) {
    const usuario = await this.usuarios.remove(id, currentUser.id_usuario);
    return new ApiMessage(`Usuario "${usuario.nombre}" eliminado correctamente.`, usuario);
  }
}
