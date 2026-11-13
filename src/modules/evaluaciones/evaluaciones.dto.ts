import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { EmptyToUndefined, Trim, TrimUpper } from '../../common/dto-helpers.js';
import { ESTADOS_EVALUACION } from '../../common/domain.js';

/** Evaluación de un control (RF03, RN03, CP-04, CP-05). */
export class EvaluacionDto {
  @ApiProperty({ enum: ESTADOS_EVALUACION })
  @TrimUpper()
  @IsIn(ESTADOS_EVALUACION, {
    message: 'Seleccione un estado: Implementado, Parcial, No implementado o No aplicable.',
  })
  estado: (typeof ESTADOS_EVALUACION)[number];

  @ApiProperty({ example: 'Política vigente, aprobada por la gerencia y revisada en 2026.' })
  @Trim()
  @MaxLength(4000, { message: 'La observación no puede superar 4000 caracteres.' })
  @IsString({ message: 'La observación del auditor es obligatoria para guardar la evaluación.' })
  @IsNotEmpty({ message: 'La observación del auditor es obligatoria para guardar la evaluación.' })
  observacion: string;

  @ApiPropertyOptional({ description: "Obligatoria si estado = 'NO_APLICABLE' (CP-05)" })
  @EmptyToUndefined()
  @IsOptional()
  @MaxLength(4000, { message: 'La justificación no puede superar 4000 caracteres.' })
  @IsString()
  justificacion_na?: string;
}

/** Evidencia asociada a un control evaluado (RF04, CP-06). */
export class EvidenciaDto {
  @ApiPropertyOptional({ example: 'EV-13', description: 'Si se omite, se genera EV-nn automáticamente' })
  @EmptyToUndefined()
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]{1,20}$/, { message: 'El código de evidencia admite letras, números y guiones (máx. 20).' })
  codigo_evidencia?: string;

  @ApiProperty({ example: 'Política de seguridad v2.0 aprobada' })
  @Trim()
  @MaxLength(2000, { message: 'La descripción no puede superar 2000 caracteres.' })
  @IsString({ message: 'La descripción de la evidencia es obligatoria.' })
  @IsNotEmpty({ message: 'La descripción de la evidencia es obligatoria.' })
  descripcion: string;

  @ApiProperty({ example: 'Repositorio Documental TI' })
  @Trim()
  @MaxLength(120, { message: 'La fuente no puede superar 120 caracteres.' })
  @IsString({ message: 'La fuente de la evidencia es obligatoria.' })
  @IsNotEmpty({ message: 'La fuente de la evidencia es obligatoria.' })
  fuente: string;

  @ApiPropertyOptional({ example: '2026-11-10', description: 'Por defecto, la fecha de hoy' })
  @EmptyToUndefined()
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'La fecha de la evidencia no es válida (AAAA-MM-DD).' })
  fecha_evidencia?: string;

  @ApiPropertyOptional({ example: 'DOC-POL-2026.pdf' })
  @EmptyToUndefined()
  @IsOptional()
  @MaxLength(500, { message: 'La referencia no puede superar 500 caracteres.' })
  @IsString()
  referencia_url?: string;

  @ApiPropertyOptional({ default: true })
  @Transform(({ value }: { value: unknown }) => (value === 'true' ? true : value === 'false' ? false : value))
  @IsOptional()
  @IsBoolean({ message: 'es_simulada debe ser verdadero o falso.' })
  es_simulada?: boolean;
}
