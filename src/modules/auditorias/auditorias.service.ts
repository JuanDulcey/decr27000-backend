import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import {
  EstadoAuditoria,
  MAX_CONTROLES,
  MIN_CONTROLES,
  MIN_HALLAZGOS_CIERRE,
  ORDEN_CODIGO_ISO,
  REFERENTES_OFICIALES,
} from '../../common/domain.js';
import type { Queryable } from '../../database/database.service.js';
import { DatabaseService } from '../../database/database.service.js';
import { AuditLockService } from '../core/audit-lock.service.js';
import { IndicadoresService } from '../core/indicadores.service.js';
import { VerificacionService } from '../core/verificacion.service.js';
import type { AuditoriaDto } from './auditorias.dto.js';

export interface Auditoria {
  id_auditoria: number;
  organizacion: string;
  objetivo: string;
  alcance: string;
  fecha_inicio: string;
  fecha_fin: string;
  referentes: string;
  estado: EstadoAuditoria;
  id_auditor: number;
  creado_en: string;
  auditor_nombre?: string;
}

/** Columnas de la auditoría con el nombre del auditor. */
const SELECT_AUDITORIA = `
SELECT a.id_auditoria, a.organizacion, a.objetivo, a.alcance, a.fecha_inicio, a.fecha_fin,
       a.referentes, a.estado, a.id_auditor, a.creado_en, u.nombre AS auditor_nombre
FROM auditoria a JOIN usuario u ON u.id_usuario = a.id_auditor`;

/**
 * Listado con métricas resumidas por auditoría en una sola consulta (PLAN O7):
 * controles, cumplimiento base, índice ponderado y hallazgos.
 */
export const SQL_LISTADO = `
SELECT a.id_auditoria, a.organizacion, a.objetivo, a.alcance, a.fecha_inicio, a.fecha_fin,
       a.referentes, a.estado, a.id_auditor, a.creado_en, u.nombre AS auditor_nombre,
       m.total_controles, m.cumplimiento_base_pct, m.indice_ponderado_pct,
       hc.total_hallazgos
FROM auditoria a
JOIN usuario u ON u.id_usuario = a.id_auditor
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total_controles,
    COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE e.estado = 'IMPLEMENTADO')
      / NULLIF(COUNT(*) FILTER (WHERE e.estado IN ('IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO')), 0), 1), 0.0)::FLOAT
      AS cumplimiento_base_pct,
    COALESCE(ROUND(100.0 * (COUNT(*) FILTER (WHERE e.estado = 'IMPLEMENTADO')
      + 0.5 * COUNT(*) FILTER (WHERE e.estado = 'PARCIAL'))
      / NULLIF(COUNT(*) FILTER (WHERE e.estado IN ('IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO')), 0), 1), 0.0)::FLOAT
      AS indice_ponderado_pct
  FROM evaluacion_control e WHERE e.id_auditoria = a.id_auditoria
) m ON TRUE
LEFT JOIN LATERAL (
  SELECT COUNT(*)::INT AS total_hallazgos
  FROM hallazgo h JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
  WHERE e.id_auditoria = a.id_auditoria
) hc ON TRUE`;

/** Transiciones permitidas del ciclo de vida (PLAN B1.8). CERRADA es definitivo. */
const TRANSICIONES: Record<EstadoAuditoria, EstadoAuditoria[]> = {
  BORRADOR: ['EN_EJECUCION'],
  EN_EJECUCION: ['EN_REVISION', 'BORRADOR'],
  EN_REVISION: ['EN_EJECUCION', 'CERRADA'],
  CERRADA: [],
};

const ETIQUETA: Record<EstadoAuditoria, string> = {
  BORRADOR: 'BORRADOR',
  EN_EJECUCION: 'EN EJECUCIÓN',
  EN_REVISION: 'EN REVISIÓN',
  CERRADA: 'CERRADA',
};

@Injectable()
export class AuditoriasService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditLockService) private readonly lock: AuditLockService,
    @Inject(IndicadoresService) private readonly indicadores: IndicadoresService,
    @Inject(VerificacionService) private readonly verificacion: VerificacionService,
  ) {}

  findAll(): Promise<Auditoria[]> {
    return this.db.query<Auditoria>(`${SQL_LISTADO} ORDER BY a.id_auditoria`);
  }

  async findBase(id: number, client?: Queryable): Promise<Auditoria> {
    const auditoria = await this.db.one<Auditoria>(`${SELECT_AUDITORIA} WHERE a.id_auditoria = $1`, [id], client);
    if (!auditoria) throw AppError.notFound('Auditoría no encontrada.');
    return auditoria;
  }

  /** Detalle con indicadores (RF07) y verificación de cierre en vivo. */
  async findOne(id: number) {
    const auditoria = await this.findBase(id);
    const [indicadores, verificacion_cierre] = await Promise.all([
      this.indicadores.calcular(id),
      this.verificacion.calcular(id),
    ]);
    return { ...auditoria, indicadores, verificacion_cierre };
  }

  private validarFechas(dto: AuditoriaDto): void {
    if (dto.fecha_fin < dto.fecha_inicio) {
      throw AppError.badRequest(
        'La fecha de cierre debe ser igual o posterior a la fecha de inicio.',
        'fecha_fin',
      );
    }
  }

  private async validarAuditor(idAuditor: number, client?: Queryable): Promise<void> {
    const auditor = await this.db.one('SELECT 1 FROM usuario WHERE id_usuario = $1', [idAuditor], client);
    if (!auditor) throw AppError.badRequest('El auditor seleccionado no existe.', 'id_auditor');
  }

  /** RN01 / CP-01: toda auditoría nueva nace en BORRADOR. */
  async create(dto: AuditoriaDto): Promise<Auditoria> {
    this.validarFechas(dto);
    await this.validarAuditor(dto.id_auditor);
    const row = await this.db.one<{ id_auditoria: number }>(
      `INSERT INTO auditoria (organizacion, objetivo, alcance, fecha_inicio, fecha_fin, referentes, estado, id_auditor)
       VALUES ($1, $2, $3, $4, $5, $6, 'BORRADOR', $7) RETURNING id_auditoria`,
      [
        dto.organizacion,
        dto.objetivo,
        dto.alcance,
        dto.fecha_inicio,
        dto.fecha_fin,
        dto.referentes ?? REFERENTES_OFICIALES,
        dto.id_auditor,
      ],
    );
    return this.findBase((row as { id_auditoria: number }).id_auditoria);
  }

  async update(id: number, dto: AuditoriaDto): Promise<Auditoria> {
    this.validarFechas(dto);
    return this.db.withTransaction(async (client) => {
      await this.lock.assertMutable('auditoria', id, client);
      await this.validarAuditor(dto.id_auditor, client);
      await client.query(
        `UPDATE auditoria SET organizacion = $2, objetivo = $3, alcance = $4, fecha_inicio = $5,
                fecha_fin = $6, referentes = $7, id_auditor = $8
         WHERE id_auditoria = $1`,
        [
          id,
          dto.organizacion,
          dto.objetivo,
          dto.alcance,
          dto.fecha_inicio,
          dto.fecha_fin,
          dto.referentes ?? REFERENTES_OFICIALES,
          dto.id_auditor,
        ],
      );
      return this.findBase(id, client);
    });
  }

  verificacionCierre(id: number) {
    return this.findBase(id).then(() => this.verificacion.calcular(id));
  }

  /** PATCH estado: aplica RN02, RN04 y RN06 según el estado destino (CP-03, CP-06, CP-08). */
  async cambiarEstado(id: number, destino: EstadoAuditoria): Promise<Auditoria> {
    return this.db.withTransaction(async (client) => {
      const { estado: actual } = await this.lock.assertMutable('auditoria', id, client);
      if (actual === destino) {
        throw AppError.badRequest(`La auditoría ya se encuentra en estado ${ETIQUETA[destino]}.`, 'estado');
      }
      if (!TRANSICIONES[actual].includes(destino)) {
        const permitidas = TRANSICIONES[actual].map((e) => ETIQUETA[e]).join(' o ');
        throw AppError.badRequest(
          `Transición no permitida: de ${ETIQUETA[actual]} solo se puede pasar a ${permitidas}.`,
          'estado',
        );
      }

      const v = await this.verificacion.calcular(id, client);
      const rango = v.total_seleccionados >= MIN_CONTROLES && v.total_seleccionados <= MAX_CONTROLES;

      if (destino === 'EN_EJECUCION' && !rango) {
        throw AppError.badRequest(
          `Debe seleccionar entre ${MIN_CONTROLES} y ${MAX_CONTROLES} controles del catálogo ISO/IEC 27002:2022 ` +
            `para pasar a ejecución (actualmente seleccionó ${v.total_seleccionados}).`,
        );
      }
      if (destino === 'EN_REVISION' || destino === 'CERRADA') {
        if (!rango) {
          throw AppError.badRequest(
            `El rango obligatorio es de ${MIN_CONTROLES} a ${MAX_CONTROLES} controles seleccionados ` +
              `(actual: ${v.total_seleccionados}).`,
          );
        }
        if (v.pendientes.length > 0) {
          throw AppError.badRequest(
            `No se puede avanzar a ${ETIQUETA[destino]}: existen controles pendientes de evaluar ` +
              `(${v.pendientes.join(', ')}).`,
            undefined,
            { pendientes: v.pendientes },
          );
        }
        if (v.sin_evidencia.length > 0) {
          throw AppError.badRequest(
            'Regla RN04 / CP-06: los siguientes controles en estado Implementado o Parcial carecen de ' +
              `evidencia registrada: ${v.sin_evidencia.join(', ')}.`,
            undefined,
            { sin_evidencia: v.sin_evidencia },
          );
        }
      }
      if (destino === 'CERRADA') {
        if (v.total_hallazgos < MIN_HALLAZGOS_CIERRE) {
          throw AppError.badRequest(
            `Regla RN06 / CP-08: para cerrar la auditoría se exigen al menos ${MIN_HALLAZGOS_CIERRE} ` +
              `hallazgos documentados (actualmente hay ${v.total_hallazgos}).`,
          );
        }
        if (v.hallazgos_sin_recomendacion.length > 0) {
          throw AppError.badRequest(
            'Regla RN06 / CP-08: todos los hallazgos deben tener al menos una recomendación asociada. ' +
              `Faltan recomendaciones en: ${v.hallazgos_sin_recomendacion.join(', ')}.`,
            undefined,
            { hallazgos_sin_recomendacion: v.hallazgos_sin_recomendacion },
          );
        }
      }

      await client.query('UPDATE auditoria SET estado = $2 WHERE id_auditoria = $1', [id, destino]);
      return this.findBase(id, client);
    });
  }

  /**
   * Selección de 10 a 15 controles (RF02, RN02, CP-03). Sincroniza evaluacion_control:
   * conserva los ya seleccionados, agrega los nuevos en PENDIENTE y retira los quitados.
   * No retira controles con evidencias o hallazgos (protege la trazabilidad).
   */
  async guardarSeleccion(id: number, ids: number[]) {
    const unicos = [...new Set(ids)];
    if (unicos.length < MIN_CONTROLES || unicos.length > MAX_CONTROLES) {
      throw AppError.badRequest(
        `Debe seleccionar entre ${MIN_CONTROLES} y ${MAX_CONTROLES} controles del catálogo ISO/IEC 27002:2022 ` +
          `para la auditoría (actualmente seleccionó ${unicos.length}).`,
        'controles_ids',
      );
    }

    return this.db.withTransaction(async (client) => {
      const { estado } = await this.lock.assertMutable('auditoria', id, client);
      if (estado === 'EN_REVISION') {
        throw AppError.conflict(
          'La auditoría está EN REVISIÓN: devuélvala a EN EJECUCIÓN para modificar la selección de controles.',
        );
      }

      const existentes = await this.db.query<{ id_control: number }>(
        'SELECT id_control FROM control WHERE id_control = ANY($1::INT[])',
        [unicos],
        client,
      );
      if (existentes.length !== unicos.length) {
        const validos = new Set(existentes.map((c) => c.id_control));
        const faltan = unicos.filter((i) => !validos.has(i));
        throw AppError.badRequest(`Controles inexistentes en el catálogo: ${faltan.join(', ')}.`, 'controles_ids');
      }

      const bloqueados = await this.db.query<{ codigo_iso: string }>(
        `SELECT c.codigo_iso FROM evaluacion_control e JOIN control c ON c.id_control = e.id_control
         WHERE e.id_auditoria = $1 AND NOT (e.id_control = ANY($2::INT[]))
           AND (EXISTS (SELECT 1 FROM evidencia ev WHERE ev.id_evaluacion = e.id_evaluacion)
             OR EXISTS (SELECT 1 FROM hallazgo h WHERE h.id_evaluacion = e.id_evaluacion))
         ORDER BY ${ORDEN_CODIGO_ISO}`,
        [id, unicos],
        client,
      );
      if (bloqueados.length > 0) {
        const codigos = bloqueados.map((b) => b.codigo_iso).join(', ');
        throw AppError.conflict(
          `No se puede retirar ${bloqueados.length === 1 ? 'el control' : 'los controles'} ${codigos} ` +
            'porque ya tiene(n) evidencias o hallazgos asociados.',
          'controles_ids',
        );
      }

      const retirados = await client.query(
        'DELETE FROM evaluacion_control WHERE id_auditoria = $1 AND NOT (id_control = ANY($2::INT[]))',
        [id, unicos],
      );
      const agregados = await client.query(
        `INSERT INTO evaluacion_control (id_auditoria, id_control, estado, observacion)
         SELECT $1, x, 'PENDIENTE', '' FROM UNNEST($2::INT[]) AS x
         ON CONFLICT (id_auditoria, id_control) DO NOTHING`,
        [id, unicos],
      );

      let nuevoEstado: EstadoAuditoria = estado;
      if (estado === 'BORRADOR') {
        await client.query("UPDATE auditoria SET estado = 'EN_EJECUCION' WHERE id_auditoria = $1", [id]);
        nuevoEstado = 'EN_EJECUCION';
      }
      return {
        controles_seleccionados: unicos.length,
        agregados: agregados.rowCount ?? 0,
        retirados: retirados.rowCount ?? 0,
        estado: nuevoEstado,
      };
    });
  }
}

