import { defineConfig } from 'vitest/config';

/**
 * Pruebas e2e contra un PostgreSQL desechable en Docker, NUNCA contra Supabase:
 *   docker run -d --rm --name decr-test-pg -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:16-alpine
 *   pnpm test:e2e
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 20_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://postgres:test@localhost:54329/postgres',
      JWT_SECRET: 'test-secret-for-e2e-only-0123456789abcdef',
      JWT_EXPIRES_IN: '1h',
      FRONTEND_URL: 'https://decr27000-frontend.vercel.app',
      SWAGGER_ENABLED: 'false',
    },
  },
});
