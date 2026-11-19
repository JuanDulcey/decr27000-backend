import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { AppError } from '../../common/app-error.js';

/** Archivo recibido por multer (almacenamiento en memoria). */
export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Tipos de evidencia admitidos. El Content-Type que se guarda en el bucket sale de esta
 * tabla (no del navegador). Se excluyen HTML, SVG y ejecutables; además, la descarga
 * siempre es "attachment", así que el navegador nunca renderiza el archivo.
 */
const TIPOS: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.conf': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.zip': 'application/zip',
};

export const EXTENSIONES_PERMITIDAS = Object.keys(TIPOS);

/**
 * Multer decodifica los nombres de archivo como latin1; si el nombre venía en UTF-8
 * ("Política.pdf" llega como "PolÃ­tica.pdf") se corrige.
 */
export function nombreOriginal(raw: string): string {
  const reparado = Buffer.from(raw, 'latin1').toString('utf8');
  const nombre = reparado.includes('�') ? raw : reparado;
  // Sin rutas ni caracteres de control; máximo 255 caracteres.
  return (
    path
      .basename(nombre.replace(/\\/g, '/'))
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(-255) || 'archivo'
  );
}

/** Valida el archivo y devuelve lo necesario para guardarlo. */
export function prepararArchivo(
  archivo: ArchivoSubido | undefined,
  maxMb: number,
): { nombre: string; tipo: string; extension: string } {
  if (!archivo || !archivo.buffer || archivo.size === 0) {
    throw AppError.badRequest('Adjunte un archivo (campo "archivo" del formulario).', 'archivo');
  }
  if (archivo.size > maxMb * 1024 * 1024) {
    throw new AppError(413, `El archivo supera el máximo permitido de ${maxMb} MB.`, 'archivo');
  }
  const nombre = nombreOriginal(archivo.originalname);
  const extension = path.extname(nombre).toLowerCase();
  const tipo = TIPOS[extension];
  if (!tipo) {
    throw AppError.badRequest(
      `Tipo de archivo no permitido (${extension || 'sin extensión'}). Se admiten: ${EXTENSIONES_PERMITIDAS.join(', ')}.`,
      'archivo',
    );
  }
  return { nombre, tipo, extension };
}

/** Clave del objeto en el bucket: aleatoria y sin datos del usuario. */
export function claveArchivo(idAuditoria: number, idEvidencia: number, extension: string): string {
  return `evidencias/auditoria-${idAuditoria}/evidencia-${idEvidencia}/${randomUUID()}${extension}`;
}
