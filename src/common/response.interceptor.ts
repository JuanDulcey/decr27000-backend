import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { ApiMessage, RAW_RESPONSE_KEY } from './decorators.js';

/** Envuelve toda respuesta exitosa en el sobre del contrato: { ok: true, data, message? }. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (raw) return next.handle();

    return next.handle().pipe(
      map((result: unknown) =>
        result instanceof ApiMessage
          ? { ok: true, message: result.message, data: result.data }
          : { ok: true, data: result ?? null },
      ),
    );
  }
}
