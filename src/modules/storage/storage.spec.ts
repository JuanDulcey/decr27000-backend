import { ConfigService } from '@nestjs/config';
import { readStorage, validateEnv } from '../../config/env.js';
import { StorageService } from './storage.service.js';

const base = { DATABASE_URL: 'postgres://u:p@localhost:5432/db', JWT_SECRET: 'x'.repeat(32) };
const bucket = {
  ENPOINT_URL: 'https://t3.storageapi.dev/',
  BUCKET_NAME: 'mi-bucket-123',
  ACCESS_KEY_BUCKET: 'AKIDEXAMPLE',
  SECRET_KEY_BUCKET: 'secret-example',
};

const service = (raw: Record<string, unknown>) => {
  const env = validateEnv({ ...base, ...raw });
  return new StorageService({ get: (k: keyof typeof env) => env[k] } as unknown as ConfigService<never, true>);
};

describe('Configuración del bucket (opcional)', () => {
  it('sin variables del bucket: desactivado y sin avisos', () => {
    expect(readStorage({})).toEqual({ config: null, missing: [] });
    expect(validateEnv(base).STORAGE).toBeNull();
  });

  it('acepta los nombres del .env del equipo (incluido ENPOINT_URL) y quita la barra final', () => {
    const { config } = readStorage(bucket);
    expect(config).toEqual({
      endpoint: 'https://t3.storageapi.dev',
      bucket: 'mi-bucket-123',
      accessKeyId: 'AKIDEXAMPLE',
      secretAccessKey: 'secret-example',
      region: 'auto',
      urlStyle: 'virtual',
    });
  });

  it('acepta los nombres BUCKET_* canónicos y el estilo path', () => {
    const { config } = readStorage({
      BUCKET_ENDPOINT: 'http://localhost:9000',
      BUCKET_NAME: 'b',
      BUCKET_ACCESS_KEY_ID: 'a',
      BUCKET_SECRET_ACCESS_KEY: 's',
      BUCKET_URL_STYLE: 'path',
      BUCKET_REGION: 'us-east-1',
    });
    expect(config).toMatchObject({ urlStyle: 'path', region: 'us-east-1' });
  });

  it('configuración incompleta: desactivado e informa qué falta (no impide arrancar)', () => {
    const { config, missing } = readStorage({ BUCKET_NAME: 'b', ACCESS_KEY_BUCKET: 'a' });
    expect(config).toBeNull();
    expect(missing).toEqual(['ENDPOINT_URL', 'SECRET_KEY_BUCKET']);
    expect(() => validateEnv({ ...base, BUCKET_NAME: 'b' })).not.toThrow();
  });

  it('EVIDENCIA_MAX_MB por defecto es 5 y nunca supera 20', () => {
    expect(validateEnv(base).EVIDENCIA_MAX_MB).toBe(5);
    expect(validateEnv({ ...base, EVIDENCIA_MAX_MB: '200' }).EVIDENCIA_MAX_MB).toBe(20);
  });
});

describe('StorageService', () => {
  it('desactivado: enabled=false, ping DISABLED y las operaciones responden 503', async () => {
    const s = service({});
    expect(s.enabled).toBe(false);
    expect(await s.ping()).toBe('DISABLED');
    await expect(s.put('k', new Uint8Array([1]), 'text/plain')).rejects.toMatchObject({ status: 503 });
  });

  it('construye URLs virtual-hosted (Railway) y path-style', () => {
    expect(service(bucket).objectUrl('evidencias/a b/ñ.pdf').toString()).toBe(
      'https://mi-bucket-123.t3.storageapi.dev/evidencias/a%20b/%C3%B1.pdf',
    );
    expect(service({ ...bucket, BUCKET_URL_STYLE: 'path' }).objectUrl('x/y.pdf').toString()).toBe(
      'https://t3.storageapi.dev/mi-bucket-123/x/y.pdf',
    );
  });

  it('firma enlaces de descarga con expiración y nombre original como adjunto', async () => {
    const url = new URL(await service(bucket).presignedDownload('evidencias/1/a.pdf', 'Política v2.pdf', 300));
    expect(url.host).toBe('mi-bucket-123.t3.storageapi.dev');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('X-Amz-Credential')).toContain('/auto/s3/aws4_request');
    expect(url.searchParams.get('response-content-disposition')).toBe(
      'attachment; filename="Pol_tica v2.pdf"; filename*=UTF-8\'\'Pol%C3%ADtica%20v2.pdf',
    );
  });
});
