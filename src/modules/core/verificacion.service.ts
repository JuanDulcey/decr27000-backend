import { Inject, Injectable } from '@nestjs/common';
import { MAX_CONTROLES, MIN_CONTROLES, MIN_HALLAZGOS_CIERRE, ORDEN_CODIGO_ISO } from '../../common/domain.js';
import type { Queryable } from '../../database/database.service.js';
import { DatabaseService } from '../../database/database.service.js';

export interface VerificacionCierre {
  total_seleccionados: number;
  pendientes: string[];
  sin_evidencia: string[];
  total_hallazgos: number;
  hallazgos_sin_recomendacion: string[];
  puede_revisar: boolean;
  puede_cerrar: boolean;
}

/** Controles pendientes y controles IMPLEMENTADO/PARCIAL sin evidencia (RN04 / CP-06). */
const SQL_CONTROLES = `
SELECT
  COUNT(*)::INT AS total_seleccionados,
  COALESCE(ARRAY_AGG(c.codigo_iso ORDER BY ${ORDEN_CODIGO_ISO})
    FILTER (WHERE e.estado = 'PENDIENTE'), '{}') AS pendientes,
  COALESCE(ARRAY_AGG(c.codigo_iso ORDER BY ${ORDEN_CODIGO_ISO})
    FILTER (WHERE e.estado IN ('IMPLEMENTADO', 'PARCIAL')
            AND NOT EXISTS (SELECT 1 FROM evidencia ev WHERE ev.id_evaluacion = e.id_evaluacion)),
    '{}') AS sin_evidencia
FROM evaluacion_control e
JOIN control c ON c.id_control = e.id_control
WHERE e.id_auditoria = $1`;

/** Hallazgos y hallazgos sin recomendación (RN06 / CP-08). */
const SQL_HALLAZGOS = `
SELECT
  COUNT(*)::INT AS total_hallazgos,
  COALESCE(ARRAY_AGG(h.codigo ORDER BY h.codigo)
    FILTER (WHERE NOT EXISTS (SELECT 1 FROM recomendacion r WHERE r.id_hallazgo = h.id_hallazgo)),
    '{}') AS hallazgos_sin_recomendacion
FROM hallazgo h
JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
WHERE e.id_auditoria = $1`;

/** Reglas para pasar a EN_REVISION y para CERRAR una auditoría (RN02, RN04, RN06). */
@Injectable()
export class VerificacionService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async calcular(idAuditoria: number, client?: Queryable): Promise<VerificacionCierre> {
    // En secuencia: dentro de una transacción ambas consultas comparten el mismo cliente.
    const controles = await this.db.one<
      Pick<VerificacionCierre, 'total_seleccionados' | 'pendientes' | 'sin_evidencia'>
    >(SQL_CONTROLES, [idAuditoria], client);
    const hallazgos = await this.db.one<
      Pick<VerificacionCierre, 'total_hallazgos' | 'hallazgos_sin_recomendacion'>
    >(SQL_HALLAZGOS, [idAuditoria], client);
    const c = controles ?? { total_seleccionados: 0, pendientes: [], sin_evidencia: [] };
    const h = hallazgos ?? { total_hallazgos: 0, hallazgos_sin_recomendacion: [] };

    const puede_revisar =
      c.total_seleccionados >= MIN_CONTROLES &&
      c.total_seleccionados <= MAX_CONTROLES &&
      c.pendientes.length === 0 &&
      c.sin_evidencia.length === 0;
    const puede_cerrar =
      puede_revisar &&
      h.total_hallazgos >= MIN_HALLAZGOS_CIERRE &&
      h.hallazgos_sin_recomendacion.length === 0;

    return { ...c, ...h, puede_revisar, puede_cerrar };
  }
}
