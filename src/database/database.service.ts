import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pg from 'pg';
import type { AppEnv } from '../config/env.js';
import { buildPoolConfig, isLocalDatabase } from './pool.js';

export type Queryable = pg.Pool | pg.PoolClient;

/**
 * Acceso a PostgreSQL con SQL parametrizado y sin ORM (decisión P1).
 * Un solo pool por proceso, reutilizado por todos los módulos.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly pool: pg.Pool;

  constructor(@Inject(ConfigService) config: ConfigService<AppEnv, true>) {
    const url = config.get('DATABASE_URL', { infer: true });
    const sslCa = config.get('DB_SSL_CA', { infer: true });
    this.pool = new pg.Pool(buildPoolConfig(url, config.get('DB_POOL_MAX', { infer: true }), sslCa));
    this.pool.on('error', (err) => this.logger.error(`Error inesperado en el pool: ${err.message}`));
    if (!sslCa && !isLocalDatabase(url)) {
      this.logger.warn(
        'DB_SSL_CA no está configurada: la conexión a la BD va cifrada pero sin verificar el certificado. ' +
          'Descargue la CA desde Supabase y defínala en DB_SSL_CA.',
      );
    }
  }

  async query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client: Queryable = this.pool,
  ): Promise<T[]> {
    const result = await client.query<T>(text, params);
    return result.rows;
  }

  async one<T extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    params: unknown[] = [],
    client: Queryable = this.pool,
  ): Promise<T | null> {
    const rows = await this.query<T>(text, params, client);
    return rows[0] ?? null;
  }

  /** Ejecuta fn dentro de una transacción; hace ROLLBACK si fn lanza un error. */
  async withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
