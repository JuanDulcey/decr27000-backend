import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public, RawResponse } from '../../common/decorators.js';
import { DatabaseService } from '../../database/database.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  /**
   * Barato por defecto: no toca la BD (lo usa Render cada pocos segundos, PLAN O9).
   * Con ?db=1 agrega el estado de la conexión a la BD.
   */
  @Public()
  @RawResponse()
  @Get()
  @ApiOperation({ summary: 'Estado del servicio (y opcionalmente de la base de datos)' })
  @ApiQuery({ name: 'db', required: false, description: 'Use 1 para verificar la conexión a la BD' })
  async health(@Query('db') db?: string) {
    const body: Record<string, unknown> = {
      ok: true,
      status: 'UP',
      service: 'decr27000-backend',
      timestamp: new Date().toISOString(),
    };
    if (db === '1' || db === 'true') {
      const up = await this.db.ping();
      body.db = up ? 'UP' : 'DOWN';
      if (!up) body.ok = false;
    }
    return body;
  }
}
