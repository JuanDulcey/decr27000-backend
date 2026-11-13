import pg from 'pg';

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
