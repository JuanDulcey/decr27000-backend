import pg from 'pg';

/*
 * Conversión de tipos de PostgreSQL a JSON del contrato:
 * - DATE (1082) se mantiene como 'YYYY-MM-DD' (sin desfase de zona horaria).
 * - NUMERIC (1700), p. ej. cumplimiento_base del informe, como número.
 * - BIGINT (20), p. ej. COUNT(*), como número (los conteos de este dominio son pequeños).
 */
pg.types.setTypeParser(1082, (value: string) => value);
pg.types.setTypeParser(1700, (value: string) => Number.parseFloat(value));
pg.types.setTypeParser(20, (value: string) => Number.parseInt(value, 10));
// TIMESTAMP sin zona (1114): las columnas *_en guardan UTC (zona por defecto de Supabase y Docker).
pg.types.setTypeParser(1114, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));

/** true si la URL apunta a una base local (Docker o PostgreSQL instalado). */
export function isLocalDatabase(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

/**
 * CA de Supabase en formato PEM (Panel de Supabase → Database → SSL Configuration →
 * Download certificate). Se acepta el PEM en DB_SSL_CA (con saltos de línea reales o
 * escritos como "\n") para poder pegarlo como variable de entorno en Render.
 */
export function readSslCa(raw: string | undefined): string | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  return value.replace(/\\n/g, '\n');
}

/**
 * Opciones del pool pensadas para Render gratuito + Supabase Session Pooler (PLAN §2.6, O5):
 * pocas conexiones, keep-alive y tiempos de espera acotados.
 *
 * TLS: si hay CA configurada, se verifica el certificado del servidor. Sin CA, la conexión
 * sigue cifrada pero sin verificar el certificado (el llamador debe advertirlo en el log).
 */
export function buildPoolConfig(url: string, max = 4, sslCa?: string): pg.PoolConfig {
  let ssl: pg.PoolConfig['ssl'] = false;
  if (!isLocalDatabase(url)) {
    ssl = sslCa ? { ca: sslCa, rejectUnauthorized: true } : { rejectUnauthorized: false };
  }
  return {
    connectionString: url,
    ssl,
    max,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    keepAlive: true,
    statement_timeout: 10_000,
    application_name: 'decr27000-backend',
  };
}
