/**
 * pnpm db:seed — Restaura la BD con SEED_93_CONTROLES_Y_EMPRESA_ABC.sql.
 * BORRA TODOS LOS DATOS. Contra una base remota (Supabase) exige:
 *   SEED_CONFIRM=RESTAURAR-EMPRESA-ABC pnpm db:seed
 * Con SEED_SECURITY=false no aplica RLS/REVOKE (solo semilla + hash de contraseñas).
 */
import { connectFromEnv, describeHost } from './cli.js';
import { isLocalDatabase } from './pool.js';
import { runFullSeed } from './seed-runner.js';

const CONFIRM_PHRASE = 'RESTAURAR-EMPRESA-ABC';

async function main(): Promise<void> {
  const { client, url } = await connectFromEnv();
  try {
    const host = describeHost(url);
    if (!isLocalDatabase(url) && process.env.SEED_CONFIRM !== CONFIRM_PHRASE) {
      console.error(
        `\nRechazado: ${host} no es una base local y la semilla BORRA TODOS LOS DATOS.\n` +
          `Si de verdad quiere restaurarla, ejecute:\n  SEED_CONFIRM=${CONFIRM_PHRASE} pnpm db:seed\n`,
      );
      process.exitCode = 1;
      return;
    }
    // SEED_SECURITY=false omite RLS/REVOKE (decisión del equipo; se puede aplicar luego con db:security).
    const withSecurity = process.env.SEED_SECURITY?.trim().toLowerCase() !== 'false';
    console.log(`Cargando semilla en ${host} ${withSecurity ? '(con seguridad)' : '(sin RLS/REVOKE)'} ...`);
    const { hashed, security } = await runFullSeed(client, { security: withSecurity });
    const { rows } = await client.query<{ controles: number; auditorias: number }>(
      'SELECT (SELECT COUNT(*) FROM control)::int AS controles, (SELECT COUNT(*) FROM auditoria)::int AS auditorias',
    );
    console.log(
      `Listo: ${rows[0].controles} controles, ${rows[0].auditorias} auditoría(s), ${hashed} contraseña(s) hasheada(s), ` +
        `${security ? 'RLS aplicado' : 'RLS no aplicado'}.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err: Error) => {
  console.error(`Error al cargar la semilla: ${err.message}`);
  process.exitCode = 1;
});
