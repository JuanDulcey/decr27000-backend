import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EmptyToUndefined, ToInt, Trim, TrimUpper } from '../../common/dto-helpers.js';
import { NIVELES } from '../../common/domain.js';

/** Recomendación asociada a un hallazgo (RF06). */
export class RecomendacionDto {
  @ApiProperty({ example: 'Designar responsable y ejecutar escaneos mensuales.' })
  @Trim()
  @MaxLength(2000, { message: 'La recomendación no puede superar 2000 caracteres.' })
  @IsString({ message: 'La descripción de la recomendación es obligatoria.' })
  @IsNotEmpty({ message: 'La descripción de la recomendación es obligatoria.' })
  descripcion: string;

  @ApiPropertyOptional({ enum: NIVELES, default: 'MEDIA' })
  @EmptyToUndefined()
  @TrimUpper()
  @IsOptional()
  @IsIn(NIVELES, { message: 'Prioridad inválida (ALTA, MEDIA o BAJA).' })
  prioridad?: (typeof NIVELES)[number];

  @ApiPropertyOptional({ example: 60, default: 60 })
  @ToInt()
  @IsOptional()
  @Max(3650, { message: 'El plazo no puede superar 3650 días.' })
  @Min(1, { message: 'El plazo debe ser de al menos 1 día.' })
  @IsInt({ message: 'El plazo debe ser un número entero de días.' })
  plazo_dias?: number;

  @ApiPropertyOptional({ example: 'Líder de Infraestructura' })
  @EmptyToUndefined()
  @IsOptional()
  @MaxLength(120, { message: 'El responsable no puede superar 120 caracteres.' })
  @IsString()
  responsable_sug?: string;
}

export class UpdateRecomendacionDto extends PartialType(RecomendacionDto) {}

/** Hallazgo con condición, criterio, causa, efecto/riesgo y severidad (RF05, RN05, CP-07). */
export class HallazgoDto {
  @ApiProperty({ example: 'No se evidencian escaneos ni reportes periódicos de vulnerabilidades.' })
  @Trim()
  @MaxLength(4000, { message: 'La condición no puede superar 4000 caracteres.' })
  @IsString({ message: 'La condición del hallazgo es obligatoria.' })
  @IsNotEmpty({ message: 'La condición del hallazgo es obligatoria.' })
  condicion: string;

  @ApiProperty({ example: 'ISO/IEC 27002:2022, control 8.8: Gestión de vulnerabilidades técnicas.' })
  @Trim()
  @MaxLength(4000, { message: 'El criterio no puede superar 4000 caracteres.' })
  @IsString({ message: 'El criterio del hallazgo es obligatorio.' })
  @IsNotEmpty({ message: 'El criterio del hallazgo es obligatorio.' })
  criterio: string;

  @ApiProperty({ example: 'No hay responsable asignado ni procedimiento de gestión de parches.' })
  @Trim()
  @MaxLength(4000, { message: 'La causa no puede superar 4000 caracteres.' })
  @IsString({ message: 'La causa raíz del hallazgo es obligatoria (CP-07).' })
  @IsNotEmpty({ message: 'La causa raíz del hallazgo es obligatoria (CP-07).' })
  causa: string;

  @ApiProperty({ example: 'Mayor probabilidad de explotación de vulnerabilidades conocidas.' })
  @Trim()
  @MaxLength(4000, { message: 'El efecto o riesgo no puede superar 4000 caracteres.' })
  @IsString({ message: 'El efecto o riesgo del hallazgo es obligatorio.' })
  @IsNotEmpty({ message: 'El efecto o riesgo del hallazgo es obligatorio.' })
  efecto_riesgo: string;

  @ApiProperty({ enum: NIVELES })
  @TrimUpper()
  @IsIn(NIVELES, { message: 'Seleccione la severidad del hallazgo (ALTA, MEDIA o BAJA).' })
  severidad: (typeof NIVELES)[number];

  @ApiPropertyOptional({ type: RecomendacionDto, description: 'Recomendación inicial (misma transacción)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecomendacionDto)
  recomendacion?: RecomendacionDto;
}

export class UpdateHallazgoDto extends PartialType(HallazgoDto) {}
