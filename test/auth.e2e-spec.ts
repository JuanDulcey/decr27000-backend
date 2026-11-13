import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { LoginRateLimitGuard } from '../src/common/guards.js';
import { ADMIN, AUDITOR, createTestApp, loginAs, PASSWORD, resetTestDatabase } from './helpers/app.js';

describe('Plataforma: health, errores, autenticación y usuarios (B1.5, B1.6)', () => {
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

  describe('GET /api/health', () => {
    it('responde sin token y sin tocar la BD', async () => {
      const res = await request(http).get('/api/health').expect(200);
      expect(res.body).toMatchObject({ ok: true, status: 'UP', service: 'decr27000-backend' });
      expect(res.body.db).toBeUndefined();
    });

    it('con ?db=1 informa el estado de la BD', async () => {
      const res = await request(http).get('/api/health?db=1').expect(200);
      expect(res.body.db).toBe('UP');
    });
  });

  describe('contrato de errores', () => {
    it('ruta inexistente → 404 "Ruta no encontrada" (compatibilidad con el motor local del frontend)', async () => {
      const res = await request(http).get('/api/no-existe').expect(404);
      expect(res.body).toEqual({ ok: false, error: 'Ruta no encontrada' });
    });

    it('ruta protegida sin token → 401', async () => {
      const res = await request(http).get('/api/usuarios').expect(401);
      expect(res.body.ok).toBe(false);
    });

    it('token inválido → 401', async () => {
      await request(http).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi').expect(401);
    });
  });

  describe('POST /api/auth/login', () => {
    it('credenciales correctas → token y usuario sin password_hash', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ correo: '  Ana.Auditora@AuditSys.edu.co ', password: PASSWORD })
        .expect(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.token).toMatch(/^ey/);
      expect(res.body.data.usuario).toEqual({
        id_usuario: 1,
        nombre: 'Ana R. (Auditora Líder)',
        correo: AUDITOR,
        rol: 'auditor',
      });
    });

    it('contraseña incorrecta → 401 con mensaje genérico', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ correo: AUDITOR, password: 'otra' })
        .expect(401);
      expect(res.body.error).toMatch(/Credenciales inválidas/);
    });

    it('correo inexistente → mismo 401 genérico', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ correo: 'nadie@auditsys.edu.co', password: PASSWORD })
        .expect(401);
      expect(res.body.error).toMatch(/Credenciales inválidas/);
    });

    it('sin correo → 400 con field "correo" (RNF03)', async () => {
      const res = await request(http).post('/api/auth/login').send({ password: 'x' }).expect(400);
      expect(res.body).toEqual({ ok: false, error: 'Ingrese su correo institucional.', field: 'correo' });
    });

    it('correo mal formado → 400', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ correo: 'no-es-correo', password: 'x' })
        .expect(400);
      expect(res.body.field).toBe('correo');
    });

    it('campo no permitido → 400', async () => {
      const res = await request(http)
        .post('/api/auth/login')
        .send({ correo: AUDITOR, password: PASSWORD, rol: 'admin' })
        .expect(400);
      expect(res.body.field).toBe('rol');
    });

    it('más de 10 intentos en 15 minutos → 429', async () => {
      for (let i = 0; i < LoginRateLimitGuard.MAX_ATTEMPTS; i++) {
        await request(http).post('/api/auth/login').send({ correo: AUDITOR, password: 'mala' }).expect(401);
      }
      const res = await request(http)
        .post('/api/auth/login')
        .send({ correo: AUDITOR, password: PASSWORD })
        .expect(429);
      expect(res.body.error).toMatch(/Demasiados intentos/);
    });
  });

  describe('sesión y usuarios', () => {
    it('GET /api/auth/me devuelve el usuario del token', async () => {
      const token = await loginAs(app, ADMIN);
      const res = await request(http).get('/api/auth/me').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.data).toMatchObject({ correo: ADMIN, rol: 'admin' });
    });

    it('GET /api/usuarios lista usuarios sin contraseñas', async () => {
      const token = await loginAs(app, AUDITOR);
      const res = await request(http).get('/api/usuarios').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.data).toHaveLength(2);
      for (const u of res.body.data) expect(u).not.toHaveProperty('password_hash');
    });
  });

  describe('CORS (lista blanca)', () => {
    it('permite el frontend de Vercel', async () => {
      const res = await request(http)
        .options('/api/auth/login')
        .set('Origin', 'https://decr27000-frontend.vercel.app')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBe('https://decr27000-frontend.vercel.app');
    });

    it('no permite orígenes ajenos', async () => {
      const res = await request(http)
        .options('/api/auth/login')
        .set('Origin', 'https://otro-sitio.example.com')
        .set('Access-Control-Request-Method', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
