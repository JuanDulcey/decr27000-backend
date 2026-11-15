import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LoginRateLimitGuard } from '../src/common/guards.js';
import { ADMIN, AUDITOR, createTestApp, loginAs, PASSWORD, resetTestDatabase } from './helpers/app.js';

describe('Suite de Administración: CRUD de Usuarios/Auditores y Asignación', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => LoginRateLimitGuard.reset());

  it('un auditor NO puede crear, editar ni eliminar usuarios (403)', async () => {
    const auditorToken = await loginAs(app, AUDITOR);

    await request(http)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({
        nombre: 'Nuevo Auditor',
        correo: 'nuevo@auditsys.edu.co',
        password: 'Password2026*',
        rol: 'auditor',
      })
      .expect(403);

    await request(http)
      .put('/api/usuarios/1')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ nombre: 'X', correo: AUDITOR, rol: 'admin' })
      .expect(403);

    await request(http)
      .delete('/api/usuarios/1')
      .set('Authorization', `Bearer ${auditorToken}`)
      .expect(403);
  });

  it('el admin puede crear un auditor, iniciar sesión con él, asignarle una auditoría, cambiar su clave y luego limpiar usuarios sin auditorías', async () => {
    const adminToken = await loginAs(app, ADMIN);

    // 1. Crear nuevo auditor
    const createRes = await request(http)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Laura G. (Auditora Interna)',
        correo: 'Laura.G@AuditSys.edu.co',
        password: 'ClaveInicial2026*',
        rol: 'auditor',
      })
      .expect(201);

    expect(createRes.body.ok).toBe(true);
    expect(createRes.body.data).toMatchObject({
      nombre: 'Laura G. (Auditora Interna)',
      correo: 'laura.g@auditsys.edu.co',
      rol: 'auditor',
    });
    expect(createRes.body.data).not.toHaveProperty('password_hash');
    const newId = createRes.body.data.id_usuario;

    // 2. Correo duplicado -> 409
    const dupRes = await request(http)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Duplicada',
        correo: 'laura.g@auditsys.edu.co',
        password: 'ClaveInicial2026*',
        rol: 'auditor',
      })
      .expect(409);
    expect(dupRes.body.field).toBe('correo');

    // 3. El nuevo auditor puede iniciar sesión
    await request(http)
      .post('/api/auth/login')
      .send({ correo: 'laura.g@auditsys.edu.co', password: 'ClaveInicial2026*' })
      .expect(200);

    // 4. El admin restablece su contraseña
    await request(http)
      .patch(`/api/usuarios/${newId}/password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'NuevaClave2026*' })
      .expect(200);

    await request(http)
      .post('/api/auth/login')
      .send({ correo: 'laura.g@auditsys.edu.co', password: 'NuevaClave2026*' })
      .expect(200);

    // 5. El admin actualiza su nombre
    const updRes = await request(http)
      .put(`/api/usuarios/${newId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Laura G. (Auditora Senior)',
        correo: 'laura.g@auditsys.edu.co',
        rol: 'auditor',
      })
      .expect(200);
    expect(updRes.body.data.nombre).toBe('Laura G. (Auditora Senior)');

    // 6. El admin crea una auditoría asignándosela al nuevo auditor
    const auditRes = await request(http)
      .post('/api/auditorias')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        organizacion: 'Banco Demo S.A.',
        objetivo: 'Validar controles tecnológicos.',
        alcance: 'Banca móvil y APIs.',
        fecha_inicio: '2026-11-15',
        fecha_fin: '2026-11-30',
        id_auditor: newId,
      })
      .expect(201);
    expect(auditRes.body.data.id_auditor).toBe(newId);

    // 7. No se puede eliminar si tiene auditoría asignada -> 409
    await request(http)
      .delete(`/api/usuarios/${newId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(409);

    // 8. Crear otro auditor sin auditorías y eliminarlo -> 200
    const tempRes = await request(http)
      .post('/api/usuarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Temporal',
        correo: 'temp@auditsys.edu.co',
        password: PASSWORD,
        rol: 'auditor',
      })
      .expect(201);
    await request(http)
      .delete(`/api/usuarios/${tempRes.body.data.id_usuario}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
