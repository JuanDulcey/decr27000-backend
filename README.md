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
| `pnpm db:seed` | **Borra todo** y carga `SEED_93_CONTROLES_Y_EMPRESA_ABC.sql` con las contraseñas hasheadas. Contra una BD remota exige `SEED_CONFIRM=RESTAURAR-EMPRESA-ABC`. Con `SEED_SECURITY=false` no aplica RLS (así se restauró Supabase el 13-nov, por decisión del equipo). |

## Pruebas e2e (nunca contra Supabase)
```bash
docker run -d --rm --name decr-test-pg -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:16-alpine
pnpm test:e2e
docker stop decr-test-pg
```
Las pruebas ignoran el `.env`, restauran la semilla en la BD de Docker y se niegan a correr contra una BD remota.

## Endpoints (prefijo `/api`, todos con JWT salvo los marcados como públicos)
| Recurso | Endpoints |
| :--- | :--- |
| Salud | `GET /health` (público) · `GET /health?db=1` |
| Sesión y usuarios | `POST /auth/login` (público) · `GET /auth/me` · `GET /usuarios` · `POST /usuarios`, `PUT /usuarios/:id`, `PATCH /usuarios/:id/password` y `DELETE /usuarios/:id` (solo admin) |
| Catálogo | `GET /controles?categoria=&q=` · `GET /controles/:id` · `POST /controles` y `PUT /controles/:id` (solo admin) |
| Auditorías | `GET /auditorias` · `GET /auditorias/:id` · `POST /auditorias` · `PUT /auditorias/:id` · `PATCH /auditorias/:id/estado` · `GET /auditorias/:id/verificacion-cierre` · `PUT /auditorias/:id/seleccion-controles` |
| Evaluación | `GET /auditorias/:id/evaluaciones` · `PUT /evaluaciones/:id` |
| Evidencias | `POST /evaluaciones/:id/evidencias` · `DELETE /evidencias/:id` |
| Archivos de evidencia (bucket, opcional) | `POST /evidencias/:id/archivo` (multipart, campo `archivo`) · `GET /evidencias/:id/archivo` (enlace temporal de 5 min) · `DELETE /evidencias/:id/archivo` |
| Hallazgos | `GET /auditorias/:id/hallazgos` · `POST /evaluaciones/:id/hallazgos` · `PUT` y `DELETE /hallazgos/:id` |
| Recomendaciones | `POST /hallazgos/:id/recomendaciones` · `PUT` y `DELETE /recomendaciones/:id` |
| Resultados | `GET /auditorias/:id/indicadores` · `GET /auditorias/:id/trazabilidad` · `GET` y `POST /auditorias/:id/informes` · `GET /informes/:id` · `GET /dashboard?id_auditoria=` |
| Demo | `POST /seed/reset` (solo admin, `ALLOW_SEED_RESET=true`, `{ "confirm": "RESTAURAR-EMPRESA-ABC" }`) |

Detalle de cuerpos, respuestas y reglas en [`BACKEND_SPEC.md`](BACKEND_SPEC.md) §5, §6 y §6.10, y en vivo en Swagger (`/api/docs`).

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
└── modules/
    ├── core/               # AuditLock (inmutabilidad CERRADA), indicadores RF07, verificación de cierre
    ├── storage/            # bucket S3 de Railway (opcional): subir, borrar, enlaces prefirmados
    ├── health/ · auth/ · usuarios/
    ├── controles/          # catálogo de 93 controles (caché en memoria) — RF02
    ├── auditorias/         # CRUD, ciclo de vida y selección 10–15 — RF01, RN02, RN04, RN06
    ├── evaluaciones/       # evaluación de controles y evidencias EV-nn — RF03, RF04
    ├── hallazgos/          # hallazgos H-nn y recomendaciones — RF05, RF06
    ├── informes/           # indicadores, trazabilidad, informe de 8 secciones y versiones — RF07, RF08, RNF05
    ├── dashboard/          # RF09
    └── seed/               # POST /api/seed/reset (solo admin)
sql/security.sql            # RLS + REVOKE para Supabase
test/                       # pruebas e2e (Vitest + supertest)
```

## Certificado de Supabase (`DB_SSL_CA`) — paso a paso
La conexión a Supabase siempre va cifrada (TLS). Con la CA de Supabase configurada, además se **verifica** que el servidor sea realmente Supabase, lo que evita ataques de intermediario. Sin ella el backend funciona igual, pero deja este aviso en el log: `DB_SSL_CA no está configurada…`.

1. **Descargar la CA**: en el panel de Supabase, abra el proyecto → **Project Settings → Database** (en algunas versiones del panel: **Database → Settings**) → sección **SSL Configuration** → **Download certificate**. Se descarga un archivo `.crt` (por ejemplo `prod-ca-2021.crt`). Es un certificado **público**: no es un secreto, pero tampoco hace falta subirlo al repo.
2. **Convertirlo a una sola línea** (desde la carpeta donde quedó el archivo):
   ```bash
   awk 'NF {sub(/\r/, ""); printf "%s\\n", $0}' prod-ca-2021.crt
   ```
   El resultado empieza por `-----BEGIN CERTIFICATE-----\n` y termina en `-----END CERTIFICATE-----\n`.
3. **Ponerlo en el `.env` local** del backend, entre comillas dobles:
   ```env
   DB_SSL_CA="-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----\n"
   ```
4. **Probar en local**:
   ```bash
   pnpm build && pnpm start
   curl "http://localhost:4000/api/health?db=1"   # debe responder "db":"UP"
   ```
   - El aviso `DB_SSL_CA no está configurada` ya no debe aparecer en el log.
   - Si responde `"db":"DOWN"` y el log muestra `self-signed certificate in certificate chain` o `Hostname/IP does not match`, el certificado no corresponde al pooler: borre `DB_SSL_CA` para volver al modo anterior y revise que descargó el certificado del mismo proyecto.
5. **Ponerlo en Render**: servicio `decr27000-backend` → **Environment** → **Add Environment Variable** → clave `DB_SSL_CA` y, como valor, el contenido del `.crt` (Render acepta valores de varias líneas, así que puede pegar el archivo tal cual o la versión de una línea del paso 2) → **Save changes**. Render redespliega solo.
6. **Verificar en producción**: `https://decr27000-backend.onrender.com/api/health?db=1` debe responder `"db":"UP"`, y el log de Render no debe mostrar el aviso.

## Despliegue en Render (plan gratuito)
Valores en [`render.yaml`](render.yaml). Si el servicio se creó desde el panel, configúrelos en **Settings → Build & Deploy**:
- **Build**: `NODE_ENV=development pnpm install --frozen-lockfile && pnpm build && pnpm prune --prod`
- **Start**: `node --max-old-space-size=384 dist/main.js`
- **Health check**: `/api/health`
- **Región**: Ohio (igual que Supabase). La región no se puede cambiar: si el servicio está en otra, hay que recrearlo.
- **Variables**: `NODE_ENV=production`, `DATABASE_URL`, `JWT_SECRET` (propio, nunca el del ejemplo), `JWT_EXPIRES_IN=8h`, `FRONTEND_URL`, `SWAGGER_ENABLED`, `DB_SSL_CA` (recomendada) y, para los archivos de evidencias, las 4 del bucket (ver la sección siguiente).

Medido localmente con el build de producción y todos los módulos: arranque en ~0,6 s, ~134 MB de RAM en reposo y ~157 MB tras 300 informes seguidos; los endpoints responden en 3–12 ms contra una BD local.

## Archivos de evidencias en el bucket de Railway (opcional)
Las evidencias pueden llevar un archivo real (PDF, imagen, Office, CSV, TXT, ZIP…) guardado en un **bucket S3 de Railway** (Storage Buckets). Es **opcional**: sin las variables, el backend arranca y funciona igual, y solo la carga de archivos responde `503`.

**Variables** (Railway → servicio del bucket → pestaña *Credentials*):

| Variable | Valor |
| :--- | :--- |
| `ENPOINT_URL` | `https://t3.storageapi.dev` (también se acepta `ENDPOINT_URL`) |
| `BUCKET_NAME` | Nombre S3 del bucket (`BUCKET` en Railway, no el nombre visible) |
| `ACCESS_KEY_BUCKET` | `ACCESS_KEY_ID` de Railway |
| `SECRET_KEY_BUCKET` | `SECRET_ACCESS_KEY` de Railway |
| `BUCKET_REGION` | Opcional, por defecto `auto` |
| `BUCKET_URL_STYLE` | Opcional, `virtual` (por defecto) o `path` para buckets antiguos |
| `EVIDENCIA_MAX_MB` | Opcional, tamaño máximo por archivo (por defecto 5, máximo 20) |

**En Render**: servicio `decr27000-backend` → **Environment** → agregar `ENPOINT_URL`, `BUCKET_NAME`, `ACCESS_KEY_BUCKET` y `SECRET_KEY_BUCKET` → **Save changes** (Render redespliega). Verificación: `GET /api/health?db=1` debe responder `"storage":"UP"` (`"DISABLED"` si faltan variables, `"DOWN"` si las credenciales o el bucket fallan).

**Cómo funciona**
- `POST /api/evidencias/:id/archivo` con `multipart/form-data` y el archivo en el campo `archivo`. Adjunta o reemplaza (el anterior se borra del bucket). Bloqueado si la auditoría está `CERRADA` (403).
- `GET /api/evidencias/:id/archivo` responde `{ url, expira_en_segundos, archivo_nombre, archivo_tipo, archivo_tamano }`: un enlace **prefirmado de 5 minutos** que descarga el archivo directo desde Railway (no pasa por Render, no gasta cómputo). Permitido también en auditorías cerradas.
- `DELETE /api/evidencias/:id/archivo` quita el archivo y conserva la evidencia. Al borrar una evidencia, su archivo también se borra del bucket.
- Las evidencias incluyen `tiene_archivo`, `archivo_nombre`, `archivo_tipo` y `archivo_tamano` en la evaluación, el anexo del informe y la trazabilidad. La clave interna del bucket nunca se expone.
- Seguridad: el bucket es privado; el tipo MIME lo asigna el servidor según la extensión (lista blanca; sin HTML, SVG ni ejecutables); la clave del objeto es aleatoria; la descarga siempre es "adjunto".
- Esquema: la migración `sql/migrations/001_evidencia_archivo.sql` agrega 4 columnas opcionales a `evidencia`. Se aplica sola al arrancar si faltan (también en Supabase al desplegar en Render).
- Liviano: usa `aws4fetch` (firma SigV4 con `fetch` nativo) y solo se carga si el bucket está configurado. Medido: ~108 MB de RAM con el bucket activo.

Ejemplo con `curl`:
```bash
curl -H "Authorization: Bearer $TOKEN" -F "archivo=@Politica.pdf" http://localhost:4000/api/evidencias/1/archivo
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/evidencias/1/archivo   # → data.url (5 min)
```
