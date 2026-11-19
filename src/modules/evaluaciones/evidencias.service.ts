import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import { nextCode } from '../../common/domain.js';
import { DatabaseService } from '../../database/database.service.js';
import { AuditLockService } from '../core/audit-lock.service.js';
import { StorageService } from '../storage/storage.service.js';
import { ArchivoSubido, claveArchivo, prepararArchivo } from './archivos.js';
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
  archivo_nombre: string | null;
  archivo_tipo: string | null;
  archivo_tamano: number | null;
  tiene_archivo: boolean;
}

/** Columnas públicas de la evidencia (la clave del bucket no se expone). */
const COLUMNAS =
  'id_evidencia, id_evaluacion, codigo_evidencia, descripcion, fuente, fecha_evidencia, referencia_url, es_simulada, ' +
  'archivo_nombre, archivo_tipo, archivo_tamano, (archivo_key IS NOT NULL) AS tiene_archivo';

/** Vigencia de los enlaces de descarga prefirmados. */
const DESCARGA_SEGUNDOS = 300;

@Injectable()
export class EvidenciasService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditLockService) private readonly lock: AuditLockService,
    @Inject(StorageService) private readonly storage: StorageService,
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
    const borrada = await this.db.withTransaction(async (client) => {
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
      return (await this.db.one<Evidencia & { archivo_key: string | null }>(
        `DELETE FROM evidencia WHERE id_evidencia = $1 RETURNING ${COLUMNAS}, archivo_key`,
        [idEvidencia],
        client,
      )) as Evidencia & { archivo_key: string | null };
    });
    // Después del COMMIT: si había archivo, se borra del bucket (best-effort).
    const { archivo_key, ...publica } = borrada;
    if (archivo_key && this.storage.enabled) await this.storage.remove(archivo_key);
    return publica;
  }

  /**
   * Adjunta (o reemplaza) el archivo de una evidencia en el bucket S3.
   * 1) verifica que la auditoría no esté CERRADA, 2) sube el archivo, 3) guarda los datos en una
   * transacción que vuelve a verificar el bloqueo, 4) borra el archivo anterior si lo había.
   * Si falla el paso 3, el archivo recién subido se elimina para no dejar huérfanos.
   */
  async adjuntarArchivo(idEvidencia: number, archivo: ArchivoSubido | undefined, maxMb: number): Promise<Evidencia> {
    if (!this.storage.enabled) {
      throw AppError.serviceUnavailable(
        'El almacenamiento de archivos no está configurado en este entorno (variables del bucket).',
      );
    }
    const { id_auditoria } = await this.lock.assertMutable('evidencia', idEvidencia);
    const { nombre, tipo, extension } = prepararArchivo(archivo, maxMb);
    const key = claveArchivo(id_auditoria, idEvidencia, extension);
    const bytes = (archivo as ArchivoSubido).buffer;
    await this.storage.put(key, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), tipo);

    let anterior: string | null = null;
    try {
      const evidencia = await this.db.withTransaction(async (client) => {
        await this.lock.assertMutable('evidencia', idEvidencia, client);
        const previa = await this.db.one<{ archivo_key: string | null }>(
          'SELECT archivo_key FROM evidencia WHERE id_evidencia = $1',
          [idEvidencia],
          client,
        );
        anterior = previa?.archivo_key ?? null;
        return (await this.db.one<Evidencia>(
          `UPDATE evidencia SET archivo_key = $2, archivo_nombre = $3, archivo_tipo = $4, archivo_tamano = $5
            WHERE id_evidencia = $1 RETURNING ${COLUMNAS}`,
          [idEvidencia, key, nombre, tipo, bytes.byteLength],
          client,
        )) as Evidencia;
      });
      if (anterior) await this.storage.remove(anterior);
      return evidencia;
    } catch (err) {
      await this.storage.remove(key);
      throw err;
    }
  }

  /** Enlace prefirmado de descarga o vista previa (5 min). Se permite también en auditorías CERRADAS. */
  async enlaceDescarga(idEvidencia: number, inline = false) {
    await this.lock.resolve('evidencia', idEvidencia);
    const ev = await this.db.one<{ archivo_key: string | null; archivo_nombre: string; archivo_tipo: string; archivo_tamano: number }>(
      'SELECT archivo_key, archivo_nombre, archivo_tipo, archivo_tamano FROM evidencia WHERE id_evidencia = $1',
      [idEvidencia],
    );
    if (!ev?.archivo_key) throw AppError.notFound('La evidencia no tiene un archivo adjunto.');
    const esPrevisualizable =
      ev.archivo_tipo.startsWith('image/') ||
      ev.archivo_tipo.startsWith('video/') ||
      ev.archivo_tipo.startsWith('text/') ||
      ev.archivo_tipo === 'application/pdf' ||
      ev.archivo_tipo === 'application/json';
    const disposition = inline && esPrevisualizable ? 'inline' : 'attachment';
    const url = await this.storage.presignedDownload(ev.archivo_key, ev.archivo_nombre, DESCARGA_SEGUNDOS, disposition);
    return {
      url,
      expira_en_segundos: DESCARGA_SEGUNDOS,
      archivo_nombre: ev.archivo_nombre,
      archivo_tipo: ev.archivo_tipo,
      archivo_tamano: ev.archivo_tamano,
    };
  }

  /** Obtiene los bytes del archivo desde el bucket para vista previa autenticada (PDF/texto). */
  async obtenerContenido(idEvidencia: number): Promise<{ buffer: Uint8Array; archivo_nombre: string; archivo_tipo: string }> {
    await this.lock.resolve('evidencia', idEvidencia);
    const ev = await this.db.one<{ archivo_key: string | null; archivo_nombre: string; archivo_tipo: string }>(
      'SELECT archivo_key, archivo_nombre, archivo_tipo FROM evidencia WHERE id_evidencia = $1',
      [idEvidencia],
    );
    if (!ev?.archivo_key) throw AppError.notFound('La evidencia no tiene un archivo adjunto.');
    const buffer = await this.storage.get(ev.archivo_key);
    return { buffer, archivo_nombre: ev.archivo_nombre, archivo_tipo: ev.archivo_tipo };
  }

  /** Quita el archivo de la evidencia (la evidencia se conserva). */
  async quitarArchivo(idEvidencia: number): Promise<Evidencia> {
    const { evidencia, key } = await this.db.withTransaction(async (client) => {
      await this.lock.assertMutable('evidencia', idEvidencia, client);
      const previa = await this.db.one<{ archivo_key: string | null }>(
        'SELECT archivo_key FROM evidencia WHERE id_evidencia = $1',
        [idEvidencia],
        client,
      );
      if (!previa?.archivo_key) throw AppError.notFound('La evidencia no tiene un archivo adjunto.');
      const actualizada = (await this.db.one<Evidencia>(
        `UPDATE evidencia SET archivo_key = NULL, archivo_nombre = NULL, archivo_tipo = NULL, archivo_tamano = NULL
          WHERE id_evidencia = $1 RETURNING ${COLUMNAS}`,
        [idEvidencia],
        client,
      )) as Evidencia;
      return { evidencia: actualizada, key: previa.archivo_key };
    });
    if (this.storage.enabled) await this.storage.remove(key);
    return evidencia;
  }
}
