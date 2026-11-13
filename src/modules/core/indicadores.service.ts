import { Inject, Injectable } from '@nestjs/common';
import type { Queryable } from '../../database/database.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { formatPercent } from '../../common/domain.js';

export interface Indicadores {
  total_seleccionados: number;
  total_evaluados: number;
  pendientes: number;
  aplicables: number;
  implementados: number;
  parciales: number;
  no_implementados: number;
  no_aplicables: number;
  cumplimiento_base_pct: number;
  indice_ponderado_pct: number;
  total_hallazgos: number;
  total_recomendaciones: number;
  total_evidencias: number;
  hallazgos_por_severidad: { ALTA: number; MEDIA: number; BAJA: number };
  formula_base: string;
  formula_ponderada: string;
  resumen_ejecutivo: string;
}

/**
 * Consulta oficial de indicadores (RF07 / CP-09, BACKEND_SPEC §4.1), ampliada con los
 * conteos de hallazgos, recomendaciones y evidencias en una sola ida a la BD (PLAN O7).
 * Los NO_APLICABLE se excluyen del denominador y NULLIF evita la división por cero.
 */
const SQL_INDICADORES = `
WITH e AS (
  SELECT id_evaluacion, estado FROM evaluacion_control WHERE id_auditoria = $1
), h AS (
  SELECT h.id_hallazgo, h.severidad FROM hallazgo h JOIN e ON e.id_evaluacion = h.id_evaluacion
), conteo AS (
  SELECT
    COUNT(*)::INT                                                            AS total_seleccionados,
    COUNT(*) FILTER (WHERE estado <> 'PENDIENTE')::INT                       AS total_evaluados,
    COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::INT                        AS pendientes,
    COUNT(*) FILTER (WHERE estado = 'IMPLEMENTADO')::INT                     AS implementados,
    COUNT(*) FILTER (WHERE estado = 'PARCIAL')::INT                          AS parciales,
    COUNT(*) FILTER (WHERE estado = 'NO_IMPLEMENTADO')::INT                  AS no_implementados,
    COUNT(*) FILTER (WHERE estado = 'NO_APLICABLE')::INT                     AS no_aplicables,
    COUNT(*) FILTER (WHERE estado IN ('IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO'))::INT AS aplicables
  FROM e
)
SELECT conteo.*,
  COALESCE(ROUND(100.0 * implementados / NULLIF(aplicables, 0), 1), 0.0)::FLOAT AS cumplimiento_base_pct,
  COALESCE(ROUND(100.0 * (implementados * 1.0 + parciales * 0.5) / NULLIF(aplicables, 0), 1), 0.0)::FLOAT
                                                                             AS indice_ponderado_pct,
  (SELECT COUNT(*) FROM h)::INT                                              AS total_hallazgos,
  (SELECT COUNT(*) FROM h WHERE severidad = 'ALTA')::INT                     AS altas,
  (SELECT COUNT(*) FROM h WHERE severidad = 'MEDIA')::INT                    AS medias,
  (SELECT COUNT(*) FROM h WHERE severidad = 'BAJA')::INT                     AS bajas,
  (SELECT COUNT(*) FROM recomendacion r JOIN h ON h.id_hallazgo = r.id_hallazgo)::INT AS total_recomendaciones,
  (SELECT COUNT(*) FROM evidencia ev JOIN e ON e.id_evaluacion = ev.id_evaluacion)::INT AS total_evidencias
FROM conteo`;

type Fila = Omit<Indicadores, 'hallazgos_por_severidad' | 'formula_base' | 'formula_ponderada' | 'resumen_ejecutivo'> & {
  altas: number;
  medias: number;
  bajas: number;
};

@Injectable()
export class IndicadoresService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async calcular(idAuditoria: number, client?: Queryable): Promise<Indicadores> {
    const f = (await this.db.one<Fila>(SQL_INDICADORES, [idAuditoria], client)) as Fila;
    const { altas, medias, bajas, ...base } = f;

    const formula_base =
      `(${f.implementados} / ${f.aplicables}) × 100 = ${formatPercent(f.cumplimiento_base_pct)}`;
    const formula_ponderada =
      `((${f.implementados} × 1.0 + ${f.parciales} × 0.5) / ${f.aplicables}) × 100 = ` +
      formatPercent(f.indice_ponderado_pct);

    const excluidos =
      f.no_aplicables > 0
        ? ` (${f.no_aplicables} control(es) no aplicable(s) excluido(s) del denominador)`
        : '';
    const resumen_ejecutivo =
      `De los ${f.aplicables} controles aplicables evaluados${excluidos}, ${f.implementados} ` +
      `(${formatPercent(f.cumplimiento_base_pct)}) están implementados, ${f.parciales} parcialmente y ` +
      `${f.no_implementados} no implementados, con un índice ponderado de avance de ` +
      `${formatPercent(f.indice_ponderado_pct)}. Se documentaron ${f.total_hallazgos} hallazgo(s), ` +
      `${altas} de severidad alta. El indicador es descriptivo y no constituye certificación.`;

    return {
      ...base,
      hallazgos_por_severidad: { ALTA: altas, MEDIA: medias, BAJA: bajas },
      formula_base,
      formula_ponderada,
      resumen_ejecutivo,
    };
  }
}
