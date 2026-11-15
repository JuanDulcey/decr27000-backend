import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Trim } from '../../common/dto-helpers.js';

const ROLES = ['admin', 'auditor'] as const;

const TrimLower = () =>
  Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value));

export class CreateUsuarioDto {
  @ApiProperty({ example: 'Carlos M. (Auditor Interno)' })
  @Trim()
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  @IsString({ message: 'El nombre es obligatorio.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre: string;

  @ApiProperty({ example: 'carlos.auditor@auditsys.edu.co' })
  @TrimLower()
  @MaxLength(150, { message: 'El correo no puede superar 150 caracteres.' })
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  correo: string;

  @ApiProperty({ example: 'AuditSys2026*' })
  @MaxLength(100, { message: 'La contraseña no puede superar 100 caracteres.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @IsString({ message: 'La contraseña es obligatoria.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password: string;

  @ApiProperty({ enum: ROLES, example: 'auditor' })
  @TrimLower()
  @IsIn(ROLES, { message: 'El rol debe ser "admin" o "auditor".' })
  rol: (typeof ROLES)[number];
}

export class UpdateUsuarioDto {
  @ApiProperty({ example: 'Carlos M. (Auditor Líder)' })
  @Trim()
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres.' })
  @IsString({ message: 'El nombre es obligatorio.' })
  @IsNotEmpty({ message: 'El nombre es obligatorio.' })
  nombre: string;

  @ApiProperty({ example: 'carlos.auditor@auditsys.edu.co' })
  @TrimLower()
  @MaxLength(150, { message: 'El correo no puede superar 150 caracteres.' })
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido.' })
  @IsNotEmpty({ message: 'El correo es obligatorio.' })
  correo: string;

  @ApiProperty({ enum: ROLES, example: 'auditor' })
  @TrimLower()
  @IsIn(ROLES, { message: 'El rol debe ser "admin" o "auditor".' })
  rol: (typeof ROLES)[number];
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'NuevaClave2026*' })
  @MaxLength(100, { message: 'La contraseña no puede superar 100 caracteres.' })
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres.' })
  @IsString({ message: 'La contraseña es obligatoria.' })
  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password: string;
}
