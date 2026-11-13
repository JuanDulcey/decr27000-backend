import { Body, Controller, HttpCode, Inject, Injectable, Module, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString } from 'class-validator';
import { AppError } from '../../common/app-error.js';
import { ApiMessage, ForbiddenMessage, Roles } from '../../common/decorators.js';
import type { AppEnv } from '../../config/env.js';
import { DatabaseService } from '../../database/database.service.js';
import { runFullSeed } from '../../database/seed-runner.js';
import { ControlesModule } from '../controles/controles.module.js';
import { ControlesService } from '../controles/controles.service.js';

export const FRASE_CONFIRMACION = 'RESTAURAR-EMPRESA-ABC';

class ResetDto {
  @ApiProperty({ example: FRASE_CONFIRMACION })
  @IsString({ message: `Escriba la frase de confirmación ${FRASE_CONFIRMACION}.` })
  confirm: string;
}

@Injectable()
export class SeedService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(ConfigService) private readonly config: ConfigService<AppEnv, true>,
    @Inject(ControlesService) private readonly controles: ControlesService,
  ) {}

  /** Restaura la semilla oficial (PLAN B3.4, decisión P6). Respeta la decisión de no aplicar RLS. */
  async reset(confirm: string): Promise<void> {
    if (!this.config.get('ALLOW_SEED_RESET', { infer: true })) {
      throw AppError.forbidden(
        'La restauración de datos demo está deshabilitada en este entorno (ALLOW_SEED_RESET=false).',
      );
    }
    if (confirm !== FRASE_CONFIRMACION) {
      throw AppError.badRequest(
        `Frase de confirmación incorrecta. Escriba exactamente ${FRASE_CONFIRMACION}.`,
        'confirm',
      );
    }
    const client = await this.db.pool.connect();
    try {
      await runFullSeed(client, { security: false });
    } finally {
      client.release();
    }
    this.controles.invalidate();
  }
}

@ApiTags('seed')
@ApiBearerAuth()
@Controller('seed')
class SeedController {
  constructor(@Inject(SeedService) private readonly seed: SeedService) {}

  @Roles('admin')
  @ForbiddenMessage('Acceso denegado: solo el rol Administrador puede restaurar los datos demo.')
  @Post('reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restaurar 93 controles + Empresa ABC (solo admin, ALLOW_SEED_RESET=true)' })
  async reset(@Body() dto: ResetDto) {
    await this.seed.reset(dto.confirm);
    return new ApiMessage('Base de datos restaurada con los 93 controles ISO 27002:2022 y el caso Empresa ABC.', null);
  }
}

@Module({
  imports: [ControlesModule],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
