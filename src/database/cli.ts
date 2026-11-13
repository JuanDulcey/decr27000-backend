import { existsSync } from 'node:fs';
import pg from 'pg';
import { buildPoolConfig, readSslCa } from './pool.js';

/** Carga .env (si existe) y devuelve un cliente conectado a DATABASE_URL. */
export async function connectFromEnv(): Promise<{ client: pg.Client; url: string }> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL no está definida (revise el archivo .env).');
  const { max: _max, idleTimeoutMillis: _idle, ...config } = buildPoolConfig(
    url,
    1,
    readSslCa(process.env.DB_SSL_CA),
  );
  const client = new pg.Client({ ...config, statement_timeout: 60_000 });
  await client.connect();
  return { client, url };
}

/** Host sin credenciales, para mostrar en consola. */
export function describeHost(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || '5432'}${u.pathname}`;
  } catch {
    return '(URL inválida)';
  }
}
