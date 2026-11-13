import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, UseGuards } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { AppError } from '../../common/app-error.js';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public } from '../../common/decorators.js';
import type { AuthUser } from '../../common/decorators.js';
import { clientIp, LoginRateLimitGuard } from '../../common/guards.js';
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
  async login(@Body() dto: LoginDto, @Req() req: IncomingMessage) {
    const ip = clientIp(req);
    try {
      const sesion = await this.auth.login(dto.correo, dto.password);
      LoginRateLimitGuard.reset(ip);
      return sesion;
    } catch (err) {
      if (err instanceof AppError && err.getStatus() === HttpStatus.UNAUTHORIZED) {
        LoginRateLimitGuard.registerFailure(ip);
      }
      throw err;
    }
  }

  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Usuario de la sesión actual' })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id_usuario);
  }
}
