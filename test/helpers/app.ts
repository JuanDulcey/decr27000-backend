import { INestApplication } from '@nestjs/common';
import { NodeAdapter } from '@nestjs/platform-node';
import { Test } from '@nestjs/testing';
import pg from 'pg';
import request from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { isLocalDatabase } from '../../src/database/pool.js';
import { runFullSeed } from '../../src/database/seed-runner.js';

export const PASSWORD = 'Audit2026*';
export const AUDITOR = 'ana.auditora@auditsys.edu.co';
export const ADMIN = 'admin@auditsys.edu.co';

/** Restaura la BD de prueba (Docker) con la semilla oficial. Se niega a tocar una BD remota. */
export async function resetTestDatabase(): Promise<void> {
  const url = process.env.DATABASE_URL ?? '';
  if (!isLocalDatabase(url)) {
    throw new Error('Las pruebas e2e solo corren contra una BD local (Docker), nunca contra Supabase.');
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await runFullSeed(client);
  } finally {
    await client.end();
  }
}

/** Levanta la app con la misma configuración que main.ts (NodeAdapter incluido). */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication(new NodeAdapter(), { logger: ['error'] });
  configureApp(app);
  await app.init();
  return app;
}

export async function loginAs(app: INestApplication, correo: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ correo, password: PASSWORD })
    .expect(200);
  return res.body.data.token as string;
}
