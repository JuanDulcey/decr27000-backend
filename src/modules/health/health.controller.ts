import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public, RawResponse } from '../../common/decorators.js';
import { DatabaseService } from '../../database/database.service.js';
import { StorageService } from '../storage/storage.service.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  /**
   * Barato por defecto: no toca la BD (lo usa Render cada pocos segundos, PLAN O9).
   * Con ?db=1 agrega el estado de la conexión a la BD y del bucket de evidencias
   * (`storage`: UP, DOWN o DISABLED si no está configurado, que es válido).
   */
  @Public()
  @RawResponse()
  @Get()
  @ApiOperation({ summary: 'Estado del servicio (y opcionalmente de la base de datos)' })
  @ApiQuery({ name: 'db', required: false, description: 'Use 1 para verificar la BD y el bucket de evidencias' })
  async health(@Query('db') db?: string) {
    const body: Record<string, unknown> = {
      ok: true,
      status: 'UP',
      service: 'decr27000-backend',
      timestamp: new Date().toISOString(),
    };
    if (db === '1' || db === 'true') {
      const [up, storage] = await Promise.all([this.db.ping(), this.storage.ping()]);
      body.db = up ? 'UP' : 'DOWN';
      body.storage = storage;
      if (!up) body.ok = false;
    }
    return body;
  }
}
