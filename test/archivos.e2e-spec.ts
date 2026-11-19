import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/**
 * Archivos de evidencia contra un S3 FALSO local (path-style): sube, reemplaza, descarga con
 * URL prefirmada, quita y borra. Nunca toca el bucket real de Railway.
 * Las variables del bucket se fijan antes de importar la app (cada archivo de pruebas de
 * Vitest tiene su propio grafo de módulos).
 */
const objetos = new Map<string, { body: Buffer; tipo: string }>();
let s3: Server;

const PDF = Buffer.from('%PDF-1.4\n% evidencia simulada\n%%EOF\n');

describe('Archivos de evidencias en el bucket S3 (RF04, PLAN P8)', () => {
  let app: INestApplication;
  let http: ReturnType<INestApplication['getHttpServer']>;
  let token: string;
  const auth = () => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    s3 = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const key = decodeURIComponent(url.pathname.replace(/^\/bucket-prueba\/?/, ''));
        if (req.method === 'PUT') {
          objetos.set(key, { body: Buffer.concat(chunks), tipo: String(req.headers['content-type']) });
          res.writeHead(200).end();
        } else if (req.method === 'DELETE') {
          objetos.delete(key);
          res.writeHead(204).end();
        } else if (req.method === 'HEAD') {
          res.writeHead(key ? (objetos.has(key) ? 200 : 404) : 200).end();
        } else if (req.method === 'GET') {
          const obj = objetos.get(key);
          if (!obj) return res.writeHead(404).end();
          res.writeHead(200, { 'Content-Type': obj.tipo }).end(obj.body);
        } else {
          res.writeHead(405).end();
        }
      });
    });
    await new Promise<void>((resolve) => s3.listen(0, '127.0.0.1', resolve));
    const { port } = s3.address() as AddressInfo;

    process.env.ENPOINT_URL = `http://127.0.0.1:${port}`;
    process.env.BUCKET_NAME = 'bucket-prueba';
    process.env.ACCESS_KEY_BUCKET = 'AKIDTEST';
    process.env.SECRET_KEY_BUCKET = 'secret-test';
    process.env.BUCKET_URL_STYLE = 'path';
    process.env.EVIDENCIA_MAX_MB = '1';

    const { AUDITOR, createTestApp, loginAs, resetTestDatabase } = await import('./helpers/app.js');
    await resetTestDatabase();
    app = await createTestApp();
    http = app.getHttpServer();
    token = await loginAs(app, AUDITOR);
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((resolve) => s3?.close(resolve));
  });

  it('health ?db=1 informa el bucket como UP', async () => {
    const res = await request(http).get('/api/health?db=1').expect(200);
    expect(res.body).toMatchObject({ db: 'UP', storage: 'UP' });
  });

  it('adjunta un PDF a la evidencia EV-01 con el tipo asignado por el servidor', async () => {
    const res = await request(http)
      .post('/api/evidencias/1/archivo')
      .set(auth())
      .attach('archivo', PDF, { filename: 'Política de seguridad v2.pdf', contentType: 'text/html' })
      .expect(201);
    expect(res.body.data).toMatchObject({
      codigo_evidencia: 'EV-01',
      tiene_archivo: true,
      archivo_nombre: 'Política de seguridad v2.pdf',
      archivo_tipo: 'application/pdf',
      archivo_tamano: PDF.length,
    });
    expect(res.body.data).not.toHaveProperty('archivo_key');
    expect(objetos.size).toBe(1);
    const [[key, obj]] = [...objetos.entries()];
    expect(key).toMatch(/^evidencias\/auditoria-1\/evidencia-1\/[0-9a-f-]{36}\.pdf$/);
    expect(obj).toMatchObject({ tipo: 'application/pdf' });
    expect(obj.body.equals(PDF)).toBe(true);
  });

  it('la evidencia muestra el archivo en la evaluación, el informe y la trazabilidad', async () => {
    const ev = await request(http).get('/api/auditorias/1/evaluaciones').set(auth()).expect(200);
    const e51 = ev.body.data.find((e: { codigo_iso: string }) => e.codigo_iso === '5.1');
    expect(e51.evidencias[0]).toMatchObject({ tiene_archivo: true, archivo_nombre: 'Política de seguridad v2.pdf' });
    const inf = await request(http).get('/api/auditorias/1/informes').set(auth()).expect(200);
    expect(inf.body.data.anexo_evidencias[0]).toMatchObject({ codigo_evidencia: 'EV-01', tiene_archivo: true });
    const tr = await request(http).get('/api/auditorias/1/trazabilidad').set(auth()).expect(200);
    expect(tr.body.data.find((f: { codigo_evidencia: string }) => f.codigo_evidencia === 'EV-01')).toMatchObject({
      evidencia_tiene_archivo: true,
    });
  });

  it('entrega un enlace prefirmado que descarga el archivo original', async () => {
    const res = await request(http).get('/api/evidencias/1/archivo').set(auth()).expect(200);
    expect(res.body.data).toMatchObject({ expira_en_segundos: 300, archivo_tipo: 'application/pdf' });
    const url = new URL(res.body.data.url);
    expect(url.searchParams.get('X-Amz-Signature')).toBeTruthy();
    expect(url.searchParams.get('response-content-disposition')).toContain('attachment');
    const descarga = await fetch(url);
    expect(Buffer.from(await descarga.arrayBuffer()).equals(PDF)).toBe(true);
  });

  it('reemplazar el archivo borra el anterior del bucket', async () => {
    const antes = [...objetos.keys()];
    await request(http)
      .post('/api/evidencias/1/archivo')
      .set(auth())
      .attach('archivo', Buffer.from('a,b\n1,2\n'), 'matriz.csv')
      .expect(201);
    const despues = [...objetos.keys()];
    expect(despues).toHaveLength(1);
    expect(despues[0]).not.toBe(antes[0]);
    expect(objetos.get(despues[0])?.tipo).toBe('text/csv; charset=utf-8');
  });

  it('rechaza tipos no permitidos, archivos vacíos o ausentes, el campo equivocado y el tamaño máximo', async () => {
    const html = await request(http).post('/api/evidencias/2/archivo').set(auth())
      .attach('archivo', Buffer.from('<script>alert(1)</script>'), 'x.html').expect(400);
    expect(html.body).toMatchObject({ field: 'archivo' });
    expect(html.body.error).toMatch(/Tipo de archivo no permitido \(\.html\)/);

    const sinArchivo = await request(http).post('/api/evidencias/2/archivo').set(auth()).field('otro', 'x').expect(400);
    expect(sinArchivo.body.field).toBe('archivo');

    const campo = await request(http).post('/api/evidencias/2/archivo').set(auth())
      .attach('documento', PDF, 'a.pdf').expect(400);
    expect(campo.body.error).toMatch(/campo "archivo"/);

    const grande = await request(http).post('/api/evidencias/2/archivo').set(auth())
      .attach('archivo', Buffer.alloc(1024 * 1024 + 10, 1), 'grande.pdf').expect(413);
    expect(grande.body.error).toBe('El archivo supera el tamaño máximo permitido.');

    await request(http).post('/api/evidencias/9999/archivo').set(auth()).attach('archivo', PDF, 'a.pdf').expect(404);
    expect(objetos.size).toBe(1);
  });

  it('quitar el archivo conserva la evidencia y borra el objeto', async () => {
    const res = await request(http).delete('/api/evidencias/1/archivo').set(auth()).expect(200);
    expect(res.body.data).toMatchObject({ codigo_evidencia: 'EV-01', tiene_archivo: false, archivo_nombre: null });
    expect(objetos.size).toBe(0);
    await request(http).get('/api/evidencias/1/archivo').set(auth()).expect(404);
    await request(http).delete('/api/evidencias/1/archivo').set(auth()).expect(404);
  });

  it('borrar una evidencia con archivo también borra el objeto del bucket', async () => {
    // EV-12 (8.23) es la única evidencia de un control PARCIAL: en EN_REVISION no se puede borrar,
    // así que se crea una evidencia adicional en 8.23 con archivo y se borra esa.
    const nueva = await request(http).post('/api/evaluaciones/12/evidencias').set(auth())
      .send({ descripcion: 'Captura adicional del proxy', fuente: 'Firewall' }).expect(201);
    const id = nueva.body.data.id_evidencia;
    await request(http).post(`/api/evidencias/${id}/archivo`).set(auth()).attach('archivo', PDF, 'proxy.pdf').expect(201);
    expect(objetos.size).toBe(1);
    await request(http).delete(`/api/evidencias/${id}`).set(auth()).expect(200);
    expect(objetos.size).toBe(0);
  });

  it('auditoría CERRADA: no se adjuntan ni quitan archivos (403), pero sí se descargan', async () => {
    await request(http).post('/api/evidencias/2/archivo').set(auth()).attach('archivo', PDF, 'roles.pdf').expect(201);
    await request(http).patch('/api/auditorias/1/estado').set(auth()).send({ estado: 'CERRADA' }).expect(200);
    const cerrada = await request(http).post('/api/evidencias/3/archivo').set(auth())
      .attach('archivo', PDF, 'acta.pdf').expect(403);
    expect(cerrada.body.error).toMatch(/CERRADA/);
    await request(http).delete('/api/evidencias/2/archivo').set(auth()).expect(403);
    await request(http).get('/api/evidencias/2/archivo').set(auth()).expect(200);
    expect(objetos.size).toBe(1);
  });
});
