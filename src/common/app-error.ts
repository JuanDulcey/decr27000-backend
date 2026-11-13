import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error de negocio con el formato del contrato: { ok: false, error, field? }.
 * `field` indica al frontend bajo qué campo mostrar el mensaje.
 */
export class AppError extends HttpException {
  constructor(
    status: HttpStatus,
    message: string,
    readonly field?: string,
    readonly details?: unknown,
  ) {
    super(message, status);
  }

  static badRequest(message: string, field?: string, details?: unknown): AppError {
    return new AppError(HttpStatus.BAD_REQUEST, message, field, details);
  }

  static unauthorized(message = 'Sesión no válida o expirada. Inicie sesión nuevamente.'): AppError {
    return new AppError(HttpStatus.UNAUTHORIZED, message);
  }

  static forbidden(message: string): AppError {
    return new AppError(HttpStatus.FORBIDDEN, message);
  }

  static notFound(message: string): AppError {
    return new AppError(HttpStatus.NOT_FOUND, message);
  }

  static conflict(message: string, field?: string): AppError {
    return new AppError(HttpStatus.CONFLICT, message, field);
  }

  static tooManyRequests(message: string): AppError {
    return new AppError(HttpStatus.TOO_MANY_REQUESTS, message);
  }
}
