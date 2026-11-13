# AUDITSYS MINI — ESPECIFICACIÓN TÉCNICA COMPLETA DE BACKEND Y BASE DE DATOS (`/backend`)

> **Propósito de este documento**: Este archivo contiene la especificación técnica, arquitectónica, de base de datos, reglas de negocio y contrato de API REST **100% autocontenida** para que una Inteligencia Artificial (o equipo de desarrollo) construya de principio a fin el repositorio `decr27000-backend` de **AuditSys Mini – Sistema de Gestión de Auditorías de Sistemas de Información (ISO/IEC 27001:2022 & ISO/IEC 27002:2022)**.

---

## 1. Contexto General y Arquitectura del Proyecto

- **Nombre del Sistema**: AuditSys Mini – Sistema de Gestión de Auditorías de Sistemas de Información.
- **Referentes Normativos**:
  - **ISO 19011:2026** (4.ª edición, publicada en mayo de 2026; reemplaza y retira a ISO 19011:2018): Directrices para la auditoría de los sistemas de gestión. Conserva los **7 principios de auditoría**: integridad, presentación imparcial, debido cuidado profesional, confidencialidad, independencia, enfoque basado en la evidencia y enfoque basado en riesgos. Novedades relevantes para este proyecto: los métodos de auditoría **presencial, remoto e híbrido** se tratan como opciones equivalentes en toda la auditoría (planificación, ejecución e informe), se añade la definición formal de "métodos de auditoría remota" y la competencia en TIC del auditor (fiabilidad de la evidencia obtenida por medios digitales). No es una norma certificable.
  - **ISO/IEC 27001:2022** (incluida la **Enmienda 1:2024** sobre cambio climático en los numerales 4.1 y 4.2, que no modifica el Anexo A): Requisitos del Sistema de Gestión de Seguridad de la Información (SGSI) y Anexo A (93 controles). **No existe edición 2026**: la versión 2022 sigue vigente.
  - **ISO/IEC 27002:2022**: Controles de seguridad de la información (organizados en 4 categorías: **5. Organizacionales [37]**, **6. Personas/TTHH [8]**, **7. Físicos [14]** y **8. Tecnológicos [34]** = **93 controles en total**). **No existe edición 2026**: la versión 2022 sigue vigente.
  - **Referentes complementarios** (opcionales según el documento orientador): ISO 31000:2018 (gestión del riesgo; sigue vigente, su revisión está en borrador de comité), ISO/IEC 25010:2023 (calidad del producto de software; el documento orientador exige indicar la edición utilizada) e ISO/IEC 27000:2026 (vocabulario de la familia 27000, publicada en 2026).

> **Nota de vigencia normativa (verificada en noviembre de 2026)**: los documentos académicos de origen (`Proyecto_Academico_AuditSys_Mini.docx` y `AuditSys_Mini_Proyecto_Ejemplo.docx`) citan **ISO 19011:2018**, que fue retirada al publicarse **ISO 19011:2026**. En todo el sistema (semilla SQL, valor por defecto de `referentes`, informe y frontend) se usa la cadena oficial: **`ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022`**. Los 93 controles del catálogo corresponden a ISO/IEC 27002:2022 (la estructura anterior de 2013, con 114 controles en 14 dominios, **no** se usa).
- **Arquitectura del Repositorio**: Dos repositorios sincronizados en GitHub:
  - **Backend (`JuanDulcey/decr27000-backend`)**: API RESTful en **NestJS 12 (`NodeAdapter`) + TypeScript + PostgreSQL (`pg`)**, desplegada en **Render** en la URL oficial: `https://decr27000-backend.onrender.com` (prefijo API: `https://decr27000-backend.onrender.com/api`).
  - **Frontend (`JuanDulcey/decr27000-frontend`)**: Aplicación Web Multipágina (MPA) en **HTML5 + CSS3 (Variables CSS + Tailwind CDN) + Vanilla JavaScript (ES6 Modules)**, desplegada en **Vercel** en la URL oficial: `https://decr27000-frontend.vercel.app`.
- **Base de Datos**: **PostgreSQL en Supabase** (PostgreSQL 17, Session Pooler, región `us-east-2`; compatible con PostgreSQL local o Docker para pruebas) conectada mediante la variable de entorno `DATABASE_URL` y el driver nativo `pg` con consultas SQL parametrizadas (sin ORM opaco, para evidenciar explícitamente llaves foráneas, restricciones `CHECK` y funciones SQL exigidas por la rúbrica académica).

---

## 2. Estructura de Carpetas del Repositorio Backend (`decr27000-backend`)

> **Stack decidido por el equipo (nov-2026)**: **NestJS 12 + `NodeAdapter`** (`@nestjs/platform-node`, el adaptador HTTP más rápido de Nest 12: ~5 % más que Fastify y ~50 % más que Express según la documentación oficial; recomendado desde la 12.3 y default en la 13). TypeScript en ESM, `pg` sin ORM, `class-validator` para los DTOs, Vitest + supertest para las pruebas y oxlint como linter. Reemplaza a la versión con Express de este documento; el **contrato de la API (sección 6) no cambia**. Todo se gestiona con **pnpm**.

Estructura modular (cumple el requisito no funcional de mantenibilidad **RNF06**). Cada módulo de negocio tiene `*.module.ts`, `*.controller.ts`, `*.service.ts` y `dto/`:

```text
decr27000-backend/
├── package.json · pnpm-lock.yaml · nest-cli.json · tsconfig*.json · vitest.config*.ts · .oxlintrc.json
├── .env.example · render.yaml · README.md · BACKEND_SPEC.md · PLAN_DESARROLLO.md
├── SEED_93_CONTROLES_Y_EMPRESA_ABC.sql   # esquema + 93 controles + Empresa ABC (fuente única del esquema)
├── sql/security.sql                      # RLS + REVOKE de anon/authenticated para Supabase
├── src/
│   ├── main.ts                           # NestFactory + NodeAdapter; escucha en 0.0.0.0:$PORT
│   ├── bootstrap.ts                      # prefijo /api, helmet, CORS con lista blanca, Swagger, shutdown hooks
│   ├── app.module.ts                     # módulos + APP_GUARD (JWT, roles), APP_PIPE, APP_INTERCEPTOR, APP_FILTER
│   ├── config/env.ts                     # validación de variables al arrancar
│   ├── common/
│   │   ├── app-error.ts                  # AppError → { ok:false, error, field? }
│   │   ├── decorators.ts                 # @Public(), @Roles(), @RawResponse(), @CurrentUser(), ApiMessage
│   │   ├── guards.ts                     # JwtAuthGuard (global), RolesGuard (global), LoginRateLimitGuard
│   │   ├── validation.ts                 # ValidationPipe global con mensajes y field
│   │   ├── response.interceptor.ts       # sobre { ok:true, data, message? }
│   │   └── all-exceptions.filter.ts      # errores HTTP y de PostgreSQL → sobre de error
│   ├── database/
│   │   ├── database.service.ts           # Pool pg (query, one, withTransaction, ping)
│   │   ├── init-db.service.ts            # al arrancar: si no hay catálogo, carga la semilla
│   │   ├── seed-runner.ts                # semilla + hash bcrypt + seguridad (compartido)
│   │   └── seed.ts · security.ts         # scripts pnpm db:seed / pnpm db:security
│   └── modules/
│       ├── health/ · auth/ · usuarios/                     # Incremento 1 (base)
│       ├── controles/ · auditorias/                         # Incremento 1 (RF01, RF02)
│       ├── evaluaciones/ · evidencias/ · hallazgos/          # Incremento 2 (RF03–RF06)
│       └── indicadores/ · dashboard/ · informes/ · seed/     # Incremento 3 (RF07–RF09)
└── test/                                 # e2e con Vitest + supertest contra PostgreSQL en Docker
```

### 2.1. Dependencias (`package.json`)

| Tipo | Paquetes |
| :--- | :--- |
| Ejecución | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-node` (12.x), `@nestjs/config`, `@nestjs/jwt`, `@nestjs/swagger`, `pg`, `bcryptjs`, `helmet`, `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs` |
| Desarrollo | `@nestjs/cli`, `@nestjs/schematics`, `@nestjs/testing`, `typescript` 6.x, `vitest` 4.x, `vite` 8.x, `supertest`, `oxlint`, `prettier`, `@types/*` |

Scripts: `build`, `start` / `start:prod` (`node --max-old-space-size=384 dist/main.js`), `start:dev`, `lint`, `format`, `test`, `test:e2e`, `db:seed`, `db:security`. `"engines": { "node": ">=22" }`, `"packageManager": "pnpm@9.12.0"`.

El límite de intentos de login es propio y en memoria (`LoginRateLimitGuard`, 10 intentos por IP cada 15 min). No se usa `@nestjs/throttler`, para no sumar dependencias y no depender del objeto de respuesta de un adaptador concreto.

### 2.2. Variables de Entorno (`.env.example`)

| Variable | Obligatoria | Por defecto | Uso |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | Sí | — | Supabase Session Pooler (puerto 5432). |
| `JWT_SECRET` | Sí | — | 32 caracteres o más. En producción se rechaza el valor público de `.env.example` y cualquier marcador `[...]`. |
| `PORT` | No | `4000` | Render lo define automáticamente. |
| `NODE_ENV` | No | `development` | `production` en Render; `test` en las pruebas (ignora `.env`). |
| `DB_POOL_MAX` | No | `4` | Conexiones del pool (plan gratuito). |
| `DB_SSL_CA` | Recomendada | — | CA de Supabase en PEM. Con ella se verifica el certificado TLS; sin ella, la conexión va cifrada pero sin verificar (el backend lo advierte en el log). |
| `JWT_EXPIRES_IN` | No | `8h` | Duración de la sesión (decisión P5). |
| `FRONTEND_URL` | No | `https://decr27000-frontend.vercel.app` | Origen permitido por CORS. |
| `CORS_ORIGINS` | No | — | Orígenes extra separados por comas (`*` se ignora). |
| `SWAGGER_ENABLED` | No | `true` en desarrollo, `false` en producción | Documentación en `/api/docs`. |
| `ALLOW_SEED_RESET` | No | `false` | Habilita `POST /api/seed/reset` (solo admin; Incremento 3). |

> **CORS (lista blanca, decisión P10)**: se permiten `FRONTEND_URL`, los previews de Vercel del proyecto (`https://decr27000-frontend-*.vercel.app`), `http://localhost:*` / `http://127.0.0.1:*` y los orígenes de `CORS_ORIGINS`. Métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS`; cabeceras `Content-Type, Authorization`.

> **Conexión a PostgreSQL (`src/database/pool.ts`)**: SSL desactivado para bases locales; para Supabase, `{ ca, rejectUnauthorized: true }` si hay `DB_SSL_CA`, o `{ rejectUnauthorized: false }` si no la hay. Pool: `max 4`, `keepAlive`, `idleTimeoutMillis 30000`, `connectionTimeoutMillis 10000`, `statement_timeout 10000`.

> **Compatibilidad con el frontend durante la migración**: las rutas que aún no existen responden `404 { ok:false, error:"Ruta no encontrada" }`, el mismo texto que usaba el backend provisional. Así el frontend sigue usando su motor local (`js/seed-data.js`) para esas rutas mientras se implementan (PLAN §2.7).

---

## 3. Modelo de Datos Relacional y Reglas de Integridad (PostgreSQL)

El archivo SQL completo con las 8 tablas, los **93 controles oficiales de ISO/IEC 27002:2022** y la auditoría completa de **Empresa ABC** ya se encuentra generado en:
`SEED_93_CONTROLES_Y_EMPRESA_ABC.sql` (raíz del repositorio `decr27000-backend`; el script `src/config/initDb.js` debe leer este archivo, ejecutarlo y asegurarse de que las contraseñas de los usuarios semilla queden hasheadas con `bcryptjs` para la clave `Audit2026*`). El script fue probado en PostgreSQL 16: crea las 8 tablas, carga 93 controles (37/8/14/34) y reproduce los indicadores de `CP-09` (33,3 % y 54,2 %).

> **Fidelidad del catálogo frente a ISO/IEC 27002:2022**: los textos provienen del archivo docente `CONTROLES APLICABLES ISO 27002 2022 (20262).xlsx` (el sufijo "20262" corresponde al periodo académico 2026-2, no a una edición de la norma) y del documento `puntos de control con ejemplos ISO 27002 2022.docx`. En la semilla se corrigieron errores de traducción para alinearlos con la norma: 5.1 (el criterio era el *propósito* y no el enunciado del control), 5.4, 5.24, 5.25, 5.31, 6.1, 6.3, 6.8, 7.3, 7.6, 7.7, 7.8, 7.11, 7.12, 8.1, 8.15, 8.31, 8.32 y 8.34. Los textos siguen siendo una traducción académica: el auditor debe validarlos con el texto oficial de la norma, como advierte el documento de ejemplo.

### 3.1. Definición de las 8 Tablas y Restricciones Exigidas por la Rúbrica

```sql
-- 1. USUARIO (Autenticación y control de acceso por rol - RNF04)
CREATE TABLE usuario (
  id_usuario    SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  correo        VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(15) NOT NULL CHECK (rol IN ('auditor', 'admin')),
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. CONTROL (Catálogo normativo con los 93 controles ISO/IEC 27002:2022 - RF02)
CREATE TABLE control (
  id_control           SERIAL PRIMARY KEY,
  codigo_iso           VARCHAR(10) NOT NULL UNIQUE,
  categoria            VARCHAR(20) NOT NULL CHECK (categoria IN ('ORGANIZACIONAL', 'PERSONAS', 'FISICO', 'TECNOLOGICO')),
  nombre               VARCHAR(200) NOT NULL,
  criterio             TEXT NOT NULL,
  pregunta_orientadora TEXT NOT NULL,
  ejemplo_aplicacion   TEXT,
  evidencia_sugerida   TEXT
);

-- 3. AUDITORIA (Datos generales y ciclo de vida - RF01)
CREATE TABLE auditoria (
  id_auditoria  SERIAL PRIMARY KEY,
  organizacion  VARCHAR(120) NOT NULL,
  objetivo      TEXT NOT NULL,
  alcance       TEXT NOT NULL,
  fecha_inicio  DATE NOT NULL,
  fecha_fin     DATE NOT NULL,
  referentes    VARCHAR(250) NOT NULL DEFAULT 'ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022',
  estado        VARCHAR(15) NOT NULL DEFAULT 'BORRADOR'
    CHECK (estado IN ('BORRADOR', 'EN_EJECUCION', 'EN_REVISION', 'CERRADA')),
  id_auditor    INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (fecha_fin >= fecha_inicio)
);

-- 4. EVALUACION_CONTROL (Estado de cada control seleccionado en una auditoría - RF02, RF03)
CREATE TABLE evaluacion_control (
  id_evaluacion    SERIAL PRIMARY KEY,
  id_auditoria     INTEGER NOT NULL REFERENCES auditoria(id_auditoria) ON DELETE CASCADE,
  id_control       INTEGER NOT NULL REFERENCES control(id_control) ON DELETE RESTRICT,
  estado           VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE'
    CHECK (estado IN ('PENDIENTE', 'IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO', 'NO_APLICABLE')),
  observacion      TEXT NOT NULL DEFAULT '',
  justificacion_na TEXT,
  actualizado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (id_auditoria, id_control),
  CHECK (estado <> 'NO_APLICABLE' OR (justificacion_na IS NOT NULL AND LENGTH(TRIM(justificacion_na)) > 0))
);

-- 5. EVIDENCIA (Soporte documental/técnico ligado a una evaluación - RF04)
CREATE TABLE evidencia (
  id_evidencia     SERIAL PRIMARY KEY,
  id_evaluacion    INTEGER NOT NULL REFERENCES evaluacion_control(id_evaluacion) ON DELETE CASCADE,
  codigo_evidencia VARCHAR(20) NOT NULL,
  descripcion      TEXT NOT NULL,
  fuente           VARCHAR(120) NOT NULL,
  fecha_evidencia  DATE NOT NULL DEFAULT CURRENT_DATE,
  referencia_url   TEXT,
  es_simulada      BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. HALLAZGO (Desviación sustentada con condición, criterio, causa, efecto y severidad - RF05)
CREATE TABLE hallazgo (
  id_hallazgo   SERIAL PRIMARY KEY,
  codigo        VARCHAR(10) NOT NULL,            -- H-01, H-02, ...
  id_evaluacion INTEGER NOT NULL REFERENCES evaluacion_control(id_evaluacion) ON DELETE CASCADE,
  condicion     TEXT NOT NULL,
  criterio      TEXT NOT NULL,
  causa         TEXT NOT NULL,
  efecto_riesgo TEXT NOT NULL,
  severidad     VARCHAR(10) NOT NULL CHECK (severidad IN ('ALTA', 'MEDIA', 'BAJA')),
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. RECOMENDACION (Acción de mejora vinculada a un hallazgo - RF06)
CREATE TABLE recomendacion (
  id_recomendacion SERIAL PRIMARY KEY,
  id_hallazgo      INTEGER NOT NULL REFERENCES hallazgo(id_hallazgo) ON DELETE CASCADE,
  descripcion      TEXT NOT NULL,
  prioridad        VARCHAR(10) NOT NULL CHECK (prioridad IN ('ALTA', 'MEDIA', 'BAJA')),
  plazo_dias       INTEGER NOT NULL CHECK (plazo_dias > 0),
  responsable_sug  VARCHAR(120) DEFAULT 'Líder de TI / Seguridad de la Información',
  creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. INFORME (Instantánea consolidada y versionada de los resultados - RF08)
CREATE TABLE informe (
  id_informe          SERIAL PRIMARY KEY,
  id_auditoria        INTEGER NOT NULL REFERENCES auditoria(id_auditoria) ON DELETE CASCADE,
  version             INTEGER NOT NULL DEFAULT 1,
  fecha_generacion    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_evaluados     INTEGER NOT NULL,
  total_aplicables    INTEGER NOT NULL,
  implementados       INTEGER NOT NULL,
  parciales           INTEGER NOT NULL,
  no_implementados    INTEGER NOT NULL,
  no_aplicables       INTEGER NOT NULL,
  cumplimiento_base   NUMERIC(5,1) NOT NULL,
  indice_ponderado    NUMERIC(5,1) NOT NULL,
  resumen_ejecutivo   TEXT NOT NULL,
  limitaciones        TEXT NOT NULL DEFAULT 'El indicador de cumplimiento es descriptivo y académico; no constituye certificación ISO/IEC 27001 ni sustituye el juicio profesional del auditor.',
  snapshot_json       JSONB
);
```

---

## 4. Consultas SQL Oficiales para Indicadores (RF07) y Trazabilidad (RNF05)

### 4.1. Consulta de Indicadores de Cumplimiento (`RF07` / Caso de Prueba `CP-09`)
Los controles con estado `NO_APLICABLE` y `PENDIENTE` se manejan explícitamente; los `NO_APLICABLE` se excluyen del denominador de controles aplicables y `NULLIF` evita división por cero:
- **Fórmula Indicador Base**: $(\text{Implementados} / \text{Aplicables}) \times 100$
- **Fórmula Índice Ponderado**: $((\text{Implementados} \times 1.0 + \text{Parciales} \times 0.5) / \text{Aplicables}) \times 100$

```sql
SELECT
  COUNT(*) AS total_seleccionados,
  SUM(CASE WHEN estado <> 'PENDIENTE' THEN 1 ELSE 0 END)::INT AS total_evaluados,
  SUM(CASE WHEN estado = 'PENDIENTE' THEN 1 ELSE 0 END)::INT AS pendientes,
  SUM(CASE WHEN estado = 'IMPLEMENTADO' THEN 1 ELSE 0 END)::INT AS implementados,
  SUM(CASE WHEN estado = 'PARCIAL' THEN 1 ELSE 0 END)::INT AS parciales,
  SUM(CASE WHEN estado = 'NO_IMPLEMENTADO' THEN 1 ELSE 0 END)::INT AS no_implementados,
  SUM(CASE WHEN estado = 'NO_APLICABLE' THEN 1 ELSE 0 END)::INT AS no_aplicables,
  SUM(CASE WHEN estado IN ('IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO') THEN 1 ELSE 0 END)::INT AS aplicables,
  COALESCE(
    ROUND(
      100.0 * SUM(CASE WHEN estado = 'IMPLEMENTADO' THEN 1 ELSE 0 END)
      / NULLIF(SUM(CASE WHEN estado IN ('IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO') THEN 1 ELSE 0 END), 0),
      1
    ),
    0.0
  )::FLOAT AS cumplimiento_base_pct,
  COALESCE(
    ROUND(
      100.0 * (
        SUM(CASE WHEN estado = 'IMPLEMENTADO' THEN 1.0 ELSE 0.0 END) +
        SUM(CASE WHEN estado = 'PARCIAL' THEN 0.5 ELSE 0.0 END)
      )
      / NULLIF(SUM(CASE WHEN estado IN ('IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO') THEN 1 ELSE 0 END), 0),
      1
    ),
    0.0
  )::FLOAT AS indice_ponderado_pct
FROM evaluacion_control
WHERE id_auditoria = $1;
```
> **Verificación CP-09 (Empresa ABC)**: Con 4 `IMPLEMENTADO`, 5 `PARCIAL`, 3 `NO_IMPLEMENTADO` y 1 `NO_APLICABLE` (12 aplicables):
> - `cumplimiento_base_pct` = `ROUND(100.0 * 4 / 12, 1)` = **`33.3`**
> - `indice_ponderado_pct` = `ROUND(100.0 * (4 + 2.5) / 12, 1)` = **`54.2`**

### 4.2. Consulta de Trazabilidad de Extremo a Extremo (`RNF05`)

```sql
SELECT
  a.id_auditoria,
  a.organizacion,
  c.id_control,
  c.codigo_iso,
  c.categoria,
  c.nombre AS control_nombre,
  e.id_evaluacion,
  e.estado,
  e.observacion,
  e.justificacion_na,
  ev.id_evidencia,
  ev.codigo_evidencia,
  ev.descripcion AS evidencia_descripcion,
  ev.fuente AS evidencia_fuente,
  ev.es_simulada,
  h.id_hallazgo,
  h.codigo AS hallazgo_codigo,
  h.severidad AS hallazgo_severidad,
  h.condicion AS hallazgo_condicion,
  r.id_recomendacion,
  r.descripcion AS recomendacion_descripcion,
  r.prioridad AS recomendacion_prioridad,
  r.plazo_dias AS recomendacion_plazo_dias
FROM evaluacion_control e
JOIN auditoria a         ON a.id_auditoria = e.id_auditoria
JOIN control c           ON c.id_control = e.id_control
LEFT JOIN evidencia ev   ON ev.id_evaluacion = e.id_evaluacion
LEFT JOIN hallazgo h     ON h.id_evaluacion = e.id_evaluacion
LEFT JOIN recomendacion r ON r.id_hallazgo = h.id_hallazgo
WHERE e.id_auditoria = $1
ORDER BY
  SPLIT_PART(c.codigo_iso, '.', 1)::INT,
  SPLIT_PART(c.codigo_iso, '.', 2)::INT,
  ev.id_evidencia,
  h.id_hallazgo;
```

---

## 5. Reglas de Negocio y Validaciones de Casos de Prueba (`CP-01` a `CP-13`)

El Backend debe validar obligatoriamente todas las reglas en el servidor (retornando código HTTP `400 Bad Request` o `403 Forbidden` con `{ ok: false, error: "Mensaje claro en español", field?: "nombre_campo" }`):

1. **RN01 / CP-01 y CP-02 (Creación de Auditoría)**:
   - Todos los campos (`organizacion`, `objetivo`, `alcance`, `fecha_inicio`, `fecha_fin`, `id_auditor`) son obligatorios.
   - `fecha_fin` debe ser mayor o igual a `fecha_inicio` (`fecha_fin >= fecha_inicio`). Si no, responder `400` con `{ ok: false, error: "La fecha de cierre debe ser igual o posterior a la fecha de inicio.", field: "fecha_fin" }`.
   - Toda nueva auditoría inicia en estado `'BORRADOR'`.
2. **RN02 / CP-03 (Rango de Selección de Controles: 10 a 15 controles)**:
   - Al guardar la selección de controles para una auditoría (`PUT /api/auditorias/:id/seleccion-controles`) o intentar pasar la auditoría a `'EN_EJECUCION'`, la cantidad de controles seleccionados debe estar **estrictamente entre 10 y 15** (`10 <= count <= 15`).
   - Si se envían menos de 10 o más de 15 (ej. 9 o 16 controles), responder `400` con `{ ok: false, error: "Debe seleccionar entre 10 y 15 controles del catálogo ISO/IEC 27002:2022 para la auditoría (actualmente seleccionó X)." }`.
3. **RN03 / CP-04 y CP-05 (Evaluación de Control y Justificación de No Aplicable)**:
   - Al evaluar un control (`PUT /api/evaluaciones/:id_evaluacion`) con estado `'IMPLEMENTADO'`, `'PARCIAL'`, `'NO_IMPLEMENTADO'` o `'NO_APLICABLE'`, el campo `observacion` es obligatorio (`observacion.trim().length > 0`). Si está vacío, rechazar con `400` (`CP-04`: *"La observación del auditor es obligatoria para guardar la evaluación."*).
   - Si `estado === 'NO_APLICABLE'`, el campo `justificacion_na` es obligatorio (`justificacion_na.trim().length > 0`). Si está vacío, rechazar con `400` (`CP-05`: *"El estado 'No aplicable' exige registrar una justificación formal."*). Si cambia a otro estado distinto de `'NO_APLICABLE'`, limpiar `justificacion_na = null`.
4. **RN04 / CP-06 (Exigencia de Evidencia para Controles Implementados o Parciales)**:
   - Para avanzar la auditoría a `'EN_REVISION'` (o cerrar/generar informe definitivo), todo control evaluado como `'IMPLEMENTADO'` o `'PARCIAL'` debe tener **al menos 1 evidencia registrada** en la tabla `evidencia`. Además, en la respuesta de cada evaluación el backend calcula `requiere_evidencia_faltante: (estado === 'IMPLEMENTADO' || estado === 'PARCIAL') && evidencias.length === 0`.Si al intentar pasar a `'EN_REVISION'` algún control `'IMPLEMENTADO'` o `'PARCIAL'` no tiene evidencia, rechazar con `400` indicando qué controles (`codigo_iso`) carecen de evidencia (`CP-06`).
5. **RN05 / CP-07 (Integridad de Hallazgos y Código Automático `H-nn`)**:
   - Todo hallazgo exige `condicion`, `criterio`, `causa`, `efecto_riesgo` y `severidad` (`'ALTA' | 'MEDIA' | 'BAJA'`). Si falta cualquiera (por ejemplo, `causa` vacía), rechazar con `400` (`CP-07`).
   - El código `H-01`, `H-02`, `H-03`... se calcula automáticamente en el backend como el **mayor número existente + 1** dentro de la auditoría (no con `COUNT(*)`, porque al eliminar un hallazgo intermedio el conteo repetiría un código ya usado). El código debe ser **único por auditoría** (regla de integridad del modelo de datos del documento de ejemplo); como `hallazgo` no tiene `id_auditoria`, la unicidad se valida en el backend dentro de la misma transacción. Ejemplo:
     ```sql
     SELECT COALESCE(MAX(SPLIT_PART(h.codigo, '-', 2)::INT), 0) + 1 AS siguiente
     FROM hallazgo h JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
     WHERE e.id_auditoria = $1;
     ```
     La misma regla aplica al consecutivo `EV-nn` de evidencias.
6. **RN06 / CP-08 (Condiciones de Cierre de Auditoría)**:
   - Para cambiar el estado de una auditoría a `'CERRADA'`, el backend verifica:
     1. Todos los controles seleccionados están evaluados (ninguno en `'PENDIENTE'`).
     2. Todos los controles `'IMPLEMENTADO'` y `'PARCIAL'` tienen al menos una evidencia.
     3. Existen **al menos 3 hallazgos** documentados en la auditoría (`total_hallazgos >= 3`).
     4. **Cada hallazgo** de la auditoría tiene **al menos 1 recomendación** asociada (`hallazgos_sin_recomendacion === 0`).
   - Si no se cumple, rechazar con `400` detallando el motivo exacto (`CP-08`).
7. **RN07 / CP-13 (Seguridad por Rol y Bloqueo de Auditoría Cerrada - RNF04)**:
   - **Rol `auditor` vs `admin`**: Solo un usuario con `rol === 'admin'` puede crear o editar controles del catálogo maestro (`POST /api/controles`, `PUT /api/controles/:id`). Si un `'auditor'` lo intenta, retornar `403 Forbidden` con `{ ok: false, error: "Acceso denegado: solo el rol Administrador puede modificar el catálogo normativo ISO/IEC 27002:2022." }`.
   - **Inmutabilidad de Auditoría `CERRADA`**: Si una auditoría tiene `estado === 'CERRADA'`, cualquier intento de modificar sus datos generales, cambiar selección de controles, editar evaluaciones, agregar/borrar evidencias, o agregar/editar/borrar hallazgos y recomendaciones debe ser rechazado con `403 Forbidden`: `{ ok: false, error: "Operación denegada: la auditoría se encuentra CERRADA y su registro es inmutable." }`.

---

## 6. Contrato Completo de la API REST (Compartido con Frontend)

Todas las respuestas siguen el sobre JSON estándar:
- **Éxito (`200` / `201`)**: `{ "ok": true, "data": ..., "message"?: "..." }`
- **Error (`400` / `401` / `403` / `404` / `500`)**: `{ "ok": false, "error": "Descripción clara del error", "field"?: "campo_con_error" }`

### 6.1. Salud y Semilla de Base de Datos
- **`GET /api/health`** (Público)
  - Respuesta `200`: `{ "ok": true, "status": "UP", "service": "decr27000-backend", "timestamp": "..." }` (sin el sobre `data`; no consulta la BD).
  - **`GET /api/health?db=1`** agrega `"db": "UP" | "DOWN"` tras un `SELECT 1` (si la BD no responde, `ok` es `false`).
- **`POST /api/seed/reset`** (Protegido o disponible para restaurar datos de demostración de Empresa ABC)
  - Reinicia la base de datos al estado limpio de `SEED_93_CONTROLES_Y_EMPRESA_ABC.sql` (útil durante pruebas o antes de una sustentación).
  - Respuesta `200`: `{ "ok": true, "message": "Base de datos restaurada con los 93 controles ISO 27002:2022 y el caso Empresa ABC." }`

### 6.2. Autenticación y Usuarios (`/api/auth` y `/api/usuarios`)
- **`POST /api/auth/login`** (Público)
  - Request Body:
    ```json
    {
      "correo": "ana.auditora@auditsys.edu.co",
      "password": "Audit2026*"
    }
    ```
  - Respuesta `200`:
    ```json
    {
      "ok": true,
      "data": {
        "token": "eyJhbGciOiJIUzI1NiIsIn...",
        "usuario": {
          "id_usuario": 1,
          "nombre": "Ana R. (Auditora Líder)",
          "correo": "ana.auditora@auditsys.edu.co",
          "rol": "auditor"
        }
      }
    }
    ```
- **`GET /api/auth/me`** (Requiere `Authorization: Bearer <token>`)
  - Respuesta `200`: `{ "ok": true, "data": { "id_usuario": 1, "nombre": "...", "correo": "...", "rol": "auditor" } }`
- **`GET /api/usuarios`** (Requiere Token)
  - Retorna la lista de usuarios para poblar el selector de "Auditor responsable" en la pantalla de Nueva Auditoría.
  - Respuesta `200`: `{ "ok": true, "data": [ { "id_usuario": 1, "nombre": "Ana R. (Auditora Líder)", "correo": "ana.auditora@auditsys.edu.co", "rol": "auditor" }, ... ] }`

### 6.3. Dashboard (`GET /api/dashboard` — RF09, CP-11)
- **`GET /api/dashboard?id_auditoria=1`** (Requiere Token. Si no se envía `id_auditoria`, toma la auditoría más reciente o la `id_auditoria = 1` por defecto).
  - Respuesta `200`:
    ```json
    {
      "ok": true,
      "data": {
        "auditoria_activa": {
          "id_auditoria": 1,
          "organizacion": "Empresa ABC (Prestadora de Servicios Tecnológicos)",
          "objetivo": "Evaluar el estado de implementación de 13 controles seleccionados...",
          "alcance": "Servidores, estaciones de trabajo...",
          "fecha_inicio": "2026-11-09",
          "fecha_fin": "2026-11-23",
          "estado": "EN_REVISION",
          "auditor_nombre": "Ana R. (Auditora Líder)"
        },
        "indicadores": {
          "total_seleccionados": 13,
          "total_evaluados": 13,
          "pendientes": 0,
          "aplicables": 12,
          "implementados": 4,
          "parciales": 5,
          "no_implementados": 3,
          "no_aplicables": 1,
          "cumplimiento_base_pct": 33.3,
          "indice_ponderado_pct": 54.2,
          "total_hallazgos": 4,
          "total_recomendaciones": 4,
          "total_evidencias": 12
        },
        "hallazgos_por_severidad": {
          "ALTA": 2,
          "MEDIA": 2,
          "BAJA": 0
        },
        "auditorias_recientes": [
          {
            "id_auditoria": 1,
            "organizacion": "Empresa ABC (Prestadora de Servicios Tecnológicos)",
            "fecha_inicio": "2026-11-09",
            "fecha_fin": "2026-11-23",
            "estado": "EN_REVISION",
            "auditor_nombre": "Ana R. (Auditora Líder)",
            "total_controles": 13,
            "cumplimiento_base_pct": 33.3,
            "indice_ponderado_pct": 54.2,
            "total_hallazgos": 4
          }
        ]
      }
    }
    ```

### 6.4. Gestión de Auditorías (`/api/auditorias` — RF01, CP-01, CP-02, CP-08, CP-13)
- **`GET /api/auditorias`** (Requiere Token)
  - Lista todas las auditorías con sus métricas resumidas.
- **`GET /api/auditorias/:id`** (Requiere Token)
  - Retorna el detalle de la auditoría `:id` junto con su objeto `indicadores`.
- **`POST /api/auditorias`** (Requiere Token)
  - Request Body:
    ```json
    {
      "organizacion": "Empresa XYZ S.A.S.",
      "objetivo": "Evaluar controles críticos de seguridad de la información.",
      "alcance": "Infraestructura cloud, redes y aplicaciones centrales.",
      "fecha_inicio": "2026-11-10",
      "fecha_fin": "2026-11-24",
      "referentes": "ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022",
      "id_auditor": 1
    }
    ```
  - Respuesta `201`: `{ "ok": true, "message": "Auditoría creada en estado BORRADOR.", "data": { "id_auditoria": 2, "estado": "BORRADOR", ... } }`
- **`PUT /api/auditorias/:id`** (Requiere Token; bloqueado si `estado === 'CERRADA'`)
  - Actualiza `organizacion`, `objetivo`, `alcance`, `fecha_inicio`, `fecha_fin`, `referentes`, `id_auditor`.
- **`PATCH /api/auditorias/:id/estado`** (Requiere Token)
  - Request Body: `{ "estado": "EN_EJECUCION" | "EN_REVISION" | "CERRADA" | "BORRADOR" }`
  - Ejecuta las validaciones de transición (`RN02`, `RN04`, `RN06`, `RN07`). Si pasa todas las validaciones, actualiza el estado y retorna `200`.

### 6.5. Catálogo de los 93 Controles ISO/IEC 27002:2022 (`/api/controles` — RF02, CP-13)
- **`GET /api/controles?categoria=TECNOLOGICO&q=malware`** (Requiere Token)
  - Parámetros opcionales: `categoria` (`ORGANIZACIONAL`, `PERSONAS`, `FISICO`, `TECNOLOGICO`, o vacío para todos) y `q` (búsqueda insensible a mayúsculas/acentos por `codigo_iso`, `nombre` o `criterio`).
  - Ordenado numéricamente por `id_control` (1 al 93).
  - Respuesta `200`:
    ```json
    {
      "ok": true,
      "data": [
        {
          "id_control": 1,
          "codigo_iso": "5.1",
          "categoria": "ORGANIZACIONAL",
          "nombre": "Políticas para la seguridad de la información",
          "criterio": "La política de seguridad de la información y las políticas específicas por tema deben definirse, ser aprobadas por la dirección...",
          "pregunta_orientadora": "¿Existe una política aprobada por la dirección, comunicada y revisada en intervalos planificados?",
          "ejemplo_aplicacion": "Desarrollo de una política de seguridad de la información",
          "evidencia_sugerida": "Documento de política aprobado y comunicado"
        }
      ]
    }
    ```
- **`POST /api/controles`** y **`PUT /api/controles/:id`** (Requiere Token + `requireRole('admin')`)
  - Permite al rol `admin` crear o editar el criterio/pregunta orientadora de un control del catálogo.
  - Si el usuario autenticado tiene `rol === 'auditor'`, devuelve `403 Forbidden` (Caso de Prueba `CP-13`).

### 6.6. Selección y Evaluación de Controles (`/api/auditorias/:id/evaluaciones` — RF02, RF03, CP-03..CP-06)
- **`GET /api/auditorias/:id/evaluaciones`** (Requiere Token)
  - Devuelve los controles seleccionados para la auditoría `:id`, ordenados por código ISO, incluyendo sus listas anidadas de `evidencias` y `hallazgos` (con sus `recomendaciones`).
  - Respuesta `200`:
    ```json
    {
      "ok": true,
      "data": [
        {
          "id_evaluacion": 1,
          "id_auditoria": 1,
          "id_control": 1,
          "codigo_iso": "5.1",
          "categoria": "ORGANIZACIONAL",
          "nombre": "Políticas para la seguridad de la información",
          "criterio": "La política de seguridad de la información y las políticas específicas por tema deben definirse...",
          "pregunta_orientadora": "¿Existe una política aprobada por la dirección, comunicada y revisada en intervalos planificados?",
          "ejemplo_aplicacion": "Desarrollo de una política de seguridad de la información",
          "evidencia_sugerida": "Documento de política aprobado y comunicado",
          "estado": "IMPLEMENTADO",
          "observacion": "Política vigente, aprobada por la gerencia y revisada en 2026.",
          "justificacion_na": null,
          "requiere_evidencia_faltante": false,
          "evidencias": [
            {
              "id_evidencia": 1,
              "codigo_evidencia": "EV-01",
              "descripcion": "Política de seguridad v2.0 (documental)",
              "fuente": "Repositorio Documental SGSI",
              "fecha_evidencia": "2026-11-10",
              "referencia_url": "SGI-POL-001_v2.pdf",
              "es_simulada": true
            }
          ],
          "hallazgos": []
        }
      ]
    }
    ```
- **`PUT /api/auditorias/:id/seleccion-controles`** (Requiere Token; bloqueado si auditoría `CERRADA`)
  - Request Body:
    ```json
    {
      "controles_ids": [1, 15, 18, 24, 40, 47, 64, 66, 67, 72, 74, 82, 90]
    }
    ```
  - Validación `CP-03`: Verifica que `Array.isArray(controles_ids)` y `controles_ids.length >= 10 && controles_ids.length <= 15`. Si no cumple, retorna `400 Bad Request`.
  - Sincroniza `evaluacion_control`: elimina los controles que ya no estén en `controles_ids` e inserta los nuevos con `estado = 'PENDIENTE'` (conservando intactos los que ya estaban seleccionados). Si la auditoría estaba en `'BORRADOR'`, actualiza su estado a `'EN_EJECUCION'`.
- **`PUT /api/evaluaciones/:id_evaluacion`** (Requiere Token; bloqueado si auditoría `CERRADA`)
  - Request Body:
    ```json
    {
      "estado": "IMPLEMENTADO | PARCIAL | NO_IMPLEMENTADO | NO_APLICABLE",
      "observacion": "Texto de observación del auditor...",
      "justificacion_na": "Requerido solo si estado === 'NO_APLICABLE'"
    }
    ```
  - Validaciones `CP-04` y `CP-05`: Rechaza con `400` si `observacion` está vacía o si `estado === 'NO_APLICABLE'` y `justificacion_na` está vacía.

### 6.7. Evidencias (`/api/evaluaciones/:id_evaluacion/evidencias` y `/api/evidencias/:id` — RF04, CP-06)
- **`POST /api/evaluaciones/:id_evaluacion/evidencias`** (Requiere Token; bloqueado si auditoría `CERRADA`)
  - Request Body:
    ```json
    {
      "codigo_evidencia": "EV-13",
      "descripcion": "Política de seguridad v2.0 aprobada",
      "fuente": "Repositorio Documental TI",
      "fecha_evidencia": "2026-11-10",
      "referencia_url": "DOC-POL-2026.pdf",
      "es_simulada": true
    }
    ```
  - Si `codigo_evidencia` viene vacío, el backend genera automáticamente el siguiente consecutivo `EV-01`, `EV-02`... de la auditoría.
- **`DELETE /api/evidencias/:id_evidencia`** (Requiere Token; bloqueado si auditoría `CERRADA`)

### 6.8. Hallazgos y Recomendaciones (`/api/auditorias/:id/hallazgos`, `/api/hallazgos`, `/api/recomendaciones` — RF05, RF06, CP-07, CP-08)
- **`GET /api/auditorias/:id/hallazgos`** (Requiere Token)
  - Retorna todos los hallazgos de la auditoría `:id`, incluyendo los datos del control asociado (`id_evaluacion`, `id_control`, `codigo_iso`, `control_nombre`, `estado_control`) y el arreglo `recomendaciones` de cada hallazgo.
- **`POST /api/evaluaciones/:id_evaluacion/hallazgos`** (Requiere Token; bloqueado si auditoría `CERRADA`)
  - Request Body (permite crear el hallazgo solo o junto con su recomendación inicial en un solo paso):
    ```json
    {
      "condicion": "No se evidencian escaneos ni reportes periódicos de vulnerabilidades.",
      "criterio": "ISO/IEC 27002:2022, control 8.8: Gestión de vulnerabilidades técnicas.",
      "causa": "No hay responsable asignado ni procedimiento de gestión de parches.",
      "efecto_riesgo": "Mayor probabilidad de explotación de vulnerabilidades conocidas.",
      "severidad": "ALTA",
      "recomendacion": {
        "descripcion": "Designar responsable y ejecutar escaneos mensuales.",
        "prioridad": "ALTA",
        "plazo_dias": 60,
        "responsable_sug": "Líder de Infraestructura"
      }
    }
    ```
  - Validación `CP-07`: Verifica que `condicion`, `criterio`, `causa`, `efecto_riesgo` y `severidad` tengan contenido; si falta alguno, devuelve `400 Bad Request`. Genera automáticamente el código `H-01`, `H-02`, etc. Si se incluye el objeto `recomendacion` con `descripcion`, `prioridad` y `plazo_dias`, crea la recomendación asociada dentro de la misma transacción SQL.
- **`PUT /api/hallazgos/:id_hallazgo`** y **`DELETE /api/hallazgos/:id_hallazgo`** (Requiere Token; bloqueado si auditoría `CERRADA`)
- **`POST /api/hallazgos/:id_hallazgo/recomendaciones`** (Requiere Token; bloqueado si auditoría `CERRADA`)
  - Request Body:
    ```json
    {
      "descripcion": "Definir procedimiento formal de respaldo y ejecutar pruebas trimestrales.",
      "prioridad": "MEDIA",
      "plazo_dias": 90,
      "responsable_sug": "Administrador de Servidores"
    }
    ```
- **`DELETE /api/recomendaciones/:id_recomendacion`** (Requiere Token; bloqueado si auditoría `CERRADA`)

### 6.9. Indicadores, Trazabilidad e Informes (`/api/auditorias/:id/...` — RF07, RF08, RNF05, CP-09, CP-10)
- **`GET /api/auditorias/:id/indicadores`** (Requiere Token)
  - Ejecuta la consulta SQL de `RF07` y devuelve los conteos por estado, `cumplimiento_base_pct` e `indice_ponderado_pct`.
- **`GET /api/auditorias/:id/trazabilidad`** (Requiere Token)
  - Ejecuta la consulta SQL de `RNF05` y devuelve la matriz completa de trazabilidad (`Auditoría -> Control -> Evaluación -> Evidencia -> Hallazgo -> Recomendación`).
- **`GET /api/auditorias/:id/informes`** (Requiere Token)
  - Devuelve la estructura consolidada de las **8 secciones del informe** en tiempo real desde la base de datos más el historial de versiones guardadas en la tabla `informe`:
    1. `datos_auditoria` (organización, objetivo, alcance, fechas, auditor, referentes, estado).
    2. `alcance_criterios` (lista de los controles seleccionados con código, categoría, nombre y criterio).
    3. `resultados_indicadores` (conteos por estado, fórmulas explícitas, `cumplimiento_base_pct`, `indice_ponderado_pct`, texto de resumen ejecutivo automático).
    4. `evaluacion_por_control` (estado, observación y justificación de no aplicables).
    5. `hallazgos` (`H-nn`, control asociado, severidad, condición, criterio, causa y efecto/riesgo).
    6. `recomendaciones` (recomendación, prioridad, plazo en días y responsable sugerido por hallazgo).
    7. `anexo_evidencias` (listado de todas las evidencias con código `EV-nn`, control asociado, fuente, fecha, referencia y etiqueta explícita `es_simulada: true/false`).
    8. `limitaciones` (*"Advertencia académica y técnica: El indicador de cumplimiento es descriptivo y no constituye certificación bajo ISO/IEC 27001:2022 ni sustituye el juicio profesional del auditor."*).
- **`POST /api/auditorias/:id/informes`** (Requiere Token)
  - Calcula el siguiente número de `version` (`MAX(version) + 1`), guarda una instantánea oficial en la tabla `informe` con el `snapshot_json` completo y retorna la versión consolidada lista para impresión/exportación PDF (`CP-10`).

---

## 7. Despliegue del Backend en Render (`render.yaml`, plan gratuito)

Valores optimizados para Render gratuito (512 MB de RAM, 0,1 de CPU, se suspende tras 15 min sin tráfico). Detalle en PLAN_DESARROLLO.md §2.6.

```yaml
services:
  - type: web
    name: decr27000-backend
    runtime: node
    plan: free
    region: ohio            # misma región que Supabase (us-east-2)
    buildCommand: NODE_ENV=development pnpm install --frozen-lockfile && pnpm build && pnpm prune --prod
    startCommand: node --max-old-space-size=384 dist/main.js
    healthCheckPath: /api/health
    envVars:
      - { key: NODE_ENV, value: production }
      - { key: DATABASE_URL, sync: false }
      - { key: DB_SSL_CA, sync: false }
      - { key: DB_POOL_MAX, value: "4" }
      - { key: JWT_SECRET, generateValue: true }
      - { key: JWT_EXPIRES_IN, value: 8h }
      - { key: FRONTEND_URL, value: https://decr27000-frontend.vercel.app }
      - { key: SWAGGER_ENABLED, value: "true" }
      - { key: ALLOW_SEED_RESET, value: "false" }
```

- `NODE_ENV=development` va **solo en la instalación**: con `production`, pnpm omite las devDependencies (`@nestjs/cli`, `typescript`) y el build falla con `nest: command not found` (verificado). `pnpm prune --prod` las elimina al final.
- Se arranca con `node` directo (sin `pnpm`) y con el heap limitado a 384 MB. Medición local del build de producción: **~0,6 s de arranque y ~135 MB de RAM**.
- `GET /api/health` no toca la BD (lo consulta Render); `GET /api/health?db=1` verifica la conexión.
- Si el servicio se creó desde el panel de Render (sin Blueprint), estos valores se copian en **Settings → Build & Deploy** antes de fusionar la rama que reemplaza el `index.js` provisional.

### Auto-inicialización segura de la base de datos al arrancar (`src/database/init-db.service.ts`)
Al iniciar, el backend solo ejecuta `SELECT to_regclass('public.control')` y `SELECT COUNT(*) FROM control`. Si las tablas no existen o el catálogo está vacío, carga `SEED_93_CONTROLES_Y_EMPRESA_ABC.sql`, hashea las contraseñas con bcrypt y aplica `sql/security.sql`, todo en una transacción. **Nunca** reinicia una base que ya tiene datos. Si la verificación falla, el servidor sigue arrancando (el health check responde) y el error queda en el log.

### Scripts de mantenimiento de la BD
- `pnpm db:security`: activa RLS en las 8 tablas, revoca privilegios de `anon` y `authenticated` (PostgREST de Supabase) y hashea contraseñas que sigan en texto plano. Es idempotente y no borra datos.
- `pnpm db:seed`: **borra todo** y vuelve a cargar la semilla. Contra una base remota se niega a correr salvo con `SEED_CONFIRM=RESTAURAR-EMPRESA-ABC pnpm db:seed`.

---

## 8. Complementos tomados de los documentos académicos (`/documents`)

Esta sección incorpora lo que exigen `Proyecto_Academico_AuditSys_Mini.docx` (documento orientador) y `AuditSys_Mini_Proyecto_Ejemplo.docx` (ejemplo aplicado y rúbrica) y que no estaba explícito en las secciones anteriores.

### 8.1. Alcance del MVP frente al catálogo de 93 controles
- El documento orientador declara **fuera del alcance obligatorio** implementar los 93 controles del Anexo A. Lo obligatorio es que cada auditoría **seleccione y evalúe entre 10 y 15 controles** (`RF02`, `RN02`).
- Cargar los 93 controles en la tabla `control` es una **extensión** que facilita la selección; no reemplaza la regla de 10 a 15. En la sustentación conviene aclararlo para que no se interprete como evaluación del Anexo A completo.
- Regla de alcance del documento: *"Se evaluará la calidad y trazabilidad del flujo implementado, no la cantidad de módulos adicionales."*

### 8.2. Interpretación de los estados de evaluación (sección 10.1 del documento orientador)

| Estado (`evaluacion_control.estado`) | Interpretación auditora | Regla del sistema |
| :--- | :--- | :--- |
| `IMPLEMENTADO` | Existe evidencia suficiente de que el control está implementado y opera según el criterio definido. | Exige ≥ 1 evidencia para pasar a `EN_REVISION` (`RN04`). |
| `PARCIAL` | El control existe, pero presenta brechas de cobertura, formalización u operación. | Exige ≥ 1 evidencia (`RN04`); suma 0,5 en el índice ponderado. |
| `NO_IMPLEMENTADO` | No se evidencia implementación del control frente al criterio evaluado. | Candidato natural a hallazgo (`RF05`). |
| `NO_APLICABLE` | El control no aplica al alcance o contexto. | Exige `justificacion_na` (`RN03`) y se excluye del denominador (`RF07`). |
| `PENDIENTE` | Estado técnico interno: control seleccionado aún no evaluado. | Impide el cierre (`RN06`). No es uno de los 4 estados académicos. |

El indicador es **descriptivo**: *"El resultado no equivale a una certificación ni sustituye el juicio profesional del auditor."* (sección 10.2). Los controles parciales que no generan hallazgo (en Empresa ABC: 5.18, 6.3, 8.5 y 8.23) quedan como **oportunidades de mejora** dentro de su observación.

### 8.3. Matriz de trazabilidad de requisitos

| Requisito | Criterio mínimo de aceptación (documento orientador) | Endpoint(s) | Pantalla | Casos de prueba |
| :--- | :--- | :--- | :--- | :--- |
| `RF01` Registrar auditoría | Organización, objetivo, alcance, fecha y responsable. | `POST/PUT /api/auditorias` | `auditoria.html` | CP-01, CP-02 |
| `RF02` Gestionar controles | Consultar entre 10 y 15 controles seleccionados con su criterio. | `GET /api/controles`, `PUT /api/auditorias/:id/seleccion-controles` | `catalogo.html` | CP-03, CP-13 |
| `RF03` Evaluar controles | Asignar uno de los 4 estados y guardar observaciones. | `PUT /api/evaluaciones/:id` | `evaluacion.html` | CP-04, CP-05 |
| `RF04` Registrar evidencias | Descripción, fuente, fecha y archivo o referencia. | `POST /api/evaluaciones/:id/evidencias` | `evaluacion.html` | CP-06 |
| `RF05` Documentar hallazgos | Condición, criterio, causa, efecto/riesgo y severidad. | `POST /api/evaluaciones/:id/hallazgos` | `hallazgos.html` | CP-07 |
| `RF06` Asociar recomendaciones | Vincular la recomendación con su hallazgo. | `POST /api/hallazgos/:id/recomendaciones` | `hallazgos.html` | CP-08 |
| `RF07` Calcular resultados | Cantidades y porcentajes con fórmula explícita; N/A fuera del denominador. | `GET /api/auditorias/:id/indicadores` | `informe.html`, `dashboard.html` | CP-09 |
| `RF08` Generar informe | Datos, alcance, resultados, hallazgos y recomendaciones desde la BD. | `GET/POST /api/auditorias/:id/informes` | `informe.html` | CP-10 |
| `RF09` Dashboard | Cuadro integral de indicadores de gestión de auditorías. | `GET /api/dashboard` | `dashboard.html` | CP-11 |
| `RNF01` Usabilidad y adaptabilidad | Flujo completo en escritorio y móvil. | — | Todas (360 px) | CP-12 |
| `RNF02` Persistencia | Los datos permanecen tras cerrar y reabrir. | PostgreSQL | Todas | CP-01, CP-12 |
| `RNF03` Validación | Obligatorios y formatos validados antes de guardar (cliente y servidor). | Todas las mutaciones (`400` + `field`) | Todas | CP-02, CP-04, CP-05, CP-07 |
| `RNF04` Seguridad básica | Acceso restringido a funciones administrativas. | JWT + `requireRole('admin')` + `auditLock` | `login.html`, `catalogo.html` | CP-13 |
| `RNF05` Trazabilidad | Evidencia y hallazgo relacionados con control y auditoría. | `GET /api/auditorias/:id/trazabilidad` | `hallazgos.html` | CP-10 |
| `RNF06` Mantenibilidad | Código modular con instrucciones de ejecución. | Estructura de la sección 2 + `README.md` | — | — |

### 8.4. Plan de pruebas oficial (`CP-01` a `CP-13`)

| ID | Caso | Datos de entrada | Resultado esperado |
| :--- | :--- | :--- | :--- |
| CP-01 | Crear auditoría válida | Datos completos de Empresa ABC. | Aparece en la lista en estado `BORRADOR`. |
| CP-02 | Crear auditoría incompleta | Fecha de cierre vacía. | Mensaje junto al campo; no se guarda. |
| CP-03 | Selección fuera de rango | 9 controles y luego 16 controles. | Se bloquea el paso a ejecución con mensaje del rango 10 a 15. |
| CP-04 | Evaluar sin observación | Estado `PARCIAL` y observación vacía. | Se rechaza el guardado. |
| CP-05 | No aplicable sin justificación | Control 8.31 sin justificación. | Se rechaza; con justificación se guarda y se excluye del denominador. |
| CP-06 | Implementado sin evidencia | Control 5.1 sin evidencia. | Alerta y bloqueo del paso a revisión. |
| CP-07 | Hallazgo incompleto | Hallazgo sin causa. | Se rechaza; completo genera el código `H-nn`. |
| CP-08 | Cierre sin recomendación | Hallazgo sin recomendación o menos de tres hallazgos. | Se impide el cierre de la auditoría. |
| CP-09 | Cálculo de indicadores | 4 implementados, 5 parciales, 3 no implementados y 1 no aplicable. | 33,3 % de cumplimiento base y 54,2 % de índice ponderado. |
| CP-10 | Generación de informe | Auditoría completa. | El informe coincide con la BD y marca las evidencias simuladas. |
| CP-11 | Dashboard | Datos de Empresa ABC. | Las tarjetas coinciden con el informe. |
| CP-12 | Persistencia y móvil | Cerrar y reabrir; ancho de 360 px. | Los datos permanecen y el flujo es operable. |
| CP-13 | Acceso por rol y cierre | Auditor intenta editar el catálogo; edición de una auditoría cerrada. | Acceso denegado en ambos casos (`RNF04`). |

Cada caso debe ejecutarse con un resultado positivo y uno negativo cuando aplique, y registrarse con su evidencia en el **Informe de pruebas** (entregable 5).

### 8.5. Definición de terminado y lista de verificación del día 5
**Definición de terminado** (una funcionalidad está terminada cuando):
1. Cumple el criterio de aceptación de su requisito (tabla 8.3).
2. Valida los datos en cliente **y** en servidor y muestra mensajes claros.
3. Persiste la información y conserva la trazabilidad.
4. Tiene al menos un caso de prueba positivo y uno negativo ejecutados.
5. Está integrada en la rama `main` y puede demostrarse con los datos de Empresa ABC.

**Checklist del día 5**: auditoría creada y consultable tras recargar; catálogo que muestra y permite seleccionar controles; BD con llaves foráneas y restricciones `CHECK`; autenticación básica documentada; `README.md` con instrucciones de ejecución; prototipos de las pantallas 1 a 4 aprobados; plan de datos de ejemplo de Empresa ABC.

### 8.6. Entregables y rúbrica (resumen)

| N.º | Entregable | Contenido mínimo |
| :--- | :--- | :--- |
| 1 | Modelado de la solución | Casos de uso, modelo entidad-relación y arquitectura o componentes. |
| 2 | Prototipo de interfaces | Vistas principales del flujo de auditoría. |
| 3 | Código fuente | Repositorio organizado con instrucciones de instalación y ejecución. |
| 4 | Aplicación funcional | MVP con persistencia y flujo principal operativo. |
| 5 | Informe de pruebas | Casos CP-01 a CP-13 ejecutados, resultados y defectos. |
| 6 | Informe de auditoría | Documento **generado por la aplicación** (no elaborado a mano). |
| 7 | Sustentación | Demostración funcional y explicación de decisiones técnicas. |

Ponderación: Fundamentación auditora y normativa 15 % · Requisitos y modelado 15 % · Arquitectura y datos 15 % · Funcionalidad 30 % · Pruebas y calidad 10 % · Sustentación 15 %. **Señales de alerta** de la rúbrica que el sistema debe evitar: porcentaje presentado como certificación, datos solo en memoria o sin integridad, informe elaborado manualmente y ausencia de pruebas negativas.

### 8.7. Extensión opcional alineada con ISO 19011:2026
ISO 19011:2026 trata los métodos de auditoría presencial, remoto e híbrido como opciones equivalentes. Si el equipo quiere reforzar la fundamentación normativa, puede añadir a `evidencia` una columna opcional que no rompe la semilla:
```sql
ALTER TABLE evidencia
  ADD COLUMN metodo_obtencion VARCHAR(10) NOT NULL DEFAULT 'PRESENCIAL'
  CHECK (metodo_obtencion IN ('PRESENCIAL', 'REMOTO', 'HIBRIDO'));
```
y mostrarla en el anexo de evidencias del informe (sección 7). Es opcional y no forma parte de los criterios de aceptación del MVP.
