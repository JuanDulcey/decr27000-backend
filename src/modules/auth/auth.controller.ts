import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators.js';
import type { AuthUser } from '../../common/decorators.js';
import { LoginRateLimitGuard } from '../../common/guards.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './login.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Public()
  @UseGuards(LoginRateLimitGuard)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Inicia sesión y devuelve un JWT (RNF04)' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.correo, dto.password);
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Usuario de la sesión actual' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id_usuario);
  }
}
