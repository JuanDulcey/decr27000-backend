import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { IncomingMessage } from 'node:http';
import { AppError } from './app-error.js';
import { FORBIDDEN_MESSAGE_KEY, IS_PUBLIC_KEY, ROLES_KEY } from './decorators.js';
import type { AuthUser, Rol } from './decorators.js';

interface JwtPayload {
  sub: number;
  nombre: string;
  correo: string;
  rol: Rol;
}

/**
 * Guard global: exige "Authorization: Bearer <token>" salvo en rutas @Public().
 * Verificación local del JWT, sin consultar la BD en cada petición (PLAN §2.6).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<IncomingMessage & { user?: AuthUser }>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw AppError.unauthorized('Falta el token de acceso. Inicie sesión.');
    }
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      req.user = { id_usuario: payload.sub, nombre: payload.nombre, correo: payload.correo, rol: payload.rol };
      return true;
    } catch {
      throw AppError.unauthorized();
    }
  }
}

/** Guard global: aplica @Roles(...) (CP-13: solo admin edita el catálogo). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (user && roles.includes(user.rol)) return true;
    const message = this.reflector.getAllAndOverride<string | undefined>(FORBIDDEN_MESSAGE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    throw AppError.forbidden(message ?? 'Acceso denegado: su rol no tiene permiso para esta operación.');
  }
}

/** IP real del cliente detrás del proxy de Render (primera IP de X-Forwarded-For). */
export function clientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  return first || req.socket?.remoteAddress || 'desconocida';
}

/**
 * Límite de intentos FALLIDOS de login: 10 por IP cada 15 minutos (PLAN B1.6).
 * Los inicios de sesión correctos no cuentan y limpian el contador, así varios integrantes
 * detrás de la misma IP (p. ej. la red de la universidad) no se bloquean entre sí.
 * En memoria y sin dependencias: suficiente para una sola instancia en Render gratuito.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  static readonly WINDOW_MS = 15 * 60 * 1000;
  static readonly MAX_ATTEMPTS = 10;
  private static readonly fails = new Map<string, { count: number; resetAt: number }>();

  static reset(ip?: string): void {
    if (ip) LoginRateLimitGuard.fails.delete(ip);
    else LoginRateLimitGuard.fails.clear();
  }

  /** Registra un intento fallido para la IP. */
  static registerFailure(ip: string): void {
    const now = Date.now();
    const fails = LoginRateLimitGuard.fails;
    if (fails.size > 5000) {
      for (const [key, value] of fails) if (value.resetAt <= now) fails.delete(key);
    }
    const entry = fails.get(ip);
    if (!entry || entry.resetAt <= now) {
      fails.set(ip, { count: 1, resetAt: now + LoginRateLimitGuard.WINDOW_MS });
    } else {
      entry.count += 1;
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const ip = clientIp(context.switchToHttp().getRequest<IncomingMessage>());
    const entry = LoginRateLimitGuard.fails.get(ip);
    const now = Date.now();
    if (entry && entry.resetAt > now && entry.count >= LoginRateLimitGuard.MAX_ATTEMPTS) {
      const minutes = Math.ceil((entry.resetAt - now) / 60000);
      throw AppError.tooManyRequests(
        `Demasiados intentos fallidos de inicio de sesión. Intente de nuevo en ${minutes} minuto(s).`,
      );
    }
    return true;
  }
}
