-- ============================================================================
-- AUDITSYS MINI - ESQUEMA POSTGRESQL Y SEMILLA COMPLETA (93 CONTROLES + EMPRESA ABC)
-- Basado en ISO/IEC 27001:2022, ISO/IEC 27002:2022 e ISO 19011:2018
-- ============================================================================

DROP TABLE IF EXISTS informe CASCADE;
DROP TABLE IF EXISTS recomendacion CASCADE;
DROP TABLE IF EXISTS hallazgo CASCADE;
DROP TABLE IF EXISTS evidencia CASCADE;
DROP TABLE IF EXISTS evaluacion_control CASCADE;
DROP TABLE IF EXISTS auditoria CASCADE;
DROP TABLE IF EXISTS control CASCADE;
DROP TABLE IF EXISTS usuario CASCADE;

-- 1. TABLA USUARIO
CREATE TABLE usuario (
  id_usuario    SERIAL PRIMARY KEY,
  nombre        VARCHAR(100) NOT NULL,
  correo        VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(15) NOT NULL CHECK (rol IN ('auditor', 'admin')),
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLA CONTROL (Catalogo de 93 Controles ISO/IEC 27002:2022)
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

-- 3. TABLA AUDITORIA (RF01)
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

-- 4. TABLA EVALUACION_CONTROL (RF02 y RF03)
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

-- 5. TABLA EVIDENCIA (RF04)
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

-- 6. TABLA HALLAZGO (RF05)
CREATE TABLE hallazgo (
  id_hallazgo   SERIAL PRIMARY KEY,
  codigo        VARCHAR(10) NOT NULL,
  id_evaluacion INTEGER NOT NULL REFERENCES evaluacion_control(id_evaluacion) ON DELETE CASCADE,
  condicion     TEXT NOT NULL,
  criterio      TEXT NOT NULL,
  causa         TEXT NOT NULL,
  efecto_riesgo TEXT NOT NULL,
  severidad     VARCHAR(10) NOT NULL CHECK (severidad IN ('ALTA', 'MEDIA', 'BAJA')),
  creado_en     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABLA RECOMENDACION (RF06)
CREATE TABLE recomendacion (
  id_recomendacion SERIAL PRIMARY KEY,
  id_hallazgo      INTEGER NOT NULL REFERENCES hallazgo(id_hallazgo) ON DELETE CASCADE,
  descripcion      TEXT NOT NULL,
  prioridad        VARCHAR(10) NOT NULL CHECK (prioridad IN ('ALTA', 'MEDIA', 'BAJA')),
  plazo_dias       INTEGER NOT NULL CHECK (plazo_dias > 0),
  responsable_sug  VARCHAR(120) DEFAULT 'Líder de TI / Seguridad de la Información',
  creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABLA INFORME (RF08)
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

-- ============================================================================
-- DATOS SEMILLA: USUARIOS, 93 CONTROLES ISO 27002:2022 Y AUDITORIA EMPRESA ABC
-- ============================================================================

-- 1. USUARIOS (Password en texto plano manejado por el script seed del backend: Audit2026*)
INSERT INTO usuario (id_usuario, nombre, correo, password_hash, rol) VALUES
(1, 'Ana R. (Auditora Líder)', 'ana.auditora@auditsys.edu.co', 'Audit2026*', 'auditor'),
(2, 'Administrador SGSI', 'admin@auditsys.edu.co', 'Audit2026*', 'admin');
SELECT setval('usuario_id_usuario_seq', 2);

-- 2. LOS 93 CONTROLES DE LA NORMA ISO/IEC 27002:2022
INSERT INTO control (id_control, codigo_iso, categoria, nombre, criterio, pregunta_orientadora, ejemplo_aplicacion, evidencia_sugerida) VALUES
(1, '5.1', 'ORGANIZACIONAL', 'Políticas para la seguridad de la información', 'Garantizar la idoneidad, la adecuación y la eficacia continuas de la dirección de gestión y el apoyo a la seguridad de la información de acuerdo con los requisitos comerciales, legales, estatutarios, reglamentarios y contractuales.', '¿Existe una política aprobada por la dirección, comunicada y revisada en intervalos planificados?', 'Desarrollo de una política de seguridad de la información', 'Documento de política aprobado y comunicado'),
(2, '5.2', 'ORGANIZACIONAL', 'Roles y responsabilidades de seguridad de la información', 'Los roles y responsabilidades de seguridad de la información deben definirse y asignarse de acuerdo con las necesidades de la organización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.2 (Roles y responsabilidades de seguridad de la información)?', 'Asignación de roles de seguridad a empleados', 'Organigrama y descripciones de roles'),
(3, '5.3', 'ORGANIZACIONAL', 'Segregación de deberes', 'Deben segregarse los deberes conflictivos y las áreas conflictivas de responsabilidad.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.3 (Segregación de deberes)?', 'Separación de funciones de desarrollo y producción', 'Procedimientos documentados de segregación de deberes'),
(4, '5.4', 'ORGANIZACIONAL', 'Responsabilidades de gestión (la dirección)', 'La gerencia debe exigir a todo el personal que aplique la seguridad de la información de acuerdo con la política de seguridad de la información establecida, las políticas y los procedimientos específicos del tema de la organización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.4 (Responsabilidades de gestión (la dirección))?', 'Reuniones de gestión sobre seguridad de la información', 'Actas de reuniones y decisiones tomadas'),
(5, '5.5', 'ORGANIZACIONAL', 'Contacto con las autoridades', 'La organización debe establecer y mantener contacto con las autoridades pertinentes.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.5 (Contacto con las autoridades)?', 'Establecimiento de un canal de comunicación con autoridades', 'Registros de comunicación y contactos establecidos'),
(6, '5.6', 'ORGANIZACIONAL', 'Contacto con grupos de interés especial', 'La organización debe establecer y mantener contacto con grupos de interés especial u otros foros especializados en seguridad y asociaciones profesionales.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.6 (Contacto con grupos de interés especial)?', 'Colaboración con grupos de ciberseguridad', 'Informes de colaboración y reuniones'),
(7, '5.7', 'ORGANIZACIONAL', 'Inteligencia de amenazas', 'La información relacionada con las amenazas a la seguridad de la información debe recopilarse y analizarse para generar información sobre amenazas.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.7 (Inteligencia de amenazas)?', 'Implementación de un sistema de monitoreo de amenazas', 'Informes de análisis de amenazas y acciones tomadas'),
(8, '5.8', 'ORGANIZACIONAL', 'Seguridad de la información en la gestión de proyectos', 'La seguridad de la información debe integrarse en la gestión de proyectos.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.8 (Seguridad de la información en la gestión de proyectos)?', 'Evaluación de riesgos de seguridad en proyectos', 'Informes de evaluación de riesgos'),
(9, '5.9', 'ORGANIZACIONAL', 'Inventario de información y otros activos asociados', 'Se debe desarrollar y mantener un inventario de información y otros activos asociados, incluidos los propietarios.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.9 (Inventario de información y otros activos asociados)?', 'Mantenimiento de un inventario de activos de información', 'Registro de inventario actualizado'),
(10, '5.10', 'ORGANIZACIONAL', 'Uso aceptable de información y otros activos asociados', 'Deben identificarse, documentarse e implementarse reglas para el uso aceptable y procedimientos para el manejo de la información y otros activos asociados.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.10 (Uso aceptable de información y otros activos asociados)?', 'Políticas de uso aceptable para empleados', 'Documento de política de uso aceptable'),
(11, '5.11', 'ORGANIZACIONAL', 'Retorno de los activos', 'El personal y otras partes interesadas, según corresponda, deben devolver todos los activos de la organización que estén en su poder al cambiar o terminar su empleo, contrato o acuerdo.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.11 (Retorno de los activos)?', 'Proceso de devolución de equipos al finalizar el empleo', 'Registros de devolución de activos'),
(12, '5.12', 'ORGANIZACIONAL', 'Clasificación de información', 'La información debe clasificarse de acuerdo con las necesidades de seguridad de la información de la organización en función de la confidencialidad, la integridad, la disponibilidad y los requisitos pertinentes de las partes interesadas.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.12 (Clasificación de información)?', 'Clasificación de documentos según su sensibilidad', 'Registros de clasificación y etiquetado de documentos'),
(13, '5.13', 'ORGANIZACIONAL', 'Etiquetado de información', 'Se debe desarrollar e implementar un conjunto apropiado de procedimientos para el etiquetado de la información de acuerdo con el esquema de clasificación de la información adoptado por la organización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.13 (Etiquetado de información)?', 'Etiquetado de documentos confidenciales', 'Ejemplos de documentos etiquetados'),
(14, '5.14', 'ORGANIZACIONAL', 'Transferencia de información', 'Deben existir reglas, procedimientos o acuerdos de transferencia de información para todos los tipos de instalaciones de transferencia dentro de la organización y entre la organización y otras partes.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.14 (Transferencia de información)?', 'Procedimientos para la transferencia segura de datos', 'Registros de transferencias y protocolos de seguridad'),
(15, '5.15', 'ORGANIZACIONAL', 'Control de acceso', 'Las reglas para controlar el acceso físico y lógico a la información y otros activos asociados deben establecerse e implementarse en función de los requisitos comerciales y de seguridad de la información.', '¿Hay reglas de acceso basadas en requisitos del negocio y de seguridad?', 'Implementación de controles de acceso a sistemas', 'Registros de acceso y auditorías de seguridad'),
(16, '5.16', 'ORGANIZACIONAL', 'Gestión de identidad', 'Debe gestionarse el ciclo de vida completo de las identidades.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.16 (Gestión de identidad)?', 'Uso de sistemas de gestión de identidades', 'Registros de gestión de identidades'),
(17, '5.17', 'ORGANIZACIONAL', 'Información de autenticación', 'La asignación y gestión de la información de autenticación debe controlarse mediante un proceso de gestión, incluido el asesoramiento al personal sobre el manejo adecuado de la información de autenticación.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.17 (Información de autenticación)?', 'Almacenamiento seguro de contraseñas', 'Registros de contraseñas y políticas de gestión'),
(18, '5.18', 'ORGANIZACIONAL', 'Derechos de acceso', 'Los derechos de acceso a la información y otros activos asociados deben proporcionarse, revisarse, modificarse y eliminarse de acuerdo con la política y las reglas de control de acceso específicas del tema de la organización.', '¿Se aprueban, revisan y retiran los derechos de acceso mediante un procedimiento?', 'Asignación de derechos de acceso basados en roles', 'Registros de derechos de acceso y auditorías'),
(19, '5.19', 'ORGANIZACIONAL', 'Seguridad de la información en las relaciones con los proveedores', 'Deben definirse e implementarse procesos y procedimientos para gestionar los riesgos de seguridad de la información asociados con el uso de los productos o servicios del proveedor.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.19 (Seguridad de la información en las relaciones con los proveedores)?', 'Evaluación de seguridad de proveedores', 'Informes de evaluación de proveedores'),
(20, '5.20', 'ORGANIZACIONAL', 'Abordar la seguridad de la información dentro de los acuerdos de proveedores', 'Los requisitos de seguridad de la información pertinentes deben establecerse y acordarse con cada proveedor en función del tipo de relación con el proveedor.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.20 (Abordar la seguridad de la información dentro de los acuerdos de proveedores)?', 'Inclusión de cláusulas de seguridad en contratos', 'Copias de contratos con cláusulas de seguridad'),
(21, '5.21', 'ORGANIZACIONAL', 'Gestión de la seguridad de la información en la cadena de suministro de las TIC', 'Deben definirse e implementarse procesos y procedimientos para gestionar los riesgos de seguridad de la información asociados con la cadena de suministro de productos y servicios de TIC.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.21 (Gestión de la seguridad de la información en la cadena de suministro de las TIC)?', 'Evaluación de riesgos en la cadena de suministro', 'Informes de evaluación de riesgos en la cadena de suministro'),
(22, '5.22', 'ORGANIZACIONAL', 'Monitoreo, revisión y gestión de cambios de servicios de proveedores', 'La organización debe monitorear, revisar, evaluar y gestionar periódicamente los cambios en las prácticas de seguridad de la información del proveedor y la prestación de servicios.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.22 (Monitoreo, revisión y gestión de cambios de servicios de proveedores)?', 'Revisión periódica de servicios de proveedores', 'Informes de revisión y auditorías'),
(23, '5.23', 'ORGANIZACIONAL', 'Seguridad de la información para el uso de servicios en la nube', 'Los procesos de adquisición, uso, gestión y salida de los servicios en la nube deben establecerse de acuerdo con los requisitos de seguridad de la información de la organización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.23 (Seguridad de la información para el uso de servicios en la nube)?', 'Evaluación de proveedores de servicios en la nube', 'Informes de evaluación de proveedores de nube'),
(24, '5.24', 'ORGANIZACIONAL', 'Gestión de incidentes de seguridad de la información Planificación y preparación', 'La organización debe planificar y prepararse para la gestión de incidentes de seguridad de la información definiendo, estableciendo y comunicando procesos, funciones y responsabilidades de gestión de incidentes de seguridad de la información.', '¿Hay procesos, roles y responsabilidades definidos para gestionar incidentes?', 'Establecimiento de un plan de respuesta a incidentes', 'Plan de respuesta documentado y pruebas realizadas'),
(25, '5.25', 'ORGANIZACIONAL', 'Evaluación y decisión sobre eventos de seguridad de la información', 'La organización debería evaluar los eventos de seguridad de la información y decidir si se clasificarán como incidentes de seguridad de la información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.25 (Evaluación y decisión sobre eventos de seguridad de la información)?', 'Proceso de evaluación de incidentes', 'Registros de incidentes y decisiones tomadas'),
(26, '5.26', 'ORGANIZACIONAL', 'Respuesta a incidentes de seguridad de la información', 'Se debe responder a los incidentes de seguridad de la información de acuerdo con los procedimientos documentados.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.26 (Respuesta a incidentes de seguridad de la información)?', 'Ejecución de un plan de respuesta a incidentes', 'Informes de incidentes y acciones correctivas'),
(27, '5.27', 'ORGANIZACIONAL', 'Aprender de los incidentes de seguridad de la información', 'El conocimiento obtenido de los incidentes de seguridad de la información debe utilizarse para fortalecer y mejorar los controles de seguridad de la información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.27 (Aprender de los incidentes de seguridad de la información)?', 'Análisis post-incidente para mejorar procesos', 'Informes de análisis post-incidente'),
(28, '5.28', 'ORGANIZACIONAL', 'Recopilación de evidencia', 'La organización debe establecer e implementar procedimientos para la identificación, recopilación, adquisición y preservación de evidencia relacionada con eventos de seguridad de la información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.28 (Recopilación de evidencia)?', 'Documentación de incidentes y recopilación de evidencia', 'Registros de incidentes y evidencia recopilada'),
(29, '5.29', 'ORGANIZACIONAL', 'Seguridad de la información durante eventos disruptivos', 'La organización debe planificar cómo mantener la seguridad de la información en un nivel adecuado durante la interrupción.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.29 (Seguridad de la información durante eventos disruptivos)?', 'Planificación de continuidad del negocio', 'Plan de continuidad del negocio documentado'),
(30, '5.30', 'ORGANIZACIONAL', 'Preparación para las TIC para la continuidad del negocio', 'La preparación de las TIC debe planificarse, implementarse, mantenerse y probarse en función de los objetivos de continuidad del negocio y los requisitos de continuidad de las TIC.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.30 (Preparación para las TIC para la continuidad del negocio)?', 'Evaluación de riesgos de TIC para continuidad', 'Informes de evaluación de riesgos de TIC'),
(31, '5.31', 'ORGANIZACIONAL', 'Requisitos legales, legales, regulatorios y contractuales', 'Los requisitos legales, estatutarios, reglamentarios y contractuales relevantes para la seguridad de la información y el enfoque de la organización para cumplir con estos requisitos deben identificarse, documentarse y mantenerse actualizados.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.31 (Requisitos legales, legales, regulatorios y contractuales)?', 'Cumplimiento de normativas de seguridad', 'Registros de cumplimiento y auditorías'),
(32, '5.32', 'ORGANIZACIONAL', 'Derechos de propiedad intelectual', 'La organización debe implementar procedimientos apropiados para proteger los derechos de propiedad intelectual.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.32 (Derechos de propiedad intelectual)?', 'Protección de propiedad intelectual en contratos', 'Documentación de derechos de propiedad intelectual'),
(33, '5.33', 'ORGANIZACIONAL', 'Protección de registros', 'Los registros deben protegerse contra pérdida, destrucción, falsificación, acceso no autorizado y publicación no autorizada.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.33 (Protección de registros)?', 'Implementación de controles de acceso a registros', 'Registros de acceso y auditorías de seguridad'),
(34, '5.34', 'ORGANIZACIONAL', 'Privacidad y protección de PII', 'La organización debe identificar y cumplir los requisitos relacionados con la preservación de la privacidad y la protección de la PII de acuerdo con las leyes y reglamentos aplicables y los requisitos contractuales.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.34 (Privacidad y protección de PII)?', 'Implementar políticas de privacidad y tratamiento de datos personales (PII) conforme a la ley.', 'Política de tratamiento de datos personales, avisos de privacidad y registro de bases de datos.'),
(35, '5.35', 'ORGANIZACIONAL', 'Revisión independiente de la seguridad de la información', 'El enfoque de la organización para gestionar la seguridad de la información y su implementación, incluidas las personas, los procesos y las tecnologías, debe revisarse de forma independiente a intervalos planificados o cuando se produzcan cambios significativos.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.35 (Revisión independiente de la seguridad de la información)?', 'Realizar auditorías internas o externas independientes sobre el SGSI anualmente.', 'Informes de auditoría independiente y planes de acción derivados.'),
(36, '5.36', 'ORGANIZACIONAL', 'Cumplimiento de las políticas, reglas y estándares para la seguridad de la información', 'El cumplimiento de la política de seguridad de la información de la organización, las políticas específicas del tema, las reglas y los estándares debe revisarse periódicamente.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.36 (Cumplimiento de las políticas, reglas y estándares para la seguridad de la información)?', 'Ejecutar revisiones periódicas de cumplimiento de políticas y estándares de seguridad por área.', 'Listas de verificación de cumplimiento e informes de revisión periódica.'),
(37, '5.37', 'ORGANIZACIONAL', 'Procedimientos operativos documentados', 'Los procedimientos operativos para las instalaciones de procesamiento de información deben documentarse y ponerse a disposición del personal que los necesite.', '¿La organización ha implementado y mantiene evidencias verificables para el control 5.37 (Procedimientos operativos documentados)?', 'Documentar manuales y procedimientos operativos estándar para administración de servidores y redes.', 'Manuales de procedimientos operativos documentados, versionados y socializados.'),
(38, '6.1', 'PERSONAS', 'Selección', 'Los controles de verificación de antecedentes de todos los candidatos para convertirse en personal deben llevarse a cabo antes de unirse a la organización y de manera continua, teniendo en cuenta las leyes, regulaciones y ética aplicables, y deben ser proporcionales a los requisitos comerciales, la clasificación de la información a la que se accede y la riesgos percibidos.', '¿La organización ha implementado y mantiene evidencias verificables para el control 6.1 (Selección)?', 'Realizar entrevistas y verificaciones de antecedentes antes de la contratación.', 'Registros de entrevistas y resultados de verificaciones de antecedentes.'),
(39, '6.2', 'PERSONAS', 'Términos y condiciones de empleo', 'Los acuerdos contractuales de empleo deben establecer las responsabilidades del personal y de la organización para la seguridad de la información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 6.2 (Términos y condiciones de empleo)?', 'Incluir cláusulas de seguridad de la información en los contratos laborales.', 'Copias de contratos laborales con cláusulas de seguridad.'),
(40, '6.3', 'PERSONAS', 'Conciencia de seguridad, educación y capacitación de la información', 'El personal de la organización y las partes interesadas relevantes deben recibir la conciencia, educación y capacitación adecuadas sobre la seguridad de la información y actualizaciones regulares de la política de seguridad de la información de la organización, las políticas y los procedimientos específicos del tema, según sea relevante para su función laboral.', '¿El personal recibe formación periódica y pertinente en seguridad de la información?', 'Implementar un programa de capacitación en seguridad de la información para todos los empleados.', 'Registros de asistencia a capacitaciones y materiales de capacitación.'),
(41, '6.4', 'PERSONAS', 'Proceso Disciplinario', 'Se debe formalizar y comunicar un proceso disciplinario para tomar acciones contra el personal y otras partes interesadas relevantes que hayan cometido una violación de la política de seguridad de la información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 6.4 (Proceso Disciplinario)?', 'Establecer un procedimiento para manejar violaciones de seguridad.', 'Documentación del procedimiento disciplinario y registros de incidentes.'),
(42, '6.5', 'PERSONAS', 'Responsabilidades después de la terminación o cambio de empleo', 'Las responsabilidades y deberes de seguridad de la información que siguen siendo válidos después de la terminación o el cambio de empleo deben definirse, aplicarse y comunicarse al personal pertinente y otras partes interesadas.', '¿La organización ha implementado y mantiene evidencias verificables para el control 6.5 (Responsabilidades después de la terminación o cambio de empleo)?', 'Revocar accesos y recuperar activos de la empresa al finalizar la relación laboral.', 'Registros de revocación de accesos y recuperación de activos.'),
(43, '6.6', 'PERSONAS', 'Acuerdos de confidencialidad o no divulgación', 'Los acuerdos de confidencialidad o no divulgación que reflejen las necesidades de la organización para la protección de la información deben ser identificados, documentados, revisados regularmente y firmados por el personal y otras partes interesadas relevantes.', '¿La organización ha implementado y mantiene evidencias verificables para el control 6.6 (Acuerdos de confidencialidad o no divulgación)?', 'Hacer firmar acuerdos de confidencialidad a todos los empleados.', 'Copias firmadas de acuerdos de confidencialidad.'),
(44, '6.7', 'PERSONAS', 'Trabajo remoto', 'Se deben implementar medidas de seguridad cuando el personal trabaja de forma remota para proteger la información a la que se accede, procesa o almacena fuera de las instalaciones de la organización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 6.7 (Trabajo remoto)?', 'Proporcionar directrices de seguridad para el trabajo remoto.', 'Documentación de políticas de trabajo remoto y registros de capacitación.'),
(45, '6.8', 'PERSONAS', 'Informes de eventos de seguridad de la información', 'La organización debe proporcionar un mecanismo para que el personal informe eventos de seguridad de la información observados o sospechados a través de los canales apropiados de manera oportuna.', '¿La organización ha implementado y mantiene evidencias verificables para el control 6.8 (Informes de eventos de seguridad de la información)?', 'Establecer un procedimiento para reportar incidentes de seguridad.', 'Registros de incidentes reportados y acciones tomadas.'),
(46, '7.1', 'FISICO', 'Perímetros de seguridad física', 'Los perímetros de seguridad deben definirse y utilizarse para proteger las áreas que contienen información y otros activos asociados.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.1 (Perímetros de seguridad física)?', 'Implementar cercas y sistemas de control de acceso en las instalaciones.', 'Informes de auditoría de seguridad y planos de las instalaciones.'),
(47, '7.2', 'FISICO', 'Entrada física', 'Las áreas seguras deben estar protegidas por controles de entrada y puntos de acceso apropiados.', '¿Las áreas seguras tienen controles de entrada y registro de accesos?', 'Controlar el acceso a las instalaciones mediante tarjetas de identificación.', 'Registros de acceso y listas de control de visitantes.'),
(48, '7.3', 'FISICO', 'Asegurar oficinas, habitaciones e instalaciones', 'Debe diseñarse e implementarse la seguridad física de las oficinas, salas e instalaciones.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.3 (Asegurar oficinas, habitaciones e instalaciones)?', 'Instalar cerraduras y sistemas de alarma en áreas sensibles.', 'Informes de instalación de sistemas de seguridad y mantenimiento.'),
(49, '7.4', 'FISICO', 'Monitoreo de seguridad física', 'Las instalaciones deben ser monitoreadas continuamente para detectar accesos físicos no autorizados.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.4 (Monitoreo de seguridad física)?', 'Utilizar cámaras de vigilancia para monitorear áreas críticas.', 'Grabaciones de video y registros de monitoreo.'),
(50, '7.5', 'FISICO', 'Protección contra amenazas físicas y ambientales', 'Se debe diseñar e implementar la protección contra amenazas físicas y ambientales, como desastres naturales y otras amenazas físicas intencionales o no intencionales a la infraestructura.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.5 (Protección contra amenazas físicas y ambientales)?', 'Implementar medidas contra incendios y desastres naturales.', 'Certificados de inspección de seguridad y planes de emergencia.'),
(51, '7.6', 'FISICO', 'Trabajando en áreas seguras', 'Se deben diseñar e implementar medidas de seguridad para trabajar en áreas seguras.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.6 (Trabajando en áreas seguras)?', 'Designar áreas específicas para el manejo de información sensible.', 'Documentación de políticas de seguridad y asignación de áreas.'),
(52, '7.7', 'FISICO', 'Descripción de la pantalla y pantalla clara', 'Deben definirse y aplicarse adecuadamente reglas de escritorio limpio para documentos y medios de almacenamiento extraíbles y reglas de pantalla limpia para las instalaciones de procesamiento de información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.7 (Descripción de la pantalla y pantalla clara)?', 'Asegurar que las pantallas de computadoras no sean visibles desde el exterior.', 'Fotografías de las áreas de trabajo y políticas de seguridad.'),
(53, '7.8', 'FISICO', 'Manejo de equipos y protección', 'El equipo debe estar ubicado de forma segura y protegida.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.8 (Manejo de equipos y protección)?', 'Establecer procedimientos para el manejo seguro de equipos sensibles.', 'Documentación de procedimientos y registros de capacitación.'),
(54, '7.9', 'FISICO', 'Seguridad de activos fuera de las instalaciones', 'Los activos fuera del sitio deben estar protegidos.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.9 (Seguridad de activos fuera de las instalaciones)?', 'Implementar políticas para el transporte seguro de activos.', 'Registros de transporte y auditorías de seguridad.'),
(55, '7.10', 'FISICO', 'Medios de almacenamiento', 'Los medios de almacenamiento deben gestionarse a lo largo de su ciclo de vida de adquisición, uso, transporte y eliminación de acuerdo con el esquema de clasificación y los requisitos de manipulación de la organización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.10 (Medios de almacenamiento)?', 'Asegurar que los medios de almacenamiento sean protegidos y cifrados.', 'Inventarios de medios y registros de acceso.'),
(56, '7.11', 'FISICO', 'Soporte de servicios públicos', 'Los equipos se deben proteger contra fallas de energía y otras interrupciones causadas por fallas en los servicios de suministro.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.11 (Soporte de servicios públicos)?', 'Asegurar que los servicios públicos (agua. electricidad) no comprometan la seguridad.', 'Informes de auditoría de servicios y planes de contingencia.'),
(57, '7.12', 'FISICO', 'Cableado de seguridad', 'Los cables que transportan energía, datos o servicios de información de apoyo deben protegerse contra intercepciones, interferencias o daños.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.12 (Cableado de seguridad)?', 'Utilizar cableado seguro y protegido para evitar interferencias.', 'Informes de instalación y mantenimiento de cableado.'),
(58, '7.13', 'FISICO', 'Mantenimiento de equipo', 'El equipo debe mantenerse correctamente para garantizar la disponibilidad, integridad y confidencialidad de la información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.13 (Mantenimiento de equipo)?', 'Realizar mantenimiento regular de equipos de seguridad.', 'Registros de mantenimiento y auditorías de equipos.'),
(59, '7.14', 'FISICO', 'Eliminación o reutilización segura del equipo', 'Los elementos del equipo que contengan medios de almacenamiento deben verificarse para garantizar que todos los datos confidenciales y el software con licencia se hayan eliminado o sobrescrito de forma segura antes de su eliminación o reutilización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 7.14 (Eliminación o reutilización segura del equipo)?', 'Implementar procedimientos para la eliminación segura de equipos obsoletos.', 'Documentación de eliminación y registros de activos.'),
(60, '8.1', 'TECNOLOGICO', 'Dispositivos de punto final del usuario', 'La información almacenada, procesada o accesible a través de los dispositivos finales de los usuarios debe protegerse.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.1 (Dispositivos de punto final del usuario)?', 'Implementar políticas de seguridad para el uso de dispositivos personales.', 'Documentación de políticas y registros de cumplimiento.'),
(61, '8.2', 'TECNOLOGICO', 'Derechos de acceso privilegiados', 'La asignación y el uso de derechos de acceso privilegiado deben restringirse y gestionarse.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.2 (Derechos de acceso privilegiados)?', 'Limitar el acceso a sistemas críticos solo a personal autorizado.', 'Registros de acceso y auditorías de permisos.'),
(62, '8.3', 'TECNOLOGICO', 'Restricción de acceso a la información', 'El acceso a la información y otros activos asociados debe estar restringido de acuerdo con la política específica del tema establecida sobre control de acceso.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.3 (Restricción de acceso a la información)?', 'Utilizar controles de acceso basados en roles para la información sensible.', 'Informes de auditoría de acceso y registros de permisos.'),
(63, '8.4', 'TECNOLOGICO', 'Acceso al código fuente', 'El acceso de lectura y escritura al código fuente, las herramientas de desarrollo y las bibliotecas de software debe administrarse adecuadamente.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.4 (Acceso al código fuente)?', 'Proteger el acceso al código fuente mediante autenticación multifactor.', 'Registros de acceso y auditorías de seguridad.'),
(64, '8.5', 'TECNOLOGICO', 'Autenticación segura', 'Las tecnologías y los procedimientos de autenticación segura deben implementarse en función de las restricciones de acceso a la información y la política específica del tema sobre el control de acceso.', '¿La autenticación es acorde con el riesgo (por ejemplo, múltiple factor en accesos privilegiados)?', 'Implementar autenticación de dos factores para el acceso a sistemas críticos.', 'Registros de autenticación y auditorías de acceso.'),
(65, '8.6', 'TECNOLOGICO', 'Gestión de capacidad', 'El uso de los recursos debe monitorearse y ajustarse de acuerdo con los requisitos de capacidad actuales y esperados.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.6 (Gestión de capacidad)?', 'Monitorear el uso de recursos para evitar sobrecargas en sistemas.', 'Informes de capacidad y registros de monitoreo.'),
(66, '8.7', 'TECNOLOGICO', 'Protección contra malware', 'La protección contra el malware debe implementarse y respaldarse mediante la conciencia adecuada del usuario.', '¿Existe protección contra malware actualizada en equipos y servidores?', 'Instalar y actualizar software antivirus en todos los dispositivos.', 'Informes de escaneo y registros de actualizaciones.'),
(67, '8.8', 'TECNOLOGICO', 'Gestión de vulnerabilidades técnicas', 'Se debe obtener información sobre las vulnerabilidades técnicas de los sistemas de información en uso, se debe evaluar la exposición de la organización a tales vulnerabilidades y se deben tomar las medidas apropiadas.', '¿Se identifican, evalúan y tratan periódicamente las vulnerabilidades técnicas?', 'Realizar análisis de vulnerabilidades periódicos en sistemas.', 'Informes de análisis y registros de remediación.'),
(68, '8.9', 'TECNOLOGICO', 'Gestión de configuración', 'Las configuraciones, incluidas las configuraciones de seguridad, de hardware, software, servicios y redes deben establecerse, documentarse, implementarse, monitorearse y revisarse.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.9 (Gestión de configuración)?', 'Mantener un inventario de configuraciones de sistemas y aplicaciones.', 'Registros de configuración y auditorías de cumplimiento.'),
(69, '8.10', 'TECNOLOGICO', 'Eliminación de información', 'La información almacenada en sistemas de información, dispositivos o en cualquier otro medio de almacenamiento debe ser eliminada cuando ya no sea necesaria.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.10 (Eliminación de información)?', 'Implementar políticas para la eliminación segura de datos obsoletos.', 'Registros de eliminación y auditorías de datos.'),
(70, '8.11', 'TECNOLOGICO', 'Enmascaramiento de datos', 'El enmascaramiento de datos se debe utilizar de acuerdo con la política específica del tema de la organización sobre el control de acceso y otras políticas relacionadas con el tema específico, y los requisitos comerciales, teniendo en cuenta la legislación aplicable.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.11 (Enmascaramiento de datos)?', 'Utilizar enmascaramiento de datos en entornos de desarrollo.', 'Documentación de procesos y registros de enmascaramiento.'),
(71, '8.12', 'TECNOLOGICO', 'Prevención de fuga de datos', 'Las medidas de prevención de fuga de datos deben aplicarse a los sistemas, redes y cualquier otro dispositivo que procese, almacene o transmita información confidencial.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.12 (Prevención de fuga de datos)?', 'Implementar soluciones DLP (Data Loss Prevention) en la red.', 'Informes de incidentes y registros de monitoreo.'),
(72, '8.13', 'TECNOLOGICO', 'Copia de seguridad de la información', 'Las copias de respaldo de la información, el software y los sistemas deben mantenerse y probarse regularmente de acuerdo con la política de respaldo específica del tema acordada.', '¿Las copias se realizan según una política y se prueba su restauración?', 'Realizar copias de seguridad automáticas de datos críticos.', 'Registros de copias de seguridad y auditorías de recuperación.'),
(73, '8.14', 'TECNOLOGICO', 'Redundancia de instalaciones de procesamiento de información', 'Las instalaciones de procesamiento de información deben implementarse con suficiente redundancia para cumplir con los requisitos de disponibilidad.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.14 (Redundancia de instalaciones de procesamiento de información)?', 'Implementar sistemas de respaldo para garantizar la disponibilidad.', 'Informes de pruebas de recuperación y registros de redundancia.'),
(74, '8.15', 'TECNOLOGICO', 'Registro', 'Se deben producir, almacenar, proteger y analizar registros que registren actividades, excepciones, fallas y otros eventos relevantes.', '¿Se generan, protegen y revisan los registros de actividad?', 'Mantener registros de acceso y cambios en sistemas críticos.', 'Registros de auditoría y documentación de cambios.'),
(75, '8.16', 'TECNOLOGICO', 'Actividades de monitoreo', 'Las redes, los sistemas y las aplicaciones deben monitorearse para detectar comportamientos anómalos y deben tomarse las medidas apropiadas para evaluar posibles incidentes de seguridad de la información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.16 (Actividades de monitoreo)?', 'Monitorear el tráfico de red para detectar actividades sospechosas.', 'Informes de monitoreo y registros de incidentes.'),
(76, '8.17', 'TECNOLOGICO', 'Sincronización de reloj', 'Los relojes de los sistemas de procesamiento de información utilizados por la organización deben sincronizarse con las fuentes de tiempo aprobadas.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.17 (Sincronización de reloj)?', 'Utilizar servidores de tiempo para sincronizar todos los sistemas.', 'Registros de sincronización y auditorías de tiempo.'),
(77, '8.18', 'TECNOLOGICO', 'Uso de programas de utilidad privilegiados', 'El uso de programas de utilidad que puedan anular los controles del sistema y de las aplicaciones debe restringirse y controlarse estrictamente.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.18 (Uso de programas de utilidad privilegiados)?', 'Restringir el uso de herramientas administrativas a personal autorizado.', 'Registros de acceso y auditorías de uso de herramientas.'),
(78, '8.19', 'TECNOLOGICO', 'Instalación de software en sistemas operativos', 'Deben implementarse procedimientos y medidas para gestionar de forma segura la instalación de software en los sistemas operativos.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.19 (Instalación de software en sistemas operativos)?', 'Implementar un proceso de aprobación para la instalación de software.', 'Registros de instalación y auditorías de cumplimiento.'),
(79, '8.20', 'TECNOLOGICO', 'Seguridad de las redes', 'Las redes y los dispositivos de red deben protegerse, administrarse y controlarse para proteger la información en los sistemas y aplicaciones.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.20 (Seguridad de las redes)?', 'Implementar firewalls y sistemas de detección de intrusos.', 'Informes de configuración de red y auditorías de seguridad.'),
(80, '8.21', 'TECNOLOGICO', 'Seguridad de los servicios de red', 'Los mecanismos de seguridad, los niveles de servicio y los requisitos de servicio de los servicios de red deben identificarse, implementarse y monitorearse.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.21 (Seguridad de los servicios de red)?', 'Asegurar que los servicios de red estén protegidos contra ataques.', 'Informes de seguridad y registros de incidentes.'),
(81, '8.22', 'TECNOLOGICO', 'Segregación de redes', 'Los grupos de servicios de información, usuarios y sistemas de información deben estar segregados en las redes de la organización.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.22 (Segregación de redes)?', 'Crear redes separadas para diferentes niveles de seguridad.', 'Documentación de la arquitectura de red y auditorías.'),
(82, '8.23', 'TECNOLOGICO', 'Filtrado web', 'El acceso a sitios web externos debe administrarse para reducir la exposición a contenido malicioso.', '¿Se gestiona el acceso a sitios web externos para reducir la exposición a contenido malicioso?', 'Implementar filtros de contenido para restringir el acceso a sitios peligrosos.', 'Registros de filtrado y auditorías de uso de internet.'),
(83, '8.24', 'TECNOLOGICO', 'Uso de la criptografía', 'Deben definirse e implementarse reglas para el uso eficaz de la criptografía, incluida la gestión de claves criptográficas.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.24 (Uso de la criptografía)?', 'Cifrar datos sensibles en reposo y en tránsito.', 'Registros de cifrado y auditorías de seguridad.'),
(84, '8.25', 'TECNOLOGICO', 'Ciclo de vida de desarrollo seguro', 'Deben establecerse y aplicarse reglas para el desarrollo seguro de software y sistemas.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.25 (Ciclo de vida de desarrollo seguro)?', 'Integrar prácticas de seguridad en el ciclo de vida del desarrollo de software.', 'Documentación de procesos y auditorías de desarrollo.'),
(85, '8.26', 'TECNOLOGICO', 'Requisitos de seguridad de la aplicación', 'Los requisitos de seguridad de la información deben identificarse, especificarse y aprobarse al desarrollar o adquirir aplicaciones.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.26 (Requisitos de seguridad de la aplicación)?', 'Definir y documentar requisitos de seguridad para nuevas aplicaciones.', 'Documentación de requisitos y auditorías de cumplimiento.'),
(86, '8.27', 'TECNOLOGICO', 'Principios de arquitectura e ingeniería de sistema seguro', 'Los principios para diseñar sistemas seguros deben establecerse, documentarse, mantenerse y aplicarse a cualquier actividad de desarrollo de sistemas de información.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.27 (Principios de arquitectura e ingeniería de sistema seguro)?', 'Aplicar principios de diseño seguro en la arquitectura de sistemas.', 'Documentación de diseño y auditorías de arquitectura.'),
(87, '8.28', 'TECNOLOGICO', 'Codificación segura', 'Los principios de codificación segura deben aplicarse al desarrollo de software.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.28 (Codificación segura)?', 'Capacitar a los desarrolladores en prácticas de codificación segura.', 'Registros de capacitación y auditorías de código.'),
(88, '8.29', 'TECNOLOGICO', 'Pruebas de seguridad en desarrollo y aceptación', 'Los procesos de prueba de seguridad deben definirse e implementarse en el ciclo de vida del desarrollo.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.29 (Pruebas de seguridad en desarrollo y aceptación)?', 'Realizar pruebas de seguridad en aplicaciones antes de su implementación.', 'Informes de pruebas y registros de aceptación.'),
(89, '8.30', 'TECNOLOGICO', 'Desarrollo subcontratado', 'La organización debe dirigir, monitorear y revisar las actividades relacionadas con el desarrollo de sistemas subcontratados.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.30 (Desarrollo subcontratado)?', 'Asegurar que los subcontratistas cumplan con los requisitos de seguridad.', 'Contratos y auditorías de cumplimiento.'),
(90, '8.31', 'TECNOLOGICO', 'Separación de entornos de desarrollo, prueba y producción', 'Los entornos de desarrollo, prueba y producción deben estar separados y protegidos.', '¿Los entornos están separados y protegidos? (puede resultar no aplicable)', 'Mantener entornos separados para desarrollo. prueba y producción.', 'Documentación de entornos y auditorías de configuración.'),
(91, '8.32', 'TECNOLOGICO', 'Gestión del cambio', 'Los cambios en las instalaciones de procesamiento de información y los sistemas de información deben estar sujetos a procedimientos de gestión de cambios.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.32 (Gestión del cambio)?', 'Implementar un proceso formal para la gestión de cambios en sistemas.', 'Registros de cambios y auditorías de gestión.'),
(92, '8.33', 'TECNOLOGICO', 'Información de prueba', 'La información de las pruebas debe seleccionarse, protegerse y gestionarse adecuadamente.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.33 (Información de prueba)?', 'Asegurar que la información utilizada en pruebas no contenga datos sensibles.', 'Documentación de pruebas y auditorías de datos.'),
(93, '8.34', 'TECNOLOGICO', 'Protección de sistemas de información durante las pruebas de auditoría', 'Las pruebas de auditoría y otras actividades de aseguramiento que involucren la evaluación de los sistemas operativos deben planificarse y acordarse entre el evaluador y la gerencia correspondiente.', '¿La organización ha implementado y mantiene evidencias verificables para el control 8.34 (Protección de sistemas de información durante las pruebas de auditoría)?', 'Implementar controles para proteger sistemas durante auditorías.', 'Informes de auditoría y registros de seguridad.');
SELECT setval('control_id_control_seq', 93);

-- 3. AUDITORIA DEMO: EMPRESA ABC (13 Controles Evaluados)
INSERT INTO auditoria (id_auditoria, organizacion, objetivo, alcance, fecha_inicio, fecha_fin, referentes, estado, id_auditor) VALUES
(1, 'Empresa ABC (Prestadora de Servicios Tecnológicos)',
 'Evaluar el estado de implementación de 13 controles seleccionados de ISO/IEC 27002:2022 en los servicios de TI de la organización.',
 'Servidores, estaciones de trabajo, aplicaciones empresariales, bases de datos de clientes, red corporativa y usuarios internos y externos.',
 '2026-11-09', '2026-11-23', 'ISO 19011:2018; ISO/IEC 27001:2022; ISO/IEC 27002:2022', 'EN_REVISION', 1);
SELECT setval('auditoria_id_auditoria_seq', 1);

-- 4. EVALUACIONES DE LOS 13 CONTROLES SELECCIONADOS DE EMPRESA ABC
INSERT INTO evaluacion_control (id_evaluacion, id_auditoria, id_control, estado, observacion, justificacion_na) VALUES
(1,  1, 1,  'IMPLEMENTADO',    'Política vigente, aprobada por la gerencia y revisada en 2026.', NULL),
(2,  1, 15, 'IMPLEMENTADO',    'Matriz de roles y permisos aprobada; accesos por perfil.', NULL),
(3,  1, 18, 'PARCIAL',         'Altas y bajas gestionadas; la revisión de accesos no es periódica.', NULL),
(4,  1, 24, 'NO_IMPLEMENTADO', 'No hay procedimiento ni roles definidos para incidentes.', NULL),
(5,  1, 40,  'PARCIAL',         'Inducción inicial sin refuerzo anual ni evaluación.', NULL),
(6,  1, 47,  'IMPLEMENTADO',    'Acceso al cuarto de servidores con tarjeta y bitácora.', NULL),
(7,  1, 64,  'PARCIAL',         'Autenticación multifactor solo en cuentas administrativas.', NULL),
(8,  1, 66,  'IMPLEMENTADO',    'Antimalware centralizado y actualizado en toda la muestra.', NULL),
(9,  1, 67,  'NO_IMPLEMENTADO', 'No se realizan escaneos periódicos de vulnerabilidades.', NULL),
(10, 1, 72, 'PARCIAL',         'Respaldos diarios; sin pruebas de restauración documentadas.', NULL),
(11, 1, 74, 'NO_IMPLEMENTADO', 'Registros locales sin centralización ni revisión.', NULL),
(12, 1, 82, 'PARCIAL',         'Filtrado web solo en la sede principal.', NULL),
(13, 1, 90, 'NO_APLICABLE',    'Control fuera del alcance operativo de desarrollo interno.', 'Justificación: la empresa adquiere soluciones como servicio (SaaS) y no desarrolla software propio.');
SELECT setval('evaluacion_control_id_evaluacion_seq', 13);

-- 5. EVIDENCIAS SIMULADAS (EV-01 a EV-12)
INSERT INTO evidencia (id_evidencia, id_evaluacion, codigo_evidencia, descripcion, fuente, fecha_evidencia, referencia_url, es_simulada) VALUES
(1,  1,  'EV-01', 'Política de seguridad v2.0 (documental)',              'Repositorio Documental SGSI',     '2026-11-10', 'SGI-POL-001_v2.pdf', TRUE),
(2,  2,  'EV-02', 'Matriz de roles y permisos (documental)',              'Dirección de TI',                 '2026-11-10', 'TI-MAT-002_Roles.xlsx', TRUE),
(3,  3,  'EV-03', 'Entrevista al líder de TI sobre gestión de accesos',   'Entrevista directa / Acta',       '2026-11-11', 'ACTA-ENT-001.pdf', TRUE),
(4,  4,  'EV-04', 'Acta de entrevista (ausencia de procedimiento)',       'Líder de Operaciones TI',         '2026-11-11', 'ACTA-ENT-002.pdf', TRUE),
(5,  5,  'EV-05', 'Lista de asistencia a inducción de personal',          'Gestión del Talento Humano',      '2026-11-12', 'TTHH-IND-2026.pdf', TRUE),
(6,  6,  'EV-06', 'Registro fotográfico y bitácora de acceso físico',     'Seguridad Física / Data Center',  '2026-11-12', 'FOT-DC-006.jpg', TRUE),
(7,  7,  'EV-07', 'Captura de configuración de MFA en consola',           'Administrador de Directorio',     '2026-11-13', 'IMG-MFA-007.png', TRUE),
(8,  8,  'EV-08', 'Consola centralizada de antimalware corporativo',      'Consola EDR / Antimalware',       '2026-11-13', 'REP-EDR-008.pdf', TRUE),
(9,  9,  'EV-09', 'Acta de entrevista (sin reportes de vulnerabilidad)',  'Administrador de Infraestructura','2026-11-14', 'ACTA-ENT-003.pdf', TRUE),
(10, 10, 'EV-10', 'Bitácora automatizada de respaldos diarios',           'Servidor de Backups',             '2026-11-14', 'LOG-BKP-010.txt', TRUE),
(11, 11, 'EV-11', 'Captura de configuración de registros locales',        'Servidores de Producción',        '2026-11-15', 'IMG-LOGS-011.png', TRUE),
(12, 12, 'EV-12', 'Configuración del proxy y reglas de filtrado web',     'Firewall / Proxy Sede Principal', '2026-11-15', 'CFG-PROXY-012.conf', TRUE);
SELECT setval('evidencia_id_evidencia_seq', 12);

-- 6. HALLAZGOS (H-01 a H-04)
INSERT INTO hallazgo (id_hallazgo, codigo, id_evaluacion, condicion, criterio, causa, efecto_riesgo, severidad) VALUES
(1, 'H-01', 9,  'No se evidencian escaneos ni reportes periódicos de vulnerabilidades en los servidores expuestos.',
 'ISO/IEC 27002:2022, control 8.8: obtener información sobre vulnerabilidades técnicas, evaluar la exposición y tomar medidas apropiadas.',
 'No hay responsable asignado ni procedimiento formal de gestión de parches y vulnerabilidades.',
 'Mayor probabilidad de explotación de vulnerabilidades conocidas, con impacto en la disponibilidad y confidencialidad de los datos de clientes.',
 'ALTA'),
(2, 'H-02', 4,  'No existe procedimiento documentado ni roles definidos para gestionar incidentes de seguridad; los eventos se atienden de manera informal.',
 'ISO/IEC 27002:2022, control 5.24: definir procesos, roles y responsabilidades para la planificación y preparación de la gestión de incidentes.',
 'Falta de definición de responsabilidades y de un canal único de reporte de incidentes.',
 'Respuesta tardía o inconsistente, pérdida de evidencia forense y posible incumplimiento de obligaciones de notificación.',
 'ALTA'),
(3, 'H-03', 10, 'Se ejecutan respaldos diarios, pero no hay pruebas de restauración registradas ni documentadas.',
 'ISO/IEC 27002:2022, control 8.13: mantener y probar periódicamente las copias de seguridad de la información.',
 'No existe procedimiento ni responsable asignado para la ejecución de pruebas periódicas de restauración.',
 'Imposibilidad o demora crítica para recuperar información de clientes ante una falla grave o ataque de ransomware.',
 'MEDIA'),
(4, 'H-04', 11, 'Los registros de eventos se almacenan localmente en cada servidor, sin centralización ni revisión periódica.',
 'ISO/IEC 27002:2022, control 8.15: producir, proteger y analizar los registros de actividad (logs).',
 'No se ha implementado una solución centralizada de gestión de registros ni rutinas de revisión.',
 'Dificultad para detectar y reconstruir incidentes de seguridad, y posibilidad de alteración local de los registros.',
 'MEDIA');
SELECT setval('hallazgo_id_hallazgo_seq', 4);

-- 7. RECOMENDACIONES (R-01 a R-04)
INSERT INTO recomendacion (id_recomendacion, id_hallazgo, descripcion, prioridad, plazo_dias, responsable_sug) VALUES
(1, 1, 'Designar responsable, definir el procedimiento de gestión de vulnerabilidades y ejecutar escaneos mensuales con plazos de remediación según criticidad.', 'ALTA', 60, 'Líder de Infraestructura y Seguridad'),
(2, 2, 'Formalizar el procedimiento de gestión de incidentes, designar el equipo de respuesta, habilitar un canal único de reporte y realizar un simulacro semestral.', 'ALTA', 60, 'Oficial de Seguridad de la Información'),
(3, 3, 'Definir el procedimiento formal de respaldo y ejecutar pruebas de restauración trimestrales debidamente documentadas.', 'MEDIA', 90, 'Administrador de Servidores y BD'),
(4, 4, 'Centralizar los registros críticos en un servidor dedicado (Syslog/SIEM), proteger su integridad y definir una revisión periódica.', 'MEDIA', 120, 'Líder de Operaciones TI');
SELECT setval('recomendacion_id_recomendacion_seq', 4);

-- 8. INFORME INICIAL CONSOLIDADO (Versión 1)
INSERT INTO informe (id_informe, id_auditoria, version, total_evaluados, total_aplicables, implementados, parciales, no_implementados, no_aplicables, cumplimiento_base, indice_ponderado, resumen_ejecutivo) VALUES
(1, 1, 1, 13, 12, 4, 5, 3, 1, 33.3, 54.2,
 'De los 12 controles aplicables evaluados, 4 (33,3 %) están implementados, 5 parcialmente (41,7 %) y 3 no implementados (25,0 %), con un índice ponderado de avance del 54,2 %. Se documentaron cuatro hallazgos, dos de severidad alta, relacionados con la gestión de vulnerabilidades y de incidentes. El indicador es descriptivo y no constituye certificación.');
SELECT setval('informe_id_informe_seq', 1);
