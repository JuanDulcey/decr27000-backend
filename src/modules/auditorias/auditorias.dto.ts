import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { EmptyToUndefined, ToInt, Trim, TrimUpper } from '../../common/dto-helpers.js';
import { ESTADOS_AUDITORIA } from '../../common/domain.js';
import { Transform } from 'class-transformer';

/** Datos generales de la auditoría (RF01). La regla fecha_fin >= fecha_inicio se valida en el servicio. */
export class AuditoriaDto {
  @ApiProperty({ example: 'Empresa XYZ S.A.S.' })
  @Trim()
  @MaxLength(120, { message: 'La organización no puede superar 120 caracteres.' })
  @IsString({ message: 'La organización es obligatoria.' })
  @IsNotEmpty({ message: 'La organización es obligatoria.' })
  organizacion: string;

  @ApiProperty({ example: 'Evaluar controles críticos de seguridad de la información.' })
  @Trim()
  @MaxLength(2000, { message: 'El objetivo no puede superar 2000 caracteres.' })
  @IsString({ message: 'El objetivo es obligatorio.' })
  @IsNotEmpty({ message: 'El objetivo es obligatorio.' })
  objetivo: string;

  @ApiProperty({ example: 'Infraestructura cloud, redes y aplicaciones centrales.' })
  @Trim()
  @MaxLength(2000, { message: 'El alcance no puede superar 2000 caracteres.' })
  @IsString({ message: 'El alcance es obligatorio.' })
  @IsNotEmpty({ message: 'El alcance es obligatorio.' })
  alcance: string;

  @ApiProperty({ example: '2026-11-10' })
  @Trim()
  @IsISO8601({ strict: true }, { message: 'La fecha de inicio no es válida (AAAA-MM-DD).' })
  @IsNotEmpty({ message: 'La fecha de inicio es obligatoria.' })
  fecha_inicio: string;

  @ApiProperty({ example: '2026-11-24' })
  @Trim()
  @IsISO8601({ strict: true }, { message: 'La fecha de cierre no es válida (AAAA-MM-DD).' })
  @IsNotEmpty({ message: 'La fecha de cierre es obligatoria.' })
  fecha_fin: string;

  @ApiPropertyOptional({ example: 'ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022' })
  @EmptyToUndefined()
  @IsOptional()
  @MaxLength(250, { message: 'Los referentes no pueden superar 250 caracteres.' })
  @IsString()
  referentes?: string;

  @ApiProperty({ example: 1 })
  @ToInt()
  @Min(1, { message: 'Seleccione el auditor responsable.' })
  @IsInt({ message: 'Seleccione el auditor responsable.' })
  @IsNotEmpty({ message: 'Seleccione el auditor responsable.' })
  id_auditor: number;
}

export class CambioEstadoDto {
  @ApiProperty({ enum: ESTADOS_AUDITORIA })
  @TrimUpper()
  @IsIn(ESTADOS_AUDITORIA, { message: 'Estado inválido (BORRADOR, EN_EJECUCION, EN_REVISION o CERRADA).' })
  estado: (typeof ESTADOS_AUDITORIA)[number];
}

export class SeleccionControlesDto {
  @ApiProperty({ type: [Number], example: [1, 15, 18, 24, 40, 47, 64, 66, 67, 72, 74, 82, 90] })
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((v) => (typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v)) : value,
  )
  @IsInt({ each: true, message: 'Cada control seleccionado debe ser un identificador numérico.' })
  @IsArray({ message: 'controles_ids debe ser una lista de identificadores de control.' })
  controles_ids: number[];
}
