# AUDITSYS MINI — ESPECIFICACIÓN TÉCNICA COMPLETA DE BACKEND Y BASE DE DATOS (`/backend`)

> **Propósito de este documento**: Este archivo contiene la especificación técnica, arquitectónica, de base de datos, reglas de negocio y contrato de API REST **100% autocontenida** para que una Inteligencia Artificial (o equipo de desarrollo) construya de principio a fin el módulo `/backend` de **AuditSys Mini – Sistema de Gestión de Auditorías de Sistemas de Información (ISO/IEC 27001:2022 & ISO/IEC 27002:2022)**.

---

## 1. Contexto General y Arquitectura del Proyecto

- **Nombre del Sistema**: AuditSys Mini – Sistema de Gestión de Auditorías de Sistemas de Información.
- **Referentes Normativos**:
  - **ISO 19011:2018**: Directrices para la auditoría de los sistemas de gestión (principios de integridad, presentación imparcial, debido cuidado profesional, enfoque basado en la evidencia y enfoque basado en riesgos).
  - **ISO/IEC 27001:2022**: Requisitos del Sistema de Gestión de Seguridad de la Información (SGSI) y Anexo A (93 controles).
  - **ISO/IEC 27002:2022**: Controles de seguridad de la información (organizados en 4 categorías: **5. Organizacionales [37]**, **6. Personas/TTHH [8]**, **7. Físicos [14]** y **8. Tecnológicos [34]** = **93 controles en total**).
- **Arquitectura del Repositorio**: Dos repositorios sincronizados en GitHub:
  - **Backend (`JuanDulcey/decr27000-backend`)**: API RESTful en **Node.js + Express + PostgreSQL (`pg`)**, desplegada en **Render** en la URL oficial: `https://decr27000-backend.onrender.com` (prefijo API: `https://decr27000-backend.onrender.com/api`).
  - **Frontend (`JuanDulcey/decr27000-frontend`)**: Aplicación Web Multipágina (MPA) en **HTML5 + CSS3 (Variables CSS + Tailwind CDN) + Vanilla JavaScript (ES6 Modules)**, desplegada en **Vercel** en la URL oficial: `https://decr27000-frontend.vercel.app`.
- **Base de Datos**: **PostgreSQL** (compatible con AWS RDS, Neon, Supabase o PostgreSQL local) conectada mediante la variable de entorno `DATABASE_URL` y el driver nativo `pg` con consultas SQL parametrizadas (sin ORM opaco, para evidenciar explícitamente llaves foráneas, restricciones `CHECK` y funciones SQL exigidas por la rúbrica académica).

---

## 2. Estructura de Carpetas del Repositorio Backend (`decr27000-backend`)

La IA debe generar exactamente la siguiente estructura modular en la raíz del repositorio `decr27000-backend` (cumpliendo el requisito no funcional de mantenibilidad **RNF06**):

```text
decr27000-backend/
├── package.json
├── .env.example
├── render.yaml
├── SEED_93_CONTROLES_Y_EMPRESA_ABC.sql # Script SQL completo en la raíz (y/o en sql/init.sql)
└── src/
    ├── server.js                     # Punto de entrada: inicia servidor HTTP y verifica conexión BD
    ├── app.js                        # Configuración de Express, CORS, JSON body-parser, rutas y manejo de errores
    ├── config/
    │   ├── db.js                     # Pool de conexión pg (DATABASE_URL con soporte SSL)
    │   └── initDb.js                 # Script ejecutable (npm run db:seed) que carga sql/init.sql y hashea passwords
    ├── middlewares/
    │   ├── auth.middleware.js        # Verificación de JWT (verifyToken) y control de roles (requireRole('admin'))
    │   └── auditLock.middleware.js   # Bloquea mutaciones (403) si la auditoría está en estado 'CERRADA' (CP-13)
    ├── controllers/
    │   ├── auth.controller.js        # Login, perfil actual, listado de usuarios auditores
    │   ├── dashboard.controller.js   # Indicadores globales y por auditoría (RF09, CP-11)
    │   ├── auditorias.controller.js  # CRUD de auditorías, validaciones de transición de estado (RF01, CP-01..CP-08)
    │   ├── controles.controller.js   # Consulta de los 93 controles ISO 27002 y edición restringida a 'admin' (RF02, CP-13)
    │   ├── evaluaciones.controller.js# Selección de 10-15 controles y evaluación de estado/observación (RF02, RF03, CP-03..CP-06)
    │   ├── evidencias.controller.js  # Registro y eliminación de evidencias con marca es_simulada (RF04, CP-06)
    │   ├── hallazgos.controller.js   # Registro de hallazgos (H-nn) y recomendaciones asociadas (RF05, RF06, CP-07, CP-08)
    │   └── informes.controller.js    # Cálculo de indicadores (RF07), trazabilidad (RNF05) y snapshot de informe (RF08, CP-09, CP-10)
    └── routes/
        ├── auth.routes.js
        ├── dashboard.routes.js
        ├── auditorias.routes.js
        ├── controles.routes.js
        ├── evaluaciones.routes.js
        ├── evidencias.routes.js
        ├── hallazgos.routes.js
        └── informes.routes.js
```

### 2.1. Dependencias (`backend/package.json`)

```json
{
  "name": "decr27000-backend",
  "version": "1.0.0",
  "description": "API REST para DECR 27000 (AuditSys Mini) - Gestión de Auditorías ISO/IEC 27002:2022",
  "main": "src/server.js",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "db:seed": "node src/config/initDb.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "pg": "^8.12.0"
  }
}
```

### 2.2. Variables de Entorno (`backend/.env.example`)

```env
PORT=4000
DATABASE_URL=postgresql://usuario:password@host:5432/auditsys_db?sslmode=require
JWT_SECRET=decr27000_iso27002_secret_key_2026_segura
CORS_ORIGIN=*
```

> **Configuración de CORS en `src/app.js`**:
> Habilitar `app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))` para permitir comunicación total sin bloqueos desde `https://decr27000-frontend.vercel.app`, subdominios preview de Vercel (`*.vercel.app`) y entornos locales (`http://localhost:*`).

> **Nota sobre Conexión a PostgreSQL (`src/config/db.js`)**:
> Configurar `new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false } })` para que funcione sin cambios tanto en PostgreSQL local como en AWS RDS, Neon o Supabase.

---

## 3. Modelo de Datos Relacional y Reglas de Integridad (PostgreSQL)

El archivo SQL completo con las 8 tablas, los **93 controles oficiales de ISO/IEC 27002:2022** y la auditoría completa de **Empresa ABC** ya se encuentra generado en:
`context/SEED_93_CONTROLES_Y_EMPRESA_ABC.sql` (el script `src/config/initDb.js` debe leer este archivo o `backend/sql/init.sql`, ejecutarlo y asegurarse de que las contraseñas de los usuarios semilla queden hasheadas con `bcryptjs` para la clave `Audit2026*`).

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
  referentes    VARCHAR(250) NOT NULL DEFAULT 'ISO 19011:2018; ISO/IEC 27001:2022; ISO/IEC 27002:2022',
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
   - El código `H-01`, `H-02`, `H-03`... se calcula automáticamente en el backend contando cuántos hallazgos tiene esa auditoría hasta el momento.
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
  - Respuesta `200`: `{ "ok": true, "status": "UP", "service": "auditsys-mini-backend", "timestamp": "..." }`
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
      "referentes": "ISO 19011:2018; ISO/IEC 27001:2022; ISO/IEC 27002:2022",
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
          "criterio": "Garantizar la idoneidad, la adecuación y la eficacia continuas...",
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
          "criterio": "Garantizar la idoneidad...",
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

## 7. Despliegue del Backend en Render (`backend/render.yaml`)

Incluir un archivo `backend/render.yaml` y soporte de `PORT` dinámico (`process.env.PORT || 4000`) para despliegue inmediato en Render:

```yaml
services:
  - type: web
    name: decr27000-backend
    env: node
    buildCommand: pnpm install
    startCommand: pnpm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
      - key: DATABASE_URL
        sync: false
      - key: CORS_ORIGIN
        value: "*"
```

### Auto-inicialización Segura de Base de Datos al Arrancar (`src/server.js`)
Al iniciar el servidor (`npm start`), el backend debe verificar si la tabla `control` existe y tiene los 93 registros (`SELECT COUNT(*) FROM control`). Si la base de datos está vacía o las tablas no existen, el servidor debe ejecutar automáticamente el script de inicialización (`SEED_93_CONTROLES_Y_EMPRESA_ABC.sql` + hasheo bcrypt de las contraseñas de los usuarios semilla) para garantizar que al desplegar en Render o AWS la base de datos quede 100% lista y poblada en el primer arranque sin intervención manual.
