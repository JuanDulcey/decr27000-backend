import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/*
 * Orden de los decoradores: class-validator evalúa de abajo hacia arriba y, con
 * stopAtFirstError, reporta el primero que falla. Por eso la regla más básica
 * (obligatorio) va al final.
 */
export class LoginDto {
  @ApiProperty({ example: 'ana.auditora@auditsys.edu.co' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @MaxLength(120, { message: 'El correo no puede superar 120 caracteres.' })
  @IsEmail({}, { message: 'Ingrese un correo electrónico válido.' })
  @IsNotEmpty({ message: 'Ingrese su correo institucional.' })
  correo: string;

  @ApiProperty({ example: 'Audit2026*' })
  @MaxLength(128, { message: 'La contraseña no puede superar 128 caracteres.' })
  @IsString({ message: 'Ingrese su contraseña.' })
  @IsNotEmpty({ message: 'Ingrese su contraseña.' })
  password: string;
}
