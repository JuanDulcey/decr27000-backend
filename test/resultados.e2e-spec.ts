import { INestApplication } from '@nestjs/common';
import { ADMIN, AUDITOR, createTestApp, loginAs, resetTestDatabase } from './helpers/app.js';
import { Api, api } from './helpers/api.js';

/** Indicadores, dashboard, informe y trazabilidad del caso Empresa ABC (CP-09, CP-10, CP-11). */
describe('Resultados de Empresa ABC (RF07, RF08, RF09, RNF05)', () => {
  let app: INestApplication;
  let a: Api;

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    a = api(app, await loginAs(app, AUDITOR));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/auditorias/1 trae indicadores y verificación de cierre', async () => {
    const res = await a.get('/api/auditorias/1').expect(200);
    expect(res.body.data).toMatchObject({
      id_auditoria: 1,
      estado: 'EN_REVISION',
      fecha_inicio: '2026-11-09',
      referentes: 'ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022',
      auditor_nombre: 'Ana R. (Auditora Líder)',
    });
    expect(res.body.data.verificacion_cierre).toMatchObject({ puede_revisar: true, puede_cerrar: true });
  });

  it('CP-09: 33,3 % de cumplimiento base y 54,2 % de índice ponderado', async () => {
    const res = await a.get('/api/auditorias/1/indicadores').expect(200);
    expect(res.body.data).toMatchObject({
      total_seleccionados: 13,
      total_evaluados: 13,
      pendientes: 0,
      aplicables: 12,
      implementados: 4,
      parciales: 5,
      no_implementados: 3,
      no_aplicables: 1,
      cumplimiento_base_pct: 33.3,
      indice_ponderado_pct: 54.2,
      total_hallazgos: 4,
      total_recomendaciones: 4,
      total_evidencias: 12,
      hallazgos_por_severidad: { ALTA: 2, MEDIA: 2, BAJA: 0 },
      formula_base: '(4 / 12) × 100 = 33,3 %',
      formula_ponderada: '((4 × 1.0 + 5 × 0.5) / 12) × 100 = 54,2 %',
    });
    expect(res.body.data.resumen_ejecutivo).toMatch(/no constituye certificación/);
  });

  it('CP-11: el dashboard muestra exactamente los mismos valores que los indicadores', async () => {
    const [dash, ind] = await Promise.all([
      a.get('/api/dashboard?id_auditoria=1').expect(200),
      a.get('/api/auditorias/1/indicadores').expect(200),
    ]);
    expect(dash.body.data.indicadores).toEqual(ind.body.data);
    expect(dash.body.data.auditoria_activa).toMatchObject({ id_auditoria: 1, auditor_nombre: 'Ana R. (Auditora Líder)' });
    expect(dash.body.data.hallazgos_por_severidad).toEqual({ ALTA: 2, MEDIA: 2, BAJA: 0 });
    expect(dash.body.data.auditorias_recientes[0]).toMatchObject({
      id_auditoria: 1,
      total_controles: 13,
      cumplimiento_base_pct: 33.3,
      indice_ponderado_pct: 54.2,
      total_hallazgos: 4,
    });
  });

  it('el dashboard sin parámetro usa la auditoría más reciente', async () => {
    const res = await a.get('/api/dashboard').expect(200);
    expect(res.body.data.auditoria_activa.id_auditoria).toBe(1);
    await a.get('/api/dashboard?id_auditoria=abc').expect(400);
  });

  it('CP-10: el informe tiene las 8 secciones construidas desde la BD', async () => {
    const res = await a.get('/api/auditorias/1/informes').expect(200);
    const inf = res.body.data;
    expect(inf.datos_auditoria).toMatchObject({ organizacion: 'Empresa ABC (Prestadora de Servicios Tecnológicos)' });
    expect(inf.alcance_criterios).toHaveLength(13);
    expect(inf.resultados_indicadores.cumplimiento_base_pct).toBe(33.3);
    expect(inf.evaluacion_por_control).toHaveLength(13);
    const na = inf.evaluacion_por_control.find((e: { codigo_iso: string }) => e.codigo_iso === '8.31');
    expect(na.justificacion_na).toMatch(/SaaS/);
    expect(inf.hallazgos.map((h: { codigo: string }) => h.codigo)).toEqual(['H-01', 'H-02', 'H-03', 'H-04']);
    expect(inf.hallazgos[0].recomendaciones).toHaveLength(1);
    expect(inf.recomendaciones).toHaveLength(4);
    expect(inf.recomendaciones[0]).toMatchObject({ hallazgo_codigo: 'H-01', codigo_iso: '8.8' });
    expect(inf.anexo_evidencias).toHaveLength(12);
    expect(inf.anexo_evidencias.every((ev: { es_simulada: boolean }) => ev.es_simulada)).toBe(true);
    expect(inf.limitaciones).toMatch(/No constituye una certificación en ISO\/IEC 27001:2022/);
    expect(inf.versiones).toHaveLength(1);
    expect(inf.versiones[0]).not.toHaveProperty('snapshot_json');
  });

  it('CP-10: genera la versión 2 con snapshot y se puede reabrir tal como se generó', async () => {
    const gen = await a.post('/api/auditorias/1/informes').expect(201);
    expect(gen.body.message).toMatch(/Versión v2/);
    expect(gen.body.data.version_actual).toBe(2);
    expect(gen.body.data.versiones.map((v: { version: number }) => v.version)).toEqual([2, 1]);

    const idInforme = gen.body.data.versiones[0].id_informe;
    const ver = await a.get(`/api/informes/${idInforme}`).expect(200);
    expect(ver.body.data).toMatchObject({ version: 2, cumplimiento_base: 33.3, indice_ponderado: 54.2 });
    expect(ver.body.data.snapshot_json.version_actual).toBe(2);
    expect(ver.body.data.snapshot_json.resultados_indicadores.cumplimiento_base_pct).toBe(33.3);
    await a.get('/api/informes/9999').expect(404);
  });

  it('RNF05: la trazabilidad recorre auditoría → control → evidencia → hallazgo → recomendación', async () => {
    const res = await a.get('/api/auditorias/1/trazabilidad').expect(200);
    const filas = res.body.data as Array<Record<string, unknown>>;
    const controles = new Set(filas.map((f) => f.codigo_iso));
    expect(controles.size).toBe(13);
    const h01 = filas.find((f) => f.hallazgo_codigo === 'H-01');
    expect(h01).toMatchObject({
      codigo_iso: '8.8',
      estado: 'NO_IMPLEMENTADO',
      codigo_evidencia: 'EV-09',
      hallazgo_severidad: 'ALTA',
      recomendacion_prioridad: 'ALTA',
      recomendacion_plazo_dias: 60,
    });
    const sinHallazgo = filas.find((f) => f.codigo_iso === '5.1');
    expect(sinHallazgo).toMatchObject({ codigo_evidencia: 'EV-01', hallazgo_codigo: null });
  });

  it('auditoría inexistente → 404 en todas las vistas', async () => {
    for (const url of ['/api/auditorias/999', '/api/auditorias/999/indicadores', '/api/auditorias/999/informes',
      '/api/auditorias/999/trazabilidad', '/api/auditorias/999/evaluaciones', '/api/auditorias/999/hallazgos']) {
      const res = await a.get(url);
      expect(res.status).toBe(404);
    }
  });

  it('el admin también puede consultar todo', async () => {
    const admin = api(app, await loginAs(app, ADMIN));
    await admin.get('/api/auditorias').expect(200);
  });
});
