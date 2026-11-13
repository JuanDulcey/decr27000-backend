import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { AppError } from './app-error.js';

/** Recorta espacios en los textos recibidos. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value));

/** Recorta y pasa a mayúsculas (estados, severidades, prioridades). */
export const TrimUpper = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  );

/** Convierte textos vacíos en undefined para que @IsOptional los trate como ausentes. */
export const EmptyToUndefined = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  });

/** Convierte "12" en 12; deja intacto lo que no sea numérico para que falle la validación. */
export const ToInt = () =>
  Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) return Number.parseInt(value, 10);
    return value;
  });

/** Valida identificadores de ruta (:id) como enteros positivos. */
@Injectable()
export class IdPipe implements PipeTransform<string, number> {
  transform(value: string, metadata: ArgumentMetadata): number {
    const id = Number(value);
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(id) || id <= 0) {
      throw AppError.badRequest(`Identificador inválido: "${value}".`, metadata.data);
    }
    return id;
  }
}
