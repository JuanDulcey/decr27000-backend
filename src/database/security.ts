/**
 * pnpm db:security — Activa RLS y revoca privilegios de PostgREST (anon/authenticated)
 * y hashea contraseñas que sigan en texto plano. No borra datos; es idempotente.
 */
import { connectFromEnv, describeHost } from './cli.js';
import { applySecurity, hashPlainPasswords } from './seed-runner.js';

async function main(): Promise<void> {
  const { client, url } = await connectFromEnv();
  try {
    console.log(`Aplicando seguridad en ${describeHost(url)} ...`);
    await client.query('BEGIN');
    await applySecurity(client);
    const hashed = await hashPlainPasswords(client);
    await client.query('COMMIT');
    const { rows } = await client.query<{ tabla: string; rls: boolean }>(
      `SELECT c.relname AS tabla, c.relrowsecurity AS rls
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY 1`,
    );
    rows.forEach((r) => console.log(`  ${r.rls ? 'RLS activo   ' : 'RLS INACTIVO '} ${r.tabla}`));
    console.log(`Listo. Contraseñas hasheadas ahora: ${hashed}.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error(`Error al aplicar la seguridad: ${err.message}`);
  process.exitCode = 1;
});
