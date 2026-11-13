# decr27000-backend — AuditSys Mini API

API REST de **DECR 27000 (AuditSys Mini)**, sistema de gestión de auditorías de seguridad de la información basado en **ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022**.

- **Stack**: NestJS 12 + `NodeAdapter` (el adaptador HTTP más rápido de Nest) · TypeScript · PostgreSQL con `pg` (SQL parametrizado, sin ORM) · Vitest + supertest · oxlint.
- **Base de datos**: Supabase (PostgreSQL 17, Session Pooler, región `us-east-2`).
- **Despliegue**: Render, plan gratuito → `https://decr27000-backend.onrender.com/api`.
- **Especificación**: [`BACKEND_SPEC.md`](BACKEND_SPEC.md) · **Plan**: [`PLAN_DESARROLLO.md`](PLAN_DESARROLLO.md).

## Requisitos
- Node.js 22 o superior y **pnpm 9** (`corepack enable`). No use npm ni yarn.
- Docker (solo para las pruebas e2e).

## Puesta en marcha local
```bash
pnpm install
cp .env.example .env      # complete DATABASE_URL y JWT_SECRET (openssl rand -hex 32)
pnpm start:dev            # http://localhost:4000/api  (modo watch)
```
- Salud: `GET http://localhost:4000/api/health` (y `?db=1` para verificar la BD).
- Swagger: `http://localhost:4000/api/docs` (si `SWAGGER_ENABLED=true`).
- Usuarios de la semilla: `ana.auditora@auditsys.edu.co` (auditor) y `admin@auditsys.edu.co` (admin), contraseña `Audit2026*`.

## Scripts
| Comando | Qué hace |
| :--- | :--- |
| `pnpm start:dev` | Servidor con recarga automática. |
| `pnpm build` / `pnpm start` | Compila a `dist/` y arranca como en producción (`node --max-old-space-size=384 dist/main.js`). |
| `pnpm lint` / `pnpm format` | oxlint con tipos / Prettier. |
| `pnpm test` | Pruebas unitarias (`src/**/*.spec.ts`). |
| `pnpm test:e2e` | Pruebas e2e contra PostgreSQL en Docker (ver abajo). |
| `pnpm db:security` | Activa RLS en Supabase, revoca privilegios de `anon`/`authenticated` y hashea contraseñas en texto plano. No borra datos; es idempotente. |
| `pnpm db:seed` | **Borra todo** y carga `SEED_93_CONTROLES_Y_EMPRESA_ABC.sql`. Contra una BD remota exige `SEED_CONFIRM=RESTAURAR-EMPRESA-ABC`. |

## Pruebas e2e (nunca contra Supabase)
```bash
docker run -d --rm --name decr-test-pg -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:16-alpine
pnpm test:e2e
docker stop decr-test-pg
```
Las pruebas ignoran el `.env`, restauran la semilla en la BD de Docker y se niegan a correr contra una BD remota.

## Contrato de respuestas
- Éxito: `{ "ok": true, "data": ..., "message"?: "..." }`
- Error: `{ "ok": false, "error": "Mensaje en español", "field"?: "campo" }`
- Rutas aún no implementadas responden `404 { "ok": false, "error": "Ruta no encontrada" }`; el frontend usa entonces su motor local (ver PLAN §2.7).

## Estructura
```text
src/
├── main.ts                 # NestFactory + NodeAdapter, escucha en 0.0.0.0:$PORT
├── bootstrap.ts            # prefijo /api, helmet, CORS (lista blanca), Swagger, shutdown hooks
├── app.module.ts           # módulos + guards, pipe, interceptor y filtro globales
├── config/env.ts           # validación de variables de entorno al arrancar
├── common/                 # AppError, decoradores (@Public, @Roles, @CurrentUser), guards, filtro, interceptor
├── database/               # DatabaseService (pool pg), InitDbService, scripts db:seed / db:security
└── modules/                # health, auth, usuarios (y los módulos de los siguientes incrementos)
sql/security.sql            # RLS + REVOKE para Supabase
test/                       # pruebas e2e (Vitest + supertest)
```

## Despliegue en Render (plan gratuito)
Valores en [`render.yaml`](render.yaml). Si el servicio se creó desde el panel, configúrelos en **Settings → Build & Deploy**:
- **Build**: `NODE_ENV=development pnpm install --frozen-lockfile && pnpm build && pnpm prune --prod`
- **Start**: `node --max-old-space-size=384 dist/main.js`
- **Health check**: `/api/health`
- **Región**: Ohio (igual que Supabase). La región no se puede cambiar: si el servicio está en otra, hay que recrearlo.
- **Variables**: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (propio, nunca el del ejemplo), `JWT_EXPIRES_IN=8h`, `FRONTEND_URL`, `SWAGGER_ENABLED`, `DB_SSL_CA` (recomendada).

Medido localmente con el build de producción: arranque en ~0,6 s y ~135 MB de RAM.
