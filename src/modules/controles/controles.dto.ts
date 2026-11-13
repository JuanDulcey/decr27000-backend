import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { EmptyToUndefined, Trim, TrimUpper } from '../../common/dto-helpers.js';
import { CATEGORIAS } from '../../common/domain.js';

export class CreateControlDto {
  @ApiProperty({ example: '8.35' })
  @Trim()
  @Matches(/^[5-8]\.\d{1,2}$/, { message: 'El código ISO debe tener el formato 5.1 a 8.99.' })
  @IsNotEmpty({ message: 'El código ISO es obligatorio.' })
  codigo_iso: string;

  @ApiProperty({ enum: CATEGORIAS })
  @TrimUpper()
  @IsIn(CATEGORIAS, { message: 'Categoría inválida (ORGANIZACIONAL, PERSONAS, FISICO o TECNOLOGICO).' })
  categoria: string;

  @ApiProperty()
  @Trim()
  @MaxLength(200, { message: 'El nombre no puede superar 200 caracteres.' })
  @IsString({ message: 'El nombre del control es obligatorio.' })
  @IsNotEmpty({ message: 'El nombre del control es obligatorio.' })
  nombre: string;

  @ApiProperty()
  @Trim()
  @IsString({ message: 'El criterio normativo es obligatorio.' })
  @IsNotEmpty({ message: 'El criterio normativo es obligatorio.' })
  criterio: string;

  @ApiProperty()
  @Trim()
  @IsString({ message: 'La pregunta orientadora es obligatoria.' })
  @IsNotEmpty({ message: 'La pregunta orientadora es obligatoria.' })
  pregunta_orientadora: string;

  @ApiPropertyOptional()
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  ejemplo_aplicacion?: string;

  @ApiPropertyOptional()
  @EmptyToUndefined()
  @IsOptional()
  @IsString()
  evidencia_sugerida?: string;
}

/** Edición del catálogo: el código y la categoría no cambian (identifican el control de la norma). */
export class UpdateControlDto extends PartialType(CreateControlDto) {}
