import { INestApplication } from '@nestjs/common';
import { ADMIN, AUDITOR, createTestApp, loginAs, resetTestDatabase } from './helpers/app.js';
import { Api, api } from './helpers/api.js';

describe('Catálogo de controles ISO/IEC 27002:2022 (RF02, CP-13)', () => {
  let app: INestApplication;
  let auditor: Api;
  let admin: Api;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    auditor = api(app, await loginAs(app, AUDITOR));
    admin = api(app, await loginAs(app, ADMIN));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('lista los 93 controles en orden y con las 4 categorías (37/8/14/34)', async () => {
    const res = await auditor.get('/api/controles').expect(200);
    expect(res.body.data).toHaveLength(93);
    expect(res.body.data[0]).toMatchObject({ id_control: 1, codigo_iso: '5.1', categoria: 'ORGANIZACIONAL' });
    const porCategoria = (cat: string) =>
      res.body.data.filter((c: { categoria: string }) => c.categoria === cat).length;
    expect([porCategoria('ORGANIZACIONAL'), porCategoria('PERSONAS'), porCategoria('FISICO'), porCategoria('TECNOLOGICO')])
      .toEqual([37, 8, 14, 34]);
  });

  it('filtra por categoría y busca sin importar tildes ni mayúsculas', async () => {
    const tec = await auditor.get('/api/controles?categoria=tecnologico').expect(200);
    expect(tec.body.data).toHaveLength(34);
    const busqueda = await auditor.get('/api/controles?q=EVALUACION').expect(200);
    expect(busqueda.body.data.map((c: { codigo_iso: string }) => c.codigo_iso)).toContain('5.25');
    const malware = await auditor.get('/api/controles?q=malware').expect(200);
    expect(malware.body.data[0].codigo_iso).toBe('8.7');
  });

  it('categoría inválida → 400', async () => {
    const res = await auditor.get('/api/controles?categoria=OTRA').expect(400);
    expect(res.body.field).toBe('categoria');
  });

  it('CP-13: el auditor no puede editar el catálogo → 403 con el mensaje oficial', async () => {
    const res = await auditor.put('/api/controles/1', { criterio: 'Cambio no autorizado' }).expect(403);
    expect(res.body.error).toBe(
      'Acceso denegado: solo el rol Administrador puede modificar el catálogo normativo ISO/IEC 27002:2022.',
    );
    await auditor
      .post('/api/controles', {
        codigo_iso: '8.99',
        categoria: 'TECNOLOGICO',
        nombre: 'X',
        criterio: 'X',
        pregunta_orientadora: 'X',
      })
      .expect(403);
  });

  it('CP-13: el admin edita la pregunta orientadora y el cambio se ve de inmediato (caché invalidada)', async () => {
    const res = await admin
      .put('/api/controles/2', { pregunta_orientadora: '¿Están asignados los roles de seguridad?' })
      .expect(200);
    expect(res.body.message).toContain('5.2');
    const control = await auditor.get('/api/controles/2').expect(200);
    expect(control.body.data.pregunta_orientadora).toBe('¿Están asignados los roles de seguridad?');
  });

  it('el código ISO y la categoría no se pueden modificar', async () => {
    const res = await admin.put('/api/controles/2', { codigo_iso: '5.99' }).expect(400);
    expect(res.body.field).toBe('codigo_iso');
  });

  it('el admin no puede crear un control con un código existente → 409', async () => {
    const res = await admin
      .post('/api/controles', {
        codigo_iso: '5.1',
        categoria: 'ORGANIZACIONAL',
        nombre: 'Duplicado',
        criterio: 'X',
        pregunta_orientadora: '¿X?',
      })
      .expect(409);
    expect(res.body.field).toBe('codigo_iso');
  });

  it('identificador inválido → 400 y control inexistente → 404', async () => {
    await auditor.get('/api/controles/abc').expect(400);
    await auditor.get('/api/controles/9999').expect(404);
  });
});
