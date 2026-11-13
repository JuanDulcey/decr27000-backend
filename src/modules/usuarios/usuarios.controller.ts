import { Controller, Get, Inject } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service.js';

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
}
