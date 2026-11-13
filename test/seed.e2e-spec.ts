import { INestApplication } from '@nestjs/common';
import { ADMIN, AUDITOR, createTestApp, loginAs, resetTestDatabase } from './helpers/app.js';
import { api, NUEVA_AUDITORIA } from './helpers/api.js';

/** POST /api/seed/reset (PLAN B3.4, decisión P6). En las pruebas ALLOW_SEED_RESET=true. */
describe('Restaurar datos demo (POST /api/seed/reset)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('el auditor no puede restaurar → 403', async () => {
    const auditor = api(app, await loginAs(app, AUDITOR));
    const res = await auditor.post('/api/seed/reset', { confirm: 'RESTAURAR-EMPRESA-ABC' }).expect(403);
    expect(res.body.error).toMatch(/solo el rol Administrador/);
  });

  it('frase de confirmación incorrecta → 400', async () => {
    const admin = api(app, await loginAs(app, ADMIN));
    const res = await admin.post('/api/seed/reset', { confirm: 'si' }).expect(400);
    expect(res.body.field).toBe('confirm');
  });

  it('el admin restaura la semilla: desaparecen los datos nuevos y el catálogo se recarga', async () => {
    const admin = api(app, await loginAs(app, ADMIN));
    await admin.post('/api/auditorias', NUEVA_AUDITORIA).expect(201);
    await admin.put('/api/controles/1', { nombre: 'Nombre temporal' }).expect(200);

    const res = await admin.post('/api/seed/reset', { confirm: 'RESTAURAR-EMPRESA-ABC' }).expect(200);
    expect(res.body.message).toMatch(/93 controles/);

    const lista = await admin.get('/api/auditorias').expect(200);
    expect(lista.body.data).toHaveLength(1);
    const control = await admin.get('/api/controles/1').expect(200);
    expect(control.body.data.nombre).toBe('Políticas para la seguridad de la información');
    // Las contraseñas siguen funcionando (quedaron hasheadas).
    await loginAs(app, AUDITOR);
  });
});
