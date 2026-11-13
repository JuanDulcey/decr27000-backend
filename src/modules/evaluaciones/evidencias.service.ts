import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import { nextCode } from '../../common/domain.js';
import { DatabaseService } from '../../database/database.service.js';
import { AuditLockService } from '../core/audit-lock.service.js';
import type { EvidenciaDto } from './evaluaciones.dto.js';

export interface Evidencia {
  id_evidencia: number;
  id_evaluacion: number;
  codigo_evidencia: string;
  descripcion: string;
  fuente: string;
  fecha_evidencia: string;
  referencia_url: string | null;
  es_simulada: boolean;
}

const COLUMNAS =
  'id_evidencia, id_evaluacion, codigo_evidencia, descripcion, fuente, fecha_evidencia, referencia_url, es_simulada';

@Injectable()
export class EvidenciasService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditLockService) private readonly lock: AuditLockService,
  ) {}

  /** RF04: registra la evidencia; si no trae código, genera EV-nn (mayor existente + 1 en la auditoría). */
  async create(idEvaluacion: number, dto: EvidenciaDto): Promise<Evidencia> {
    return this.db.withTransaction(async (client) => {
      // FOR UPDATE sobre la auditoría: serializa la generación de códigos EV-nn.
      const { id_auditoria } = await this.lock.assertMutable('evaluacion', idEvaluacion, client);

      const usados = await this.db.one<{ max: number; existe: boolean }>(
        `SELECT COALESCE(MAX(NULLIF(SUBSTRING(ev.codigo_evidencia FROM '^EV-(\\d+)$'), '')::INT), 0) AS max,
                COALESCE(BOOL_OR(UPPER(ev.codigo_evidencia) = UPPER($2)), FALSE) AS existe
           FROM evidencia ev JOIN evaluacion_control e ON e.id_evaluacion = ev.id_evaluacion
          WHERE e.id_auditoria = $1`,
        [id_auditoria, dto.codigo_evidencia ?? ''],
        client,
      );
      if (dto.codigo_evidencia && usados?.existe) {
        throw AppError.conflict(
          `El código ${dto.codigo_evidencia} ya existe en esta auditoría.`,
          'codigo_evidencia',
        );
      }
      const codigo = dto.codigo_evidencia ?? nextCode('EV', usados?.max ?? 0);

      return (await this.db.one<Evidencia>(
        `INSERT INTO evidencia (id_evaluacion, codigo_evidencia, descripcion, fuente, fecha_evidencia, referencia_url, es_simulada)
         VALUES ($1, $2, $3, $4, COALESCE($5::DATE, CURRENT_DATE), $6, $7)
         RETURNING ${COLUMNAS}`,
        [
          idEvaluacion,
          codigo,
          dto.descripcion,
          dto.fuente,
          dto.fecha_evidencia ?? null,
          dto.referencia_url ?? null,
          dto.es_simulada ?? true,
        ],
        client,
      )) as Evidencia;
    });
  }

  /**
   * Elimina una evidencia. Si la auditoría está EN_REVISION, no permite dejar sin evidencia
   * a un control IMPLEMENTADO o PARCIAL (rompería RN04 justo antes del cierre).
   */
  async remove(idEvidencia: number): Promise<Evidencia> {
    return this.db.withTransaction(async (client) => {
      const { estado } = await this.lock.assertMutable('evidencia', idEvidencia, client);
      if (estado === 'EN_REVISION') {
        const unica = await this.db.one<{ codigo_iso: string }>(
          `SELECT c.codigo_iso
             FROM evidencia ev
             JOIN evaluacion_control e ON e.id_evaluacion = ev.id_evaluacion
             JOIN control c ON c.id_control = e.id_control
            WHERE ev.id_evidencia = $1 AND e.estado IN ('IMPLEMENTADO', 'PARCIAL')
              AND (SELECT COUNT(*) FROM evidencia x WHERE x.id_evaluacion = ev.id_evaluacion) = 1`,
          [idEvidencia],
          client,
        );
        if (unica) {
          throw AppError.conflict(
            `No se puede eliminar la única evidencia del control ${unica.codigo_iso} mientras la auditoría ` +
              'está EN REVISIÓN (regla RN04). Devuélvala a EN EJECUCIÓN o registre otra evidencia primero.',
          );
        }
      }
      return (await this.db.one<Evidencia>(
        `DELETE FROM evidencia WHERE id_evidencia = $1 RETURNING ${COLUMNAS}`,
        [idEvidencia],
        client,
      )) as Evidencia;
    });
  }
}
