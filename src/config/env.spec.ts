import { buildCorsOriginCheck } from '../bootstrap.js';
import { validateEnv } from './env.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('validateEnv (B1.2)', () => {
  it('aplica valores por defecto seguros', () => {
    const env = validateEnv(base);
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      DB_POOL_MAX: 4,
      JWT_EXPIRES_IN: '8h',
      ALLOW_SEED_RESET: false,
      SWAGGER_ENABLED: true,
    });
  });

  it('exige DATABASE_URL y un JWT_SECRET de 32+ caracteres', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
    expect(() => validateEnv({ ...base, JWT_SECRET: 'corto' })).toThrow(/32 caracteres/);
  });

  it('rechaza en producción el JWT_SECRET público de .env.example', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        JWT_SECRET: 'decr27000_iso27002_secret_key_2026_segura',
      }),
    ).toThrow(/\.env\.example/);
  });

  it('en producción apaga Swagger salvo que se active explícitamente', () => {
    expect(validateEnv({ ...base, NODE_ENV: 'production' }).SWAGGER_ENABLED).toBe(false);
    expect(
      validateEnv({ ...base, NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }).SWAGGER_ENABLED,
    ).toBe(true);
  });

  it('ignora "*" en CORS_ORIGIN y limpia barras finales', () => {
    expect(validateEnv({ ...base, CORS_ORIGIN: '*' }).CORS_ORIGINS).toEqual([]);
    expect(validateEnv({ ...base, CORS_ORIGINS: 'https://a.com/, https://b.com' }).CORS_ORIGINS).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });
});

describe('buildCorsOriginCheck (P10)', () => {
  const allowed = buildCorsOriginCheck({
    FRONTEND_URL: 'https://decr27000-frontend.vercel.app',
    CORS_ORIGINS: ['https://extra.example.com'],
  });

  it.each([
    'https://decr27000-frontend.vercel.app',
    'https://decr27000-frontend-git-feat-x-juandulcey.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'https://extra.example.com',
    undefined,
  ])('permite %s', (origin) => expect(allowed(origin)).toBe(true));

  it.each(['https://evil.vercel.app', 'https://decr27000-frontend.vercel.app.evil.com', 'http://192.168.1.5:3000'])(
    'bloquea %s',
    (origin) => expect(allowed(origin)).toBe(false),
  );
});
