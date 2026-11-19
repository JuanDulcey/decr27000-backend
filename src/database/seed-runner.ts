import { readFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type pg from 'pg';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..');
export const SEED_FILE = path.join(ROOT_DIR, 'SEED_93_CONTROLES_Y_EMPRESA_ABC.sql');
export const SECURITY_FILE = path.join(ROOT_DIR, 'sql', 'security.sql');
export const MIGRATIONS_DIR = path.join(ROOT_DIR, 'sql', 'migrations');

/**
 * Migraciones incrementales sobre una BD que ya existe (la semilla ya trae el esquema final).
 * Cada una declara cómo saber si ya está aplicada, así el arranque solo hace una consulta
 * barata y ejecuta el ALTER únicamente cuando falta (PLAN §2.6, O8).
 */
const MIGRATIONS: Array<{ file: string; applied: string }> = [
  {
    file: '001_evidencia_archivo.sql',
    applied: `SELECT COUNT(*) = 4 AS ok FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'evidencia'
                AND column_name IN ('archivo_key', 'archivo_nombre', 'archivo_tipo', 'archivo_tamano')`,
  },
];

export async function applyPendingMigrations(db: Pick<pg.Pool, 'query'>): Promise<string[]> {
  const aplicadas: string[] = [];
  for (const m of MIGRATIONS) {
    const { rows } = await db.query<{ ok: boolean }>(m.applied);
    if (rows[0]?.ok) continue;
    await db.query(await readFile(path.join(MIGRATIONS_DIR, m.file), 'utf8'));
    aplicadas.push(m.file);
  }
  return aplicadas;
}

const BCRYPT_COST = 10;

/** Hashea con bcrypt toda contraseña de la semilla que aún esté en texto plano. */
export async function hashPlainPasswords(client: pg.ClientBase): Promise<number> {
  const { rows } = await client.query<{ id_usuario: number; password_hash: string }>(
    "SELECT id_usuario, password_hash FROM usuario WHERE password_hash NOT LIKE '$2%'",
  );
  for (const row of rows) {
    const hash = await bcrypt.hash(row.password_hash, BCRYPT_COST);
    await client.query('UPDATE usuario SET password_hash = $1 WHERE id_usuario = $2', [
      hash,
      row.id_usuario,
    ]);
  }
  return rows.length;
}

/** Activa RLS y revoca privilegios de PostgREST (idempotente). */
export async function applySecurity(client: pg.ClientBase): Promise<void> {
  await client.query(await readFile(SECURITY_FILE, 'utf8'));
}

/**
 * Carga la semilla completa (DROP + CREATE + datos de Empresa ABC), hashea las
 * contraseñas y, salvo que se indique lo contrario, aplica la seguridad
 * (RLS + REVOKE), todo en una transacción. ¡Borra todos los datos existentes!
 */
export async function runFullSeed(
  client: pg.ClientBase,
  options: { security?: boolean } = {},
): Promise<{ hashed: number; security: boolean }> {
  const security = options.security ?? true;
  const sql = await readFile(SEED_FILE, 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    const hashed = await hashPlainPasswords(client);
    if (security) await applySecurity(client);
    await client.query('COMMIT');
    return { hashed, security };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}
