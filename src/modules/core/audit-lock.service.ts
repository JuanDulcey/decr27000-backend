import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { AppError } from '../../common/app-error.js';
import { EstadoAuditoria, MSG_AUDITORIA_CERRADA } from '../../common/domain.js';
import { DatabaseService } from '../../database/database.service.js';

export type Recurso = 'auditoria' | 'evaluacion' | 'evidencia' | 'hallazgo' | 'recomendacion';

export interface AuditContext {
  id_auditoria: number;
  estado: EstadoAuditoria;
}

const NOMBRES: Record<Recurso, string> = {
  auditoria: 'Auditoría no encontrada.',
  evaluacion: 'Control evaluado no encontrado.',
  evidencia: 'Evidencia no encontrada.',
  hallazgo: 'Hallazgo no encontrado.',
  recomendacion: 'Recomendación no encontrada.',
};

/** Cadena de joins desde cada recurso hasta su auditoría (trazabilidad RNF05). */
const SQL: Record<Recurso, string> = {
  auditoria: `SELECT a.id_auditoria, a.estado FROM auditoria a WHERE a.id_auditoria = $1`,
  evaluacion: `SELECT a.id_auditoria, a.estado FROM evaluacion_control e
                 JOIN auditoria a ON a.id_auditoria = e.id_auditoria WHERE e.id_evaluacion = $1`,
  evidencia: `SELECT a.id_auditoria, a.estado FROM evidencia ev
                JOIN evaluacion_control e ON e.id_evaluacion = ev.id_evaluacion
                JOIN auditoria a ON a.id_auditoria = e.id_auditoria WHERE ev.id_evidencia = $1`,
  hallazgo: `SELECT a.id_auditoria, a.estado FROM hallazgo h
               JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
               JOIN auditoria a ON a.id_auditoria = e.id_auditoria WHERE h.id_hallazgo = $1`,
  recomendacion: `SELECT a.id_auditoria, a.estado FROM recomendacion r
                    JOIN hallazgo h ON h.id_hallazgo = r.id_hallazgo
                    JOIN evaluacion_control e ON e.id_evaluacion = h.id_evaluacion
                    JOIN auditoria a ON a.id_auditoria = e.id_auditoria WHERE r.id_recomendacion = $1`,
};

/**
 * Inmutabilidad de auditorías CERRADA (RN07 / CP-13).
 * Dentro de una transacción bloquea la fila de la auditoría (FOR UPDATE) para que un
 * cierre concurrente espere y para serializar la generación de códigos H-nn / EV-nn.
 */
@Injectable()
export class AuditLockService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async resolve(recurso: Recurso, id: number, client?: pg.PoolClient): Promise<AuditContext> {
    const lock = client ? ' FOR UPDATE OF a' : '';
    const row = await this.db.one<AuditContext>(SQL[recurso] + lock, [id], client);
    if (!row) throw AppError.notFound(NOMBRES[recurso]);
    return row;
  }

  /** Igual que resolve(), pero responde 403 si la auditoría está CERRADA. */
  async assertMutable(recurso: Recurso, id: number, client?: pg.PoolClient): Promise<AuditContext> {
    const ctx = await this.resolve(recurso, id, client);
    if (ctx.estado === 'CERRADA') throw AppError.forbidden(MSG_AUDITORIA_CERRADA);
    return ctx;
  }
}
