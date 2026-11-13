/** Constantes y utilidades del dominio auditor (compartidas por los módulos). */

export const ESTADOS_AUDITORIA = ['BORRADOR', 'EN_EJECUCION', 'EN_REVISION', 'CERRADA'] as const;
export type EstadoAuditoria = (typeof ESTADOS_AUDITORIA)[number];

export const ESTADOS_EVALUACION = ['IMPLEMENTADO', 'PARCIAL', 'NO_IMPLEMENTADO', 'NO_APLICABLE'] as const;
export type EstadoEvaluacion = (typeof ESTADOS_EVALUACION)[number] | 'PENDIENTE';

export const NIVELES = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type Nivel = (typeof NIVELES)[number];

export const CATEGORIAS = ['ORGANIZACIONAL', 'PERSONAS', 'FISICO', 'TECNOLOGICO'] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const REFERENTES_OFICIALES = 'ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022';
export const RESPONSABLE_POR_DEFECTO = 'Líder de TI / Seguridad de la Información';
export const MIN_CONTROLES = 10;
export const MAX_CONTROLES = 15;
export const MIN_HALLAZGOS_CIERRE = 3;

export const MSG_AUDITORIA_CERRADA =
  'Operación denegada: la auditoría se encuentra CERRADA y su registro es inmutable.';

export const LIMITACIONES =
  'LIMITACIONES Y SALVAGUARDA ACADÉMICA: El porcentaje e indicador de cumplimiento presentado en este ' +
  'informe es estrictamente descriptivo y se fundamenta en la muestra de controles evaluados durante el ' +
  'ejercicio académico. No constituye una certificación en ISO/IEC 27001:2022 ni sustituye el juicio ' +
  'profesional del auditor ni una auditoría de tercera parte acreditada.';

/** Orden numérico de códigos ISO ("5.2" antes que "5.10") para usar en SQL. */
export const ORDEN_CODIGO_ISO =
  "SPLIT_PART(c.codigo_iso, '.', 1)::INT, SPLIT_PART(c.codigo_iso, '.', 2)::INT";

/** 33.3 → "33,3 %" (mismo formato que el frontend, es-CO). */
export function formatPercent(value: number): string {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1).replace('.', ',')} %`;
}

/** Siguiente código consecutivo "PREFIJO-nn" a partir del mayor número existente. */
export function nextCode(prefix: 'H' | 'EV', maxNumber: number): string {
  return `${prefix}-${String(maxNumber + 1).padStart(2, '0')}`;
}
