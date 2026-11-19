import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AwsClient } from 'aws4fetch';
import { AppError } from '../../common/app-error.js';
import type { AppEnv, StorageConfig } from '../../config/env.js';

/** Codifica cada segmento de la clave sin tocar las barras. */
const encodeKey = (key: string): string => key.split('/').map(encodeURIComponent).join('/');

/**
 * Almacenamiento de archivos de evidencias en un bucket S3 compatible (Railway Storage Buckets).
 *
 * - Opcional: sin las variables del bucket, `enabled` es false y las operaciones responden 503;
 *   el resto de la API funciona igual.
 * - Liviano para Render gratuito: usa `aws4fetch` (firma SigV4 con fetch nativo, ~65 KB) y lo
 *   carga solo si el bucket está configurado.
 * - El bucket es privado: las descargas usan URLs prefirmadas de corta duración, así el archivo
 *   va directo del bucket al navegador sin pasar por el backend (no gasta cómputo de Render).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly config: StorageConfig | null;
  private client: AwsClient | null = null;

  constructor(@Inject(ConfigService) configService: ConfigService<AppEnv, true>) {
    this.config = configService.get('STORAGE', { infer: true });
    const missing = configService.get('STORAGE_MISSING', { infer: true });
    if (missing.length > 0) {
      this.logger.warn(
        `Configuración del bucket incompleta (faltan: ${missing.join(', ')}): la carga de archivos queda desactivada.`,
      );
    }
  }

  get enabled(): boolean {
    return this.config !== null;
  }

  onModuleInit(): void {
    if (this.config) {
      this.logger.log(
        `Bucket de evidencias activo (${new URL(this.config.endpoint).host}, estilo ${this.config.urlStyle}).`,
      );
    } else {
      this.logger.log('Bucket de evidencias no configurado: la carga de archivos está desactivada (opcional).');
    }
  }

  private requireConfig(): StorageConfig {
    if (!this.config) {
      throw AppError.serviceUnavailable(
        'El almacenamiento de archivos no está configurado en este entorno (variables del bucket).',
      );
    }
    return this.config;
  }

  private async aws(): Promise<AwsClient> {
    const config = this.requireConfig();
    if (!this.client) {
      const { AwsClient } = await import('aws4fetch');
      this.client = new AwsClient({
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
        service: 's3',
        region: config.region,
      });
    }
    return this.client;
  }

  /** URL del objeto (o del bucket si key es vacía) según el estilo virtual-hosted o path. */
  objectUrl(key: string): URL {
    const config = this.requireConfig();
    const base = new URL(config.endpoint);
    const path = key ? `/${encodeKey(key)}` : '/';
    if (config.urlStyle === 'path') {
      return new URL(`${base.protocol}//${base.host}/${encodeURIComponent(config.bucket)}${key ? path : ''}`);
    }
    return new URL(`${base.protocol}//${config.bucket}.${base.host}${path}`);
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<void> {
    const aws = await this.aws();
    const res = await aws.fetch(this.objectUrl(key).toString(), {
      method: 'PUT',
      // Uint8Array es un cuerpo válido para fetch; el cast evita la diferencia de tipos de TS.
      body: body as unknown as BodyInit,
      headers: { 'Content-Type': contentType, 'Content-Length': String(body.byteLength) },
    });
    if (!res.ok) {
      const detalle = (await res.text().catch(() => '')).slice(0, 300);
      this.logger.error(`PUT ${key} → HTTP ${res.status} ${detalle}`);
      throw AppError.badGateway('No se pudo guardar el archivo en el almacenamiento. Intente de nuevo.');
    }
  }

  /** Borra el objeto; los errores se registran pero no interrumpen (limpieza best-effort). */
  async remove(key: string): Promise<void> {
    try {
      const aws = await this.aws();
      const res = await aws.fetch(this.objectUrl(key).toString(), { method: 'DELETE' });
      if (!res.ok && res.status !== 404) this.logger.warn(`DELETE ${key} → HTTP ${res.status}`);
    } catch (err) {
      this.logger.warn(`No se pudo borrar ${key} del bucket: ${(err as Error).message}`);
    }
  }

  /** URL prefirmada de descarga (por defecto 5 minutos) que fuerza "descargar como" con el nombre original. */
  async presignedDownload(key: string, filename: string, expiresSeconds = 300): Promise<string> {
    const aws = await this.aws();
    const url = this.objectUrl(key);
    const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    url.searchParams.set(
      'response-content-disposition',
      `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    url.searchParams.set('X-Amz-Expires', String(expiresSeconds));
    const signed = await aws.sign(url.toString(), { method: 'GET', aws: { signQuery: true } });
    return signed.url;
  }

  /** Verifica credenciales y acceso al bucket (HEAD bucket). */
  async ping(): Promise<'UP' | 'DOWN' | 'DISABLED'> {
    if (!this.config) return 'DISABLED';
    try {
      const aws = await this.aws();
      const res = await aws.fetch(this.objectUrl('').toString(), { method: 'HEAD' });
      return res.ok ? 'UP' : 'DOWN';
    } catch {
      return 'DOWN';
    }
  }
}
