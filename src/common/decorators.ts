import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export type Rol = 'auditor' | 'admin';

export interface AuthUser {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';
export const RAW_RESPONSE_KEY = 'rawResponse';

/** Ruta accesible sin token (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Restringe la ruta a los roles indicados (RNF04 / CP-13). */
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);

/** La respuesta se envía tal cual, sin el sobre { ok, data } (p. ej. /api/health). */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);

/** Usuario autenticado que dejó el JwtAuthGuard en la petición. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);

/** Respuesta con mensaje: el interceptor la convierte en { ok: true, message, data }. */
export class ApiMessage<T> {
  constructor(
    readonly message: string,
    readonly data: T,
  ) {}
}
