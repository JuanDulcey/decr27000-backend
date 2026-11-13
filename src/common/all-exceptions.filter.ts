import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { AppError } from './app-error.js';

interface PgError {
  code?: string;
  constraint?: string;
  column?: string;
}

/**
 * Traducción de errores de PostgreSQL a respuestas del contrato (PLAN B1.5).
 * 23505 = unique_violation, 23503 = foreign_key_violation, 23514 = check_violation,
 * 23502 = not_null_violation, 22P02 = invalid_text_representation.
 */
function fromPostgres(err: PgError): { status: number; error: string; field?: string } | null {
  switch (err.code) {
    case '23505':
      return { status: 409, error: 'Ya existe un registro con esos datos (valor duplicado).' };
    case '23503':
      return {
        status: 409,
        error: 'La operación viola la integridad referencial: el registro está relacionado con otros datos.',
      };
    case '23514':
      return { status: 400, error: 'Los datos no cumplen una regla de integridad de la base de datos.' };
    case '23502':
      return { status: 400, error: 'Falta un dato obligatorio.', field: err.column };
    case '22P02':
      return { status: 400, error: 'Uno de los valores enviados no tiene el formato esperado.' };
    default:
      return null;
  }
}

/** Convierte cualquier error en { ok: false, error, field? } sin exponer trazas. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  constructor(@Inject(HttpAdapterHost) private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'Error interno del servidor. Intente nuevamente.';
    let field: string | undefined;
    let details: unknown;

    if (exception instanceof AppError) {
      status = exception.getStatus();
      error = exception.message;
      field = exception.field;
      details = exception.details;
    } else if (exception instanceof NotFoundException && exception.message.startsWith('Cannot ')) {
      // Mismo texto que usaba el backend provisional: mientras un endpoint no exista,
      // el frontend sigue usando su motor local (PLAN §2.7).
      status = HttpStatus.NOT_FOUND;
      error = 'Ruta no encontrada';
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      error = Array.isArray(message) ? message[0] : (message ?? exception.message);
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) {
        error = 'El cuerpo de la petición supera el tamaño máximo permitido.';
      }
    } else {
      const mapped = fromPostgres(exception as PgError);
      if (mapped) {
        ({ status, error, field } = mapped);
      }
    }

    if (status >= 500) {
      const method = httpAdapter.getRequestMethod(req);
      const url = httpAdapter.getRequestUrl(req);
      this.logger.error(
        `${method} ${url} -> ${status}: ${(exception as Error)?.message ?? exception}`,
        (exception as Error)?.stack,
      );
    }

    const payload: Record<string, unknown> = { ok: false, error };
    if (field) payload.field = field;
    if (details !== undefined) payload.details = details;
    httpAdapter.reply(ctx.getResponse(), payload, status);
  }
}
