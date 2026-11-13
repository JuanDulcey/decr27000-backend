/**
 * Validación de variables de entorno al arrancar (PLAN B1.2).
 * Si falta una variable obligatoria, la aplicación no arranca y lo explica.
 */
import { readSslCa } from '../database/pool.js';

export interface AppEnv {
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  DATABASE_URL: string;
  DB_POOL_MAX: number;
  DB_SSL_CA?: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  FRONTEND_URL: string;
  CORS_ORIGINS: string[];
  ALLOW_SEED_RESET: boolean;
  SWAGGER_ENABLED: boolean;
}

/** Valor público del .env.example: nunca debe usarse en producción. */
const EXAMPLE_JWT_SECRET = 'decr27000_iso27002_secret_key_2026_segura';

/** Convierte un valor de entorno a texto sin aceptar objetos. */
const str = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return `${value}`;
  return fallback;
};

const bool = (value: unknown, fallback: boolean): boolean => {
  const text = str(value).trim().toLowerCase();
  if (text === '') return fallback;
  return ['true', '1', 'yes', 'si', 'sí'].includes(text);
};

const int = (value: unknown, fallback: number): number => {
  const parsed = Number.parseInt(str(value), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const list = (value: unknown): string[] =>
  str(value)
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter((item) => item.length > 0 && item !== '*');

export function validateEnv(raw: Record<string, unknown>): AppEnv {
  const errors: string[] = [];
  const nodeEnvRaw = str(raw.NODE_ENV, 'development');
  const NODE_ENV = (['development', 'production', 'test'].includes(nodeEnvRaw)
    ? nodeEnvRaw
    : 'development') as AppEnv['NODE_ENV'];

  const DATABASE_URL = str(raw.DATABASE_URL).trim();
  if (!DATABASE_URL) errors.push('DATABASE_URL es obligatoria.');

  const JWT_SECRET = str(raw.JWT_SECRET).trim();
  if (JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET es obligatoria y debe tener al menos 32 caracteres.');
  }
  if (NODE_ENV === 'production' && (JWT_SECRET === EXAMPLE_JWT_SECRET || JWT_SECRET.startsWith('['))) {
    errors.push('JWT_SECRET no puede ser el valor público de .env.example ni un marcador en producción.');
  }

  if (errors.length > 0) {
    throw new Error(`Configuración inválida:\n - ${errors.join('\n - ')}`);
  }

  const FRONTEND_URL = str(raw.FRONTEND_URL, 'https://decr27000-frontend.vercel.app')
    .trim()
    .replace(/\/+$/, '');

  return {
    NODE_ENV,
    PORT: int(raw.PORT, 4000),
    DATABASE_URL,
    DB_POOL_MAX: int(raw.DB_POOL_MAX, 4),
    DB_SSL_CA: readSslCa(str(raw.DB_SSL_CA)),
    JWT_SECRET,
    JWT_EXPIRES_IN: str(raw.JWT_EXPIRES_IN).trim() || '8h',
    FRONTEND_URL,
    CORS_ORIGINS: list(raw.CORS_ORIGINS ?? raw.CORS_ORIGIN),
    ALLOW_SEED_RESET: bool(raw.ALLOW_SEED_RESET, false),
    SWAGGER_ENABLED: bool(raw.SWAGGER_ENABLED, NODE_ENV !== 'production'),
  };
}
