import { INestApplication } from '@nestjs/common';
import { AUDITOR, createTestApp, loginAs, resetTestDatabase } from './helpers/app.js';
import { Api, api, CONTROLES_ABC, ESTADOS_ABC, NUEVA_AUDITORIA } from './helpers/api.js';

interface Evaluacion {
  id_evaluacion: number;
  codigo_iso: string;
  estado: string;
}

/**
 * Flujo completo de una auditoría nueva: BORRADOR → EN_EJECUCION → EN_REVISION → CERRADA,
 * recorriendo los casos de prueba CP-01 a CP-08 y CP-13 (BACKEND_SPEC §8.4).
 */
describe('Flujo completo de auditoría (CP-01 a CP-08 y CP-13)', () => {
  let app: INestApplication;
  let a: Api;
  let id: number;
  const evals = new Map<string, number>(); // codigo_iso → id_evaluacion
  const hallazgos: Record<string, number> = {};

  beforeAll(async () => {
    await resetTestDatabase();
    app = await createTestApp();
    a = api(app, await loginAs(app, AUDITOR));
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('RF01: crear auditoría', () => {
    it('CP-02: sin fecha de cierre → 400 en el campo fecha_fin', async () => {
      const { fecha_fin: _omitida, ...sinFecha } = NUEVA_AUDITORIA;
      const res = await a.post('/api/auditorias', sinFecha).expect(400);
      expect(res.body).toMatchObject({ ok: false, field: 'fecha_fin' });
    });

    it('CP-02: fecha de cierre anterior a la de inicio → 400', async () => {
      const res = await a.post('/api/auditorias', { ...NUEVA_AUDITORIA, fecha_fin: '2026-11-01' }).expect(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'La fecha de cierre debe ser igual o posterior a la fecha de inicio.',
        field: 'fecha_fin',
      });
    });

    it('auditor inexistente → 400 en id_auditor', async () => {
      const res = await a.post('/api/auditorias', { ...NUEVA_AUDITORIA, id_auditor: 99 }).expect(400);
      expect(res.body.field).toBe('id_auditor');
    });

    it('CP-01: datos completos → 201 en BORRADOR con los referentes vigentes', async () => {
      const res = await a.post('/api/auditorias', { ...NUEVA_AUDITORIA, id_auditor: '1' }).expect(201);
      expect(res.body.message).toBe('Auditoría creada en estado BORRADOR.');
      expect(res.body.data).toMatchObject({
        organizacion: 'Empresa XYZ S.A.S.',
        estado: 'BORRADOR',
        fecha_inicio: '2026-11-10',
        fecha_fin: '2026-11-24',
        referentes: 'ISO 19011:2026; ISO/IEC 27001:2022; ISO/IEC 27002:2022',
        auditor_nombre: 'Ana R. (Auditora Líder)',
      });
      id = res.body.data.id_auditoria;
      const lista = await a.get('/api/auditorias').expect(200);
      expect(lista.body.data.map((x: { id_auditoria: number }) => x.id_auditoria)).toContain(id);
    });

    it('no se puede pasar de BORRADOR a CERRADA directamente', async () => {
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'CERRADA' }).expect(400);
      expect(res.body.error).toMatch(/Transición no permitida/);
    });

    it('sin controles no se puede pasar a EN_EJECUCION (RN02)', async () => {
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'EN_EJECUCION' }).expect(400);
      expect(res.body.error).toMatch(/entre 10 y 15 controles/);
    });
  });

  describe('RF02 / CP-03: selección de 10 a 15 controles', () => {
    it('9 controles → 400', async () => {
      const res = await a
        .put(`/api/auditorias/${id}/seleccion-controles`, { controles_ids: CONTROLES_ABC.slice(0, 9) })
        .expect(400);
      expect(res.body.error).toMatch(/actualmente seleccionó 9/);
    });

    it('16 controles → 400', async () => {
      const ids = [...CONTROLES_ABC, 2, 3, 4];
      const res = await a.put(`/api/auditorias/${id}/seleccion-controles`, { controles_ids: ids }).expect(400);
      expect(res.body.error).toMatch(/actualmente seleccionó 16/);
    });

    it('control inexistente → 400', async () => {
      const ids = [...CONTROLES_ABC.slice(0, 12), 999];
      const res = await a.put(`/api/auditorias/${id}/seleccion-controles`, { controles_ids: ids }).expect(400);
      expect(res.body.error).toMatch(/999/);
    });

    it('13 controles → 200 y la auditoría pasa a EN_EJECUCION', async () => {
      const res = await a
        .put(`/api/auditorias/${id}/seleccion-controles`, { controles_ids: CONTROLES_ABC })
        .expect(200);
      expect(res.body.data).toMatchObject({ controles_seleccionados: 13, agregados: 13, retirados: 0, estado: 'EN_EJECUCION' });
    });

    it('lista las 13 evaluaciones en PENDIENTE, en orden numérico de código ISO', async () => {
      const res = await a.get(`/api/auditorias/${id}/evaluaciones`).expect(200);
      const codigos = res.body.data.map((e: Evaluacion) => e.codigo_iso);
      expect(codigos).toEqual(['5.1', '5.15', '5.18', '5.24', '6.3', '7.2', '8.5', '8.7', '8.8', '8.13', '8.15', '8.23', '8.31']);
      for (const e of res.body.data as Evaluacion[]) {
        expect(e.estado).toBe('PENDIENTE');
        evals.set(e.codigo_iso, e.id_evaluacion);
      }
    });

    it('con controles pendientes no se puede pasar a EN_REVISION', async () => {
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'EN_REVISION' }).expect(400);
      expect(res.body.error).toMatch(/pendientes de evaluar/);
      expect(res.body.details.pendientes).toHaveLength(13);
    });
  });

  describe('RF03: evaluación de controles', () => {
    it('CP-04: estado PARCIAL sin observación → 400 en observacion', async () => {
      const res = await a.put(`/api/evaluaciones/${evals.get('5.18')}`, { estado: 'PARCIAL', observacion: '  ' }).expect(400);
      expect(res.body).toEqual({
        ok: false,
        error: 'La observación del auditor es obligatoria para guardar la evaluación.',
        field: 'observacion',
      });
    });

    it('CP-05: No aplicable sin justificación → 400 en justificacion_na', async () => {
      const res = await a
        .put(`/api/evaluaciones/${evals.get('8.31')}`, { estado: 'NO_APLICABLE', observacion: 'Fuera de alcance.', justificacion_na: '' })
        .expect(400);
      expect(res.body.field).toBe('justificacion_na');
    });

    it('estado inválido → 400', async () => {
      await a.put(`/api/evaluaciones/${evals.get('5.1')}`, { estado: 'PENDIENTE', observacion: 'x' }).expect(400);
    });

    it('evalúa los 13 controles como en el caso Empresa ABC', async () => {
      for (const [codigo, estado] of Object.entries(ESTADOS_ABC)) {
        const body: Record<string, string> = { estado, observacion: `Observación del control ${codigo}.` };
        if (estado === 'NO_APLICABLE') body.justificacion_na = 'La empresa no desarrolla software propio.';
        const res = await a.put(`/api/evaluaciones/${evals.get(codigo)}`, body).expect(200);
        expect(res.body.data.estado).toBe(estado);
      }
    });

    it('al cambiar de No aplicable a otro estado se limpia la justificación', async () => {
      const id831 = evals.get('8.31');
      const res = await a.put(`/api/evaluaciones/${id831}`, { estado: 'NO_IMPLEMENTADO', observacion: 'Cambio.', justificacion_na: 'x' }).expect(200);
      expect(res.body.data.justificacion_na).toBeNull();
      await a
        .put(`/api/evaluaciones/${id831}`, { estado: 'NO_APLICABLE', observacion: 'Fuera de alcance.', justificacion_na: 'SaaS, sin desarrollo propio.' })
        .expect(200);
    });

    it('CP-09 con datos nuevos: 33,3 % base y 54,2 % ponderado', async () => {
      const res = await a.get(`/api/auditorias/${id}/indicadores`).expect(200);
      expect(res.body.data).toMatchObject({
        aplicables: 12,
        implementados: 4,
        parciales: 5,
        no_implementados: 3,
        no_aplicables: 1,
        cumplimiento_base_pct: 33.3,
        indice_ponderado_pct: 54.2,
        formula_base: '(4 / 12) × 100 = 33,3 %',
      });
    });
  });

  describe('RF04 / CP-06: evidencias', () => {
    it('Implementado o Parcial sin evidencia impide pasar a EN_REVISION', async () => {
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'EN_REVISION' }).expect(400);
      expect(res.body.error).toMatch(/RN04 \/ CP-06/);
      expect(res.body.details.sin_evidencia).toEqual(['5.1', '5.15', '5.18', '6.3', '7.2', '8.5', '8.7', '8.13', '8.23']);
    });

    it('marca requiere_evidencia_faltante en los controles afectados', async () => {
      const res = await a.get(`/api/auditorias/${id}/evaluaciones`).expect(200);
      const e51 = res.body.data.find((e: Evaluacion) => e.codigo_iso === '5.1');
      expect(e51.requiere_evidencia_faltante).toBe(true);
    });

    it('sin descripción → 400', async () => {
      const res = await a.post(`/api/evaluaciones/${evals.get('5.1')}/evidencias`, { fuente: 'TI' }).expect(400);
      expect(res.body.field).toBe('descripcion');
    });

    it('registra evidencias con códigos EV-nn consecutivos y marca simulada por defecto', async () => {
      const conEvidencia = Object.entries(ESTADOS_ABC).filter(([, e]) => e === 'IMPLEMENTADO' || e === 'PARCIAL');
      let n = 0;
      for (const [codigo] of conEvidencia) {
        n += 1;
        const res = await a
          .post(`/api/evaluaciones/${evals.get(codigo)}/evidencias`, {
            descripcion: `Evidencia del control ${codigo}`,
            fuente: 'Repositorio documental',
            fecha_evidencia: '2026-11-12',
            referencia_url: '',
          })
          .expect(201);
        expect(res.body.data).toMatchObject({
          codigo_evidencia: `EV-${String(n).padStart(2, '0')}`,
          es_simulada: true,
          fecha_evidencia: '2026-11-12',
          referencia_url: null,
        });
      }
    });

    it('código de evidencia repetido en la auditoría → 409', async () => {
      const res = await a
        .post(`/api/evaluaciones/${evals.get('5.1')}/evidencias`, { codigo_evidencia: 'ev-01', descripcion: 'X', fuente: 'Y' })
        .expect(409);
      expect(res.body.field).toBe('codigo_evidencia');
    });

    it('al borrar una evidencia, el siguiente código no reutiliza números (máximo + 1)', async () => {
      const extra = await a.post(`/api/evaluaciones/${evals.get('5.1')}/evidencias`, { descripcion: 'Extra', fuente: 'TI' }).expect(201);
      expect(extra.body.data.codigo_evidencia).toBe('EV-10');
      const otra = await a.post(`/api/evaluaciones/${evals.get('5.1')}/evidencias`, { descripcion: 'Otra', fuente: 'TI' }).expect(201);
      await a.delete(`/api/evidencias/${extra.body.data.id_evidencia}`).expect(200);
      const nueva = await a.post(`/api/evaluaciones/${evals.get('5.1')}/evidencias`, { descripcion: 'Nueva', fuente: 'TI' }).expect(201);
      expect(otra.body.data.codigo_evidencia).toBe('EV-11');
      expect(nueva.body.data.codigo_evidencia).toBe('EV-12');
    });
  });

  describe('RF05 / RF06: hallazgos y recomendaciones', () => {
    it('no se registran hallazgos sobre un control No aplicable', async () => {
      const res = await a
        .post(`/api/evaluaciones/${evals.get('8.31')}/hallazgos`, {
          condicion: 'X', criterio: 'X', causa: 'X', efecto_riesgo: 'X', severidad: 'BAJA',
        })
        .expect(400);
      expect(res.body.error).toMatch(/No aplicable/);
    });

    it('CP-07: hallazgo sin causa → 400 en causa', async () => {
      const res = await a
        .post(`/api/evaluaciones/${evals.get('8.8')}/hallazgos`, {
          condicion: 'Sin escaneos.', criterio: 'ISO/IEC 27002:2022, 8.8', causa: '', efecto_riesgo: 'Explotación.', severidad: 'ALTA',
        })
        .expect(400);
      expect(res.body).toMatchObject({ field: 'causa', error: 'La causa raíz del hallazgo es obligatoria (CP-07).' });
    });

    it('CP-07: hallazgo completo con recomendación inicial → H-01 (misma transacción)', async () => {
      const res = await a
        .post(`/api/evaluaciones/${evals.get('8.8')}/hallazgos`, {
          condicion: 'No se evidencian escaneos de vulnerabilidades.',
          criterio: 'ISO/IEC 27002:2022, control 8.8.',
          causa: 'No hay responsable asignado.',
          efecto_riesgo: 'Explotación de vulnerabilidades conocidas.',
          severidad: 'alta',
          recomendacion: { descripcion: 'Escaneos mensuales.', prioridad: 'ALTA', plazo_dias: '60', responsable_sug: '' },
        })
        .expect(201);
      expect(res.body.message).toBe('Hallazgo H-01 registrado exitosamente.');
      expect(res.body.data).toMatchObject({ codigo: 'H-01', severidad: 'ALTA' });
      expect(res.body.data.recomendaciones[0]).toMatchObject({
        prioridad: 'ALTA',
        plazo_dias: 60,
        responsable_sug: 'Líder de TI / Seguridad de la Información',
      });
      hallazgos.h1 = res.body.data.id_hallazgo;
    });

    it('recomendación inválida dentro del hallazgo → 400 sin crear nada', async () => {
      const res = await a
        .post(`/api/evaluaciones/${evals.get('5.24')}/hallazgos`, {
          condicion: 'X', criterio: 'X', causa: 'X', efecto_riesgo: 'X', severidad: 'MEDIA',
          recomendacion: { descripcion: 'X', plazo_dias: 0 },
        })
        .expect(400);
      expect(res.body.field).toBe('recomendacion.plazo_dias');
      const lista = await a.get(`/api/auditorias/${id}/hallazgos`).expect(200);
      expect(lista.body.data).toHaveLength(1);
    });

    it('la auditoría pasa a EN_REVISION cuando no hay pendientes ni controles sin evidencia', async () => {
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'EN_REVISION' }).expect(200);
      expect(res.body.data.estado).toBe('EN_REVISION');
      expect(res.body.message).toBe('Estado de la auditoría actualizado a EN REVISIÓN.');
    });

    it('EN_REVISION no permite cambiar la selección de controles', async () => {
      await a.put(`/api/auditorias/${id}/seleccion-controles`, { controles_ids: CONTROLES_ABC }).expect(409);
    });

    it('CP-08: con menos de 3 hallazgos no se puede cerrar', async () => {
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'CERRADA' }).expect(400);
      expect(res.body.error).toMatch(/al menos 3 hallazgos documentados \(actualmente hay 1\)/);
    });

    it('CP-08: un hallazgo sin recomendación impide el cierre', async () => {
      const base = { criterio: 'ISO/IEC 27002:2022.', causa: 'Causa.', efecto_riesgo: 'Riesgo.' };
      const h2 = await a.post(`/api/evaluaciones/${evals.get('5.24')}/hallazgos`, { ...base, condicion: 'Sin procedimiento de incidentes.', severidad: 'ALTA', recomendacion: { descripcion: 'Formalizar.' } }).expect(201);
      const h3 = await a.post(`/api/evaluaciones/${evals.get('8.13')}/hallazgos`, { ...base, condicion: 'Sin pruebas de restauración.', severidad: 'MEDIA' }).expect(201);
      expect([h2.body.data.codigo, h3.body.data.codigo]).toEqual(['H-02', 'H-03']);
      hallazgos.h2 = h2.body.data.id_hallazgo;
      hallazgos.h3 = h3.body.data.id_hallazgo;
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'CERRADA' }).expect(400);
      expect(res.body.details.hallazgos_sin_recomendacion).toEqual(['H-03']);
    });

    it('al borrar un hallazgo, el siguiente código es máximo + 1 (no reutiliza H-02)', async () => {
      await a.delete(`/api/hallazgos/${hallazgos.h2}`).expect(200);
      const h4 = await a.post(`/api/evaluaciones/${evals.get('8.15')}/hallazgos`, {
        condicion: 'Registros sin centralizar.', criterio: 'ISO/IEC 27002:2022, 8.15.', causa: 'Sin SIEM.', efecto_riesgo: 'No se detectan incidentes.', severidad: 'MEDIA',
        recomendacion: { descripcion: 'Centralizar registros.', prioridad: 'MEDIA', plazo_dias: 120 },
      }).expect(201);
      expect(h4.body.data.codigo).toBe('H-04');
      hallazgos.h4 = h4.body.data.id_hallazgo;
    });

    it('edita un hallazgo y agrega la recomendación que faltaba', async () => {
      const upd = await a.put(`/api/hallazgos/${hallazgos.h3}`, { severidad: 'BAJA', causa: 'Sin responsable de pruebas.' }).expect(200);
      expect(upd.body.data).toMatchObject({ severidad: 'BAJA', causa: 'Sin responsable de pruebas.', codigo: 'H-03' });
      const rec = await a.post(`/api/hallazgos/${hallazgos.h3}/recomendaciones`, { descripcion: 'Pruebas trimestrales.', prioridad: 'MEDIA', plazo_dias: 90 }).expect(201);
      hallazgos.r3 = rec.body.data.id_recomendacion;
      const edit = await a.put(`/api/recomendaciones/${hallazgos.r3}`, { plazo_dias: 45 }).expect(200);
      expect(edit.body.data.plazo_dias).toBe(45);
    });

    it('EN_REVISION no permite borrar la única recomendación de un hallazgo', async () => {
      const res = await a.delete(`/api/recomendaciones/${hallazgos.r3}`).expect(409);
      expect(res.body.error).toMatch(/H-03/);
    });

    it('EN_REVISION no permite borrar la única evidencia de un control Implementado/Parcial', async () => {
      const lista = await a.get(`/api/auditorias/${id}/evaluaciones`).expect(200);
      const e523 = lista.body.data.find((e: Evaluacion) => e.codigo_iso === '8.23');
      await a.delete(`/api/evidencias/${e523.evidencias[0].id_evidencia}`).expect(409);
    });

    it('la verificación de cierre ya permite cerrar', async () => {
      const res = await a.get(`/api/auditorias/${id}/verificacion-cierre`).expect(200);
      expect(res.body.data).toMatchObject({ total_hallazgos: 3, hallazgos_sin_recomendacion: [], puede_revisar: true, puede_cerrar: true });
    });

    it('la auditoría se cierra (CERRADA)', async () => {
      const res = await a.patch(`/api/auditorias/${id}/estado`, { estado: 'CERRADA' }).expect(200);
      expect(res.body.data.estado).toBe('CERRADA');
    });
  });

  describe('CP-13: una auditoría CERRADA es inmutable', () => {
    const MSG = 'Operación denegada: la auditoría se encuentra CERRADA y su registro es inmutable.';

    it('rechaza toda modificación con 403', async () => {
      const intentos = [
        a.put(`/api/auditorias/${id}`, NUEVA_AUDITORIA),
        a.patch(`/api/auditorias/${id}/estado`, { estado: 'EN_EJECUCION' }),
        a.put(`/api/auditorias/${id}/seleccion-controles`, { controles_ids: CONTROLES_ABC }),
        a.put(`/api/evaluaciones/${evals.get('5.1')}`, { estado: 'PARCIAL', observacion: 'x' }),
        a.post(`/api/evaluaciones/${evals.get('5.1')}/evidencias`, { descripcion: 'x', fuente: 'y' }),
        a.post(`/api/evaluaciones/${evals.get('5.24')}/hallazgos`, { condicion: 'x', criterio: 'x', causa: 'x', efecto_riesgo: 'x', severidad: 'BAJA' }),
        a.put(`/api/hallazgos/${hallazgos.h1}`, { causa: 'x' }),
        a.delete(`/api/hallazgos/${hallazgos.h1}`),
        a.post(`/api/hallazgos/${hallazgos.h1}/recomendaciones`, { descripcion: 'x' }),
        a.put(`/api/recomendaciones/${hallazgos.r3}`, { plazo_dias: 10 }),
        a.delete(`/api/recomendaciones/${hallazgos.r3}`),
      ];
      for (const intento of intentos) {
        const res = await intento;
        expect(res.status).toBe(403);
        expect(res.body.error).toBe(MSG);
      }
    });

    it('sí permite consultar y generar el informe final (instantánea)', async () => {
      await a.get(`/api/auditorias/${id}`).expect(200);
      const res = await a.post(`/api/auditorias/${id}/informes`).expect(201);
      expect(res.body.data.version_actual).toBe(1);
      expect(res.body.data.datos_auditoria.estado).toBe('CERRADA');
    });
  });
});
