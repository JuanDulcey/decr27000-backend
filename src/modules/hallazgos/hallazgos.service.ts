import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { AppError } from '../../common/app-error.js';
import { nextCode, RESPONSABLE_POR_DEFECTO } from '../../common/domain.js';
import { DatabaseService } from '../../database/database.service.js';
import { AuditLockService } from '../core/audit-lock.service.js';
import type { HallazgoDto, RecomendacionDto, UpdateHallazgoDto, UpdateRecomendacionDto } from './hallazgos.dto.js';

const COLS_HALLAZGO =
  'id_hallazgo, codigo, id_evaluacion, condicion, criterio, causa, efecto_riesgo, severidad, creado_en';
const COLS_RECOMENDACION =
  'id_recomendacion, id_hallazgo, descripcion, prioridad, plazo_dias, responsable_sug, creado_en';

/** Hallazgos de la auditoría con su control y recomendaciones anidadas (una consulta). */
const SQL_HALLAZGOS = `
SELECT h.id_hallazgo, h.codigo, h.id_evaluacion, h.condicion, h.criterio, h.causa, h.efecto_riesgo,
       h.severidad, h.creado_en,
       c.id_control, c.codigo_iso, c.nombre AS control_nombre, e.estado AS estado_control,
       COALESCE((
         SELECT JSON_AGG(JSON_BUILD_OBJECT(
                  'id_recomendacion', r.id_recomendacion, 'id_hallazgo', r.id_hallazgo,
                  'descripcion', r.descripcion, 'prioridad', r.prioridad,
                  'plazo_dias', r.plazo_dias, 'responsable_sug', r.responsable_sug)
                ORDER BY r.id_recomendacion)
         FROM recomendacion r WHERE r.id_hallazgo = h.id_hallazgo), '[]') AS recomendaciones
FROM hallazgo h
JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
JOIN control c ON c.id_control = e.id_control
WHERE e.id_auditoria = $1
ORDER BY SPLIT_PART(h.codigo, '-', 2)::INT`;

@Injectable()
export class HallazgosService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditLockService) private readonly lock: AuditLockService,
  ) {}

  async findByAuditoria(idAuditoria: number) {
    await this.lock.resolve('auditoria', idAuditoria);
    return this.db.query(SQL_HALLAZGOS, [idAuditoria]);
  }

  private insertRecomendacion(client: pg.PoolClient, idHallazgo: number, dto: RecomendacionDto, prioridadDefecto = 'MEDIA') {
    return this.db.one(
      `INSERT INTO recomendacion (id_hallazgo, descripcion, prioridad, plazo_dias, responsable_sug)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${COLS_RECOMENDACION}`,
      [
        idHallazgo,
        dto.descripcion,
        dto.prioridad ?? prioridadDefecto,
        dto.plazo_dias ?? 60,
        dto.responsable_sug ?? RESPONSABLE_POR_DEFECTO,
      ],
      client,
    );
  }

  /**
   * RN05 / CP-07: registra el hallazgo con código H-nn (mayor existente + 1 en la auditoría) y,
   * si viene, su recomendación inicial, en la misma transacción.
   */
  async create(idEvaluacion: number, dto: HallazgoDto) {
    return this.db.withTransaction(async (client) => {
      const { id_auditoria } = await this.lock.assertMutable('evaluacion', idEvaluacion, client);

      const evaluacion = await this.db.one<{ estado: string; codigo_iso: string }>(
        `SELECT e.estado, c.codigo_iso FROM evaluacion_control e JOIN control c ON c.id_control = e.id_control
         WHERE e.id_evaluacion = $1`,
        [idEvaluacion],
        client,
      );
      if (evaluacion?.estado === 'PENDIENTE') {
        throw AppError.badRequest(
          `Evalúe primero el control ${evaluacion.codigo_iso}: no se registran hallazgos sobre controles pendientes.`,
          'id_evaluacion',
        );
      }
      if (evaluacion?.estado === 'NO_APLICABLE') {
        throw AppError.badRequest(
          `El control ${evaluacion.codigo_iso} es No aplicable: no admite hallazgos.`,
          'id_evaluacion',
        );
      }

      const max = await this.db.one<{ max: number }>(
        `SELECT COALESCE(MAX(SPLIT_PART(h.codigo, '-', 2)::INT), 0) AS max
           FROM hallazgo h JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
          WHERE e.id_auditoria = $1`,
        [id_auditoria],
        client,
      );
      const codigo = nextCode('H', max?.max ?? 0);

      const hallazgo = await this.db.one<{ id_hallazgo: number; codigo: string }>(
        `INSERT INTO hallazgo (codigo, id_evaluacion, condicion, criterio, causa, efecto_riesgo, severidad)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLS_HALLAZGO}`,
        [codigo, idEvaluacion, dto.condicion, dto.criterio, dto.causa, dto.efecto_riesgo, dto.severidad],
        client,
      );
      const id = (hallazgo as { id_hallazgo: number }).id_hallazgo;
      const recomendaciones = dto.recomendacion
        ? [await this.insertRecomendacion(client, id, dto.recomendacion, dto.severidad)]
        : [];
      return { ...hallazgo, recomendaciones };
    });
  }

  async update(idHallazgo: number, dto: UpdateHallazgoDto) {
    if (dto.recomendacion) {
      throw AppError.badRequest(
        'Las recomendaciones se gestionan en /api/hallazgos/:id/recomendaciones.',
        'recomendacion',
      );
    }
    return this.db.withTransaction(async (client) => {
      await this.lock.assertMutable('hallazgo', idHallazgo, client);
      return this.db.one(
        `UPDATE hallazgo SET
           condicion     = COALESCE($2, condicion),
           criterio      = COALESCE($3, criterio),
           causa         = COALESCE($4, causa),
           efecto_riesgo = COALESCE($5, efecto_riesgo),
           severidad     = COALESCE($6, severidad)
         WHERE id_hallazgo = $1 RETURNING ${COLS_HALLAZGO}`,
        [
          idHallazgo,
          dto.condicion ?? null,
          dto.criterio ?? null,
          dto.causa ?? null,
          dto.efecto_riesgo ?? null,
          dto.severidad ?? null,
        ],
        client,
      );
    });
  }

  /** Elimina el hallazgo y sus recomendaciones (ON DELETE CASCADE). */
  async remove(idHallazgo: number) {
    return this.db.withTransaction(async (client) => {
      await this.lock.assertMutable('hallazgo', idHallazgo, client);
      return this.db.one<{ codigo: string }>(
        `DELETE FROM hallazgo WHERE id_hallazgo = $1 RETURNING ${COLS_HALLAZGO}`,
        [idHallazgo],
        client,
      );
    });
  }

  async createRecomendacion(idHallazgo: number, dto: RecomendacionDto) {
    return this.db.withTransaction(async (client) => {
      await this.lock.assertMutable('hallazgo', idHallazgo, client);
      return this.insertRecomendacion(client, idHallazgo, dto);
    });
  }

  async updateRecomendacion(idRecomendacion: number, dto: UpdateRecomendacionDto) {
    return this.db.withTransaction(async (client) => {
      await this.lock.assertMutable('recomendacion', idRecomendacion, client);
      return this.db.one(
        `UPDATE recomendacion SET
           descripcion     = COALESCE($2, descripcion),
           prioridad       = COALESCE($3, prioridad),
           plazo_dias      = COALESCE($4, plazo_dias),
           responsable_sug = COALESCE($5, responsable_sug)
         WHERE id_recomendacion = $1 RETURNING ${COLS_RECOMENDACION}`,
        [
          idRecomendacion,
          dto.descripcion ?? null,
          dto.prioridad ?? null,
          dto.plazo_dias ?? null,
          dto.responsable_sug ?? null,
        ],
        client,
      );
    });
  }

  /**
   * Elimina una recomendación. Si la auditoría está EN_REVISION no deja un hallazgo sin
   * recomendación (rompería RN06 justo antes del cierre).
   */
  async removeRecomendacion(idRecomendacion: number) {
    return this.db.withTransaction(async (client) => {
      const { estado } = await this.lock.assertMutable('recomendacion', idRecomendacion, client);
      if (estado === 'EN_REVISION') {
        const unica = await this.db.one<{ codigo: string }>(
          `SELECT h.codigo FROM recomendacion r JOIN hallazgo h ON h.id_hallazgo = r.id_hallazgo
            WHERE r.id_recomendacion = $1
              AND (SELECT COUNT(*) FROM recomendacion x WHERE x.id_hallazgo = r.id_hallazgo) = 1`,
          [idRecomendacion],
          client,
        );
        if (unica) {
          throw AppError.conflict(
            `No se puede eliminar la única recomendación del hallazgo ${unica.codigo} mientras la auditoría ` +
              'está EN REVISIÓN (regla RN06).',
          );
        }
      }
      return this.db.one(
        `DELETE FROM recomendacion WHERE id_recomendacion = $1 RETURNING ${COLS_RECOMENDACION}`,
        [idRecomendacion],
        client,
      );
    });
  }
}
