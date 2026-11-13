import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import { LIMITACIONES, ORDEN_CODIGO_ISO } from '../../common/domain.js';
import type { Queryable } from '../../database/database.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { AuditLockService } from '../core/audit-lock.service.js';
import { IndicadoresService } from '../core/indicadores.service.js';

/** Consulta oficial de trazabilidad de extremo a extremo (RNF05, BACKEND_SPEC §4.2). */
const SQL_TRAZABILIDAD = `
SELECT a.id_auditoria, a.organizacion,
       c.id_control, c.codigo_iso, c.categoria, c.nombre AS control_nombre,
       e.id_evaluacion, e.estado, e.observacion, e.justificacion_na,
       ev.id_evidencia, ev.codigo_evidencia, ev.descripcion AS evidencia_descripcion,
       ev.fuente AS evidencia_fuente, ev.es_simulada,
       h.id_hallazgo, h.codigo AS hallazgo_codigo, h.severidad AS hallazgo_severidad,
       h.condicion AS hallazgo_condicion,
       r.id_recomendacion, r.descripcion AS recomendacion_descripcion,
       r.prioridad AS recomendacion_prioridad, r.plazo_dias AS recomendacion_plazo_dias,
       r.responsable_sug AS recomendacion_responsable
FROM evaluacion_control e
JOIN auditoria a          ON a.id_auditoria = e.id_auditoria
JOIN control c            ON c.id_control = e.id_control
LEFT JOIN evidencia ev    ON ev.id_evaluacion = e.id_evaluacion
LEFT JOIN hallazgo h      ON h.id_evaluacion = e.id_evaluacion
LEFT JOIN recomendacion r ON r.id_hallazgo = h.id_hallazgo
WHERE e.id_auditoria = $1
ORDER BY ${ORDEN_CODIGO_ISO}, ev.id_evidencia, h.id_hallazgo, r.id_recomendacion`;

const SQL_DATOS = `
SELECT a.id_auditoria, a.organizacion, a.objetivo, a.alcance, a.fecha_inicio, a.fecha_fin,
       a.referentes, a.estado, a.id_auditor, a.creado_en,
       u.nombre AS auditor_nombre, u.correo AS auditor_correo
FROM auditoria a JOIN usuario u ON u.id_usuario = a.id_auditor
WHERE a.id_auditoria = $1`;

const SQL_EVALUACION_POR_CONTROL = `
SELECT e.id_evaluacion, e.id_control, c.codigo_iso, c.categoria, c.nombre, c.criterio,
       e.estado, e.observacion, e.justificacion_na
FROM evaluacion_control e JOIN control c ON c.id_control = e.id_control
WHERE e.id_auditoria = $1
ORDER BY ${ORDEN_CODIGO_ISO}`;

const SQL_HALLAZGOS = `
SELECT h.id_hallazgo, h.codigo, h.id_evaluacion, h.severidad, h.condicion, h.criterio, h.causa,
       h.efecto_riesgo, c.codigo_iso, c.nombre AS control_nombre
FROM hallazgo h
JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
JOIN control c ON c.id_control = e.id_control
WHERE e.id_auditoria = $1
ORDER BY SPLIT_PART(h.codigo, '-', 2)::INT`;

const SQL_RECOMENDACIONES = `
SELECT r.id_recomendacion, r.id_hallazgo, r.descripcion, r.prioridad, r.plazo_dias, r.responsable_sug,
       h.codigo AS hallazgo_codigo, h.severidad AS hallazgo_severidad,
       c.codigo_iso, c.nombre AS control_nombre
FROM recomendacion r
JOIN hallazgo h ON h.id_hallazgo = r.id_hallazgo
JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
JOIN control c ON c.id_control = e.id_control
WHERE e.id_auditoria = $1
ORDER BY SPLIT_PART(h.codigo, '-', 2)::INT, r.id_recomendacion`;

const SQL_EVIDENCIAS = `
SELECT ev.id_evidencia, ev.id_evaluacion, ev.codigo_evidencia, ev.descripcion, ev.fuente,
       ev.fecha_evidencia, ev.referencia_url, ev.es_simulada,
       c.codigo_iso, c.nombre AS control_nombre
FROM evidencia ev
JOIN evaluacion_control e ON e.id_evaluacion = ev.id_evaluacion
JOIN control c ON c.id_control = e.id_control
WHERE e.id_auditoria = $1
ORDER BY ev.id_evidencia`;

/** Historial de versiones sin el snapshot (respuesta liviana, PLAN O11). */
const SQL_VERSIONES = `
SELECT id_informe, id_auditoria, version, fecha_generacion, total_evaluados, total_aplicables,
       implementados, parciales, no_implementados, no_aplicables, cumplimiento_base, indice_ponderado,
       resumen_ejecutivo, limitaciones, (snapshot_json IS NOT NULL) AS tiene_snapshot
FROM informe WHERE id_auditoria = $1
ORDER BY version DESC`;

export interface Version {
  id_informe: number;
  version: number;
  fecha_generacion: string;
}

@Injectable()
export class InformesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditLockService) private readonly lock: AuditLockService,
    @Inject(IndicadoresService) private readonly indicadores: IndicadoresService,
  ) {}

  async indicadoresDe(idAuditoria: number) {
    await this.lock.resolve('auditoria', idAuditoria);
    return this.indicadores.calcular(idAuditoria);
  }

  async trazabilidad(idAuditoria: number) {
    await this.lock.resolve('auditoria', idAuditoria);
    return this.db.query(SQL_TRAZABILIDAD, [idAuditoria]);
  }

  /** Las 8 secciones del informe (RF08) construidas en vivo desde la BD. */
  private async construir(idAuditoria: number, client?: Queryable) {
    const datos = await this.db.one(SQL_DATOS, [idAuditoria], client);
    if (!datos) throw AppError.notFound('Auditoría no encontrada.');
    const indicadores = await this.indicadores.calcular(idAuditoria, client);
    const evaluacion = await this.db.query(SQL_EVALUACION_POR_CONTROL, [idAuditoria], client);
    const hallazgos = await this.db.query<{ id_hallazgo: number }>(SQL_HALLAZGOS, [idAuditoria], client);
    const recomendaciones = await this.db.query<{ id_hallazgo: number }>(SQL_RECOMENDACIONES, [idAuditoria], client);
    const evidencias = await this.db.query(SQL_EVIDENCIAS, [idAuditoria], client);
    const versiones = await this.db.query<Version>(SQL_VERSIONES, [idAuditoria], client);

    return {
      version_actual: versiones[0]?.version ?? 1,
      fecha_generacion: versiones[0]?.fecha_generacion ?? new Date().toISOString(),
      // 1. Datos generales
      datos_auditoria: datos,
      // 2. Alcance y criterios
      alcance_criterios: (evaluacion as Array<Record<string, unknown>>).map((e) => ({
        id_control: e.id_control,
        codigo_iso: e.codigo_iso,
        categoria: e.categoria,
        nombre: e.nombre,
        criterio: e.criterio,
      })),
      // 3. Resultados e indicadores (RF07 / CP-09)
      resultados_indicadores: indicadores,
      // 4. Evaluación por control
      evaluacion_por_control: evaluacion,
      // 5. Hallazgos (con sus recomendaciones para la vista por ficha)
      hallazgos: hallazgos.map((h) => ({
        ...h,
        recomendaciones: recomendaciones.filter((r) => r.id_hallazgo === h.id_hallazgo),
      })),
      // 6. Plan de recomendaciones
      recomendaciones,
      // 7. Anexo de evidencias (es_simulada marca las evidencias académicas, CP-10)
      anexo_evidencias: evidencias,
      // 8. Limitaciones (obligatorio según la rúbrica)
      limitaciones: LIMITACIONES,
      versiones,
    };
  }

  informe(idAuditoria: number) {
    return this.construir(idAuditoria);
  }

  /**
   * Congela una nueva versión (MAX + 1) con el snapshot completo (CP-10). Se permite también
   * en auditorías CERRADAS: el informe es una instantánea, no modifica los registros auditados.
   */
  async generar(idAuditoria: number) {
    return this.db.withTransaction(async (client) => {
      await this.lock.resolve('auditoria', idAuditoria, client); // FOR UPDATE: versiones sin colisión
      const estructura = await this.construir(idAuditoria, client);
      const ind = estructura.resultados_indicadores;
      const siguiente = (estructura.versiones[0]?.version ?? 0) + 1;
      const fecha = new Date().toISOString();
      const snapshot = { ...estructura, version_actual: siguiente, fecha_generacion: fecha, versiones: undefined };

      const nueva = await this.db.one<Version>(
        `INSERT INTO informe (id_auditoria, version, fecha_generacion, total_evaluados, total_aplicables,
           implementados, parciales, no_implementados, no_aplicables, cumplimiento_base, indice_ponderado,
           resumen_ejecutivo, limitaciones, snapshot_json)
         VALUES ($1, $2, $3::TIMESTAMPTZ AT TIME ZONE 'UTC', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING id_informe, id_auditoria, version, fecha_generacion, total_evaluados, total_aplicables,
           implementados, parciales, no_implementados, no_aplicables, cumplimiento_base, indice_ponderado,
           resumen_ejecutivo, limitaciones, TRUE AS tiene_snapshot`,
        [
          idAuditoria,
          siguiente,
          fecha,
          ind.total_evaluados,
          ind.aplicables,
          ind.implementados,
          ind.parciales,
          ind.no_implementados,
          ind.no_aplicables,
          ind.cumplimiento_base_pct,
          ind.indice_ponderado_pct,
          ind.resumen_ejecutivo,
          LIMITACIONES,
          JSON.stringify(snapshot),
        ],
        client,
      );
      return {
        ...estructura,
        version_actual: siguiente,
        fecha_generacion: fecha,
        versiones: [nueva, ...estructura.versiones],
      };
    });
  }

  /** Versión congelada con su snapshot (para reabrir un informe histórico tal como se generó). */
  async version(idInforme: number) {
    const informe = await this.db.one(
      `SELECT id_informe, id_auditoria, version, fecha_generacion, total_evaluados, total_aplicables,
              implementados, parciales, no_implementados, no_aplicables, cumplimiento_base, indice_ponderado,
              resumen_ejecutivo, limitaciones, snapshot_json
         FROM informe WHERE id_informe = $1`,
      [idInforme],
    );
    if (!informe) throw AppError.notFound('Versión de informe no encontrada.');
    return informe;
  }
}
