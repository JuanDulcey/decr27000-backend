import { ValidationError, ValidationPipe } from '@nestjs/common';
import { AppError } from './app-error.js';

function firstError(errors: ValidationError[]): { field: string; message: string } | null {
  for (const err of errors) {
    if (err.constraints) {
      const message = Object.values(err.constraints)[0];
      if (message) return { field: err.property, message };
    }
    if (err.children?.length) {
      const nested = firstError(err.children);
      if (nested) return { field: `${err.property}.${nested.field}`, message: nested.message };
    }
  }
  return null;
}

/**
 * ValidationPipe global (RNF03): elimina campos desconocidos, convierte tipos y
 * responde con el primer error en el formato { ok: false, error, field }.
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: false },
    stopAtFirstError: true,
    exceptionFactory: (errors) => {
      const first = firstError(errors);
      if (!first) return AppError.badRequest('Datos inválidos.');
      if (first.message.includes('should not exist')) {
        return AppError.badRequest(`El campo "${first.field}" no está permitido.`, first.field);
      }
      return AppError.badRequest(first.message, first.field);
    },
  });
}
