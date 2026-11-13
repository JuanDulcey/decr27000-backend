import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { runFullSeed } from './seed-runner.js';

/**
 * Arranque liviano (PLAN §2.6, O8): solo comprueba que exista el catálogo.
 * Si las tablas no existen o el catálogo está vacío, inicializa la BD con la semilla.
 * Nunca reinicia una base que ya tiene datos.
 */
@Injectable()
export class InitDbService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitDbService.name);

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const exists = await this.db.one<{ t: string | null }>("SELECT to_regclass('public.control') AS t");
      if (exists?.t) {
        const row = await this.db.one<{ total: number }>('SELECT COUNT(*)::int AS total FROM control');
        if ((row?.total ?? 0) > 0) {
          this.logger.log(`Base de datos lista: ${row?.total} controles en el catálogo.`);
          return;
        }
      }
      this.logger.warn('Base de datos vacía: cargando la semilla oficial (93 controles + Empresa ABC)...');
      const client = await this.db.pool.connect();
      try {
        const { hashed } = await runFullSeed(client, { security: false });
        this.logger.log(`Semilla cargada; ${hashed} contraseñas hasheadas (RLS: aplicar con pnpm db:security).`);
      } finally {
        client.release();
      }
    } catch (err) {
      // No se detiene el servidor: /api/health sigue respondiendo y el error queda en el log.
      this.logger.error(`No se pudo verificar o inicializar la base de datos: ${(err as Error).message}`);
    }
  }
}
