import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import { ORDEN_CODIGO_ISO } from '../../common/domain.js';
import { DatabaseService } from '../../database/database.service.js';
import { AuditLockService } from '../core/audit-lock.service.js';
import type { EvaluacionDto } from './evaluaciones.dto.js';

/**
 * Controles seleccionados con datos del catálogo, evidencias, hallazgos y recomendaciones
 * anidados, en UNA sola consulta (sin N+1, PLAN O7).
 */
const SQL_EVALUACIONES = `
SELECT e.id_evaluacion, e.id_auditoria, e.id_control, e.estado, e.observacion, e.justificacion_na,
       e.actualizado_en,
       c.codigo_iso, c.categoria, c.nombre, c.criterio, c.pregunta_orientadora,
       c.ejemplo_aplicacion, c.evidencia_sugerida,
       (e.estado IN ('IMPLEMENTADO', 'PARCIAL')
         AND NOT EXISTS (SELECT 1 FROM evidencia ev WHERE ev.id_evaluacion = e.id_evaluacion))
         AS requiere_evidencia_faltante,
       COALESCE((
         SELECT JSON_AGG(JSON_BUILD_OBJECT(
                  'id_evidencia', ev.id_evidencia, 'id_evaluacion', ev.id_evaluacion,
                  'codigo_evidencia', ev.codigo_evidencia, 'descripcion', ev.descripcion,
                  'fuente', ev.fuente, 'fecha_evidencia', ev.fecha_evidencia,
                  'referencia_url', ev.referencia_url, 'es_simulada', ev.es_simulada)
                ORDER BY ev.id_evidencia)
         FROM evidencia ev WHERE ev.id_evaluacion = e.id_evaluacion), '[]') AS evidencias,
       COALESCE((
         SELECT JSON_AGG(JSON_BUILD_OBJECT(
                  'id_hallazgo', h.id_hallazgo, 'codigo', h.codigo, 'id_evaluacion', h.id_evaluacion,
                  'condicion', h.condicion, 'criterio', h.criterio, 'causa', h.causa,
                  'efecto_riesgo', h.efecto_riesgo, 'severidad', h.severidad,
                  'recomendaciones', COALESCE((
                    SELECT JSON_AGG(JSON_BUILD_OBJECT(
                             'id_recomendacion', r.id_recomendacion, 'id_hallazgo', r.id_hallazgo,
                             'descripcion', r.descripcion, 'prioridad', r.prioridad,
                             'plazo_dias', r.plazo_dias, 'responsable_sug', r.responsable_sug)
                           ORDER BY r.id_recomendacion)
                    FROM recomendacion r WHERE r.id_hallazgo = h.id_hallazgo), '[]'))
                ORDER BY SPLIT_PART(h.codigo, '-', 2)::INT)
         FROM hallazgo h WHERE h.id_evaluacion = e.id_evaluacion), '[]') AS hallazgos
FROM evaluacion_control e
JOIN control c ON c.id_control = e.id_control
WHERE e.id_auditoria = $1
ORDER BY ${ORDEN_CODIGO_ISO}`;

@Injectable()
export class EvaluacionesService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditLockService) private readonly lock: AuditLockService,
  ) {}

  async findByAuditoria(idAuditoria: number) {
    await this.lock.resolve('auditoria', idAuditoria);
    return this.db.query(SQL_EVALUACIONES, [idAuditoria]);
  }

  /** RN03 / CP-04 y CP-05: observación siempre; justificación solo y siempre para NO_APLICABLE. */
  async update(idEvaluacion: number, dto: EvaluacionDto) {
    if (dto.estado === 'NO_APLICABLE' && !dto.justificacion_na) {
      throw AppError.badRequest(
        "El estado 'No aplicable' exige registrar una justificación formal.",
        'justificacion_na',
      );
    }
    return this.db.withTransaction(async (client) => {
      await this.lock.assertMutable('evaluacion', idEvaluacion, client);
      return this.db.one(
        `UPDATE evaluacion_control
            SET estado = $2, observacion = $3, justificacion_na = $4, actualizado_en = CURRENT_TIMESTAMP
          WHERE id_evaluacion = $1
          RETURNING id_evaluacion, id_auditoria, id_control, estado, observacion, justificacion_na, actualizado_en,
                    (estado IN ('IMPLEMENTADO', 'PARCIAL')
                      AND NOT EXISTS (SELECT 1 FROM evidencia ev WHERE ev.id_evaluacion = $1))
                      AS requiere_evidencia_faltante`,
        [
          idEvaluacion,
          dto.estado,
          dto.observacion,
          dto.estado === 'NO_APLICABLE' ? dto.justificacion_na : null,
        ],
        client,
      );
    });
  }
}
