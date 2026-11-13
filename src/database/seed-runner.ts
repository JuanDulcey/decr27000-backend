import { readFile } from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import type pg from 'pg';

const ROOT_DIR = path.resolve(import.meta.dirname, '..', '..');
export const SEED_FILE = path.join(ROOT_DIR, 'SEED_93_CONTROLES_Y_EMPRESA_ABC.sql');
export const SECURITY_FILE = path.join(ROOT_DIR, 'sql', 'security.sql');

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
