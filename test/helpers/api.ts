import { INestApplication } from '@nestjs/common';
import request from 'supertest';

/** Cliente autenticado para las pruebas: api(app, token).get('/api/...'). */
export function api(app: INestApplication, token: string) {
  const http = app.getHttpServer();
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);
  return {
    get: (url: string) => auth(request(http).get(url)),
    post: (url: string, body: object = {}) => auth(request(http).post(url).send(body)),
    put: (url: string, body: object = {}) => auth(request(http).put(url).send(body)),
    patch: (url: string, body: object = {}) => auth(request(http).patch(url).send(body)),
    delete: (url: string) => auth(request(http).delete(url)),
  };
}

export type Api = ReturnType<typeof api>;

/** Los 13 controles de Empresa ABC (ids del catálogo). */
export const CONTROLES_ABC = [1, 15, 18, 24, 40, 47, 64, 66, 67, 72, 74, 82, 90];

/** Estados del caso Empresa ABC por código ISO: 4 impl., 5 parciales, 3 no impl., 1 N/A. */
export const ESTADOS_ABC: Record<string, string> = {
  '5.1': 'IMPLEMENTADO',
  '5.15': 'IMPLEMENTADO',
  '7.2': 'IMPLEMENTADO',
  '8.7': 'IMPLEMENTADO',
  '5.18': 'PARCIAL',
  '6.3': 'PARCIAL',
  '8.5': 'PARCIAL',
  '8.13': 'PARCIAL',
  '8.23': 'PARCIAL',
  '5.24': 'NO_IMPLEMENTADO',
  '8.8': 'NO_IMPLEMENTADO',
  '8.15': 'NO_IMPLEMENTADO',
  '8.31': 'NO_APLICABLE',
};

export const NUEVA_AUDITORIA = {
  organizacion: 'Empresa XYZ S.A.S.',
  objetivo: 'Evaluar controles críticos de seguridad de la información.',
  alcance: 'Infraestructura cloud, redes y aplicaciones centrales.',
  fecha_inicio: '2026-11-10',
  fecha_fin: '2026-11-24',
  id_auditor: 1,
};
