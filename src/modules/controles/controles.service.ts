import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../common/app-error.js';
import { CATEGORIAS } from '../../common/domain.js';
import { DatabaseService } from '../../database/database.service.js';
import type { CreateControlDto, UpdateControlDto } from './controles.dto.js';

export interface Control {
  id_control: number;
  codigo_iso: string;
  categoria: string;
  nombre: string;
  criterio: string;
  pregunta_orientadora: string;
  ejemplo_aplicacion: string | null;
  evidencia_sugerida: string | null;
}

const COLUMNAS =
  'id_control, codigo_iso, categoria, nombre, criterio, pregunta_orientadora, ejemplo_aplicacion, evidencia_sugerida';

/** Quita tildes y pasa a minúsculas para buscar "evaluacion" y encontrar "Evaluación". */
const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Catálogo normativo ISO/IEC 27002:2022 (RF02).
 * Los 93 controles casi nunca cambian: se cachean en memoria y se invalidan cuando el
 * admin edita uno o se restaura la semilla (PLAN §2.6, O6).
 */
@Injectable()
export class ControlesService {
  private cache: { controles: Control[]; indice: string[] } | null = null;

  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  invalidate(): void {
    this.cache = null;
  }

  private async load(): Promise<{ controles: Control[]; indice: string[] }> {
    if (!this.cache) {
      const controles = await this.db.query<Control>(
        `SELECT ${COLUMNAS} FROM control ORDER BY id_control`,
      );
      const indice = controles.map((c) =>
        normalize(`${c.codigo_iso} ${c.nombre} ${c.criterio} ${c.pregunta_orientadora}`),
      );
      this.cache = { controles, indice };
    }
    return this.cache;
  }

  async findAll(filtros: { categoria?: string; q?: string }): Promise<Control[]> {
    const { controles, indice } = await this.load();
    const categoria = filtros.categoria?.trim().toUpperCase();
    if (categoria && categoria !== 'TODOS' && !(CATEGORIAS as readonly string[]).includes(categoria)) {
      throw AppError.badRequest(
        'Categoría inválida (ORGANIZACIONAL, PERSONAS, FISICO o TECNOLOGICO).',
        'categoria',
      );
    }
    const q = normalize(filtros.q?.trim() ?? '');
    return controles.filter(
      (c, i) =>
        (!categoria || categoria === 'TODOS' || c.categoria === categoria) &&
        (!q || indice[i].includes(q)),
    );
  }

  async findOne(id: number): Promise<Control> {
    const { controles } = await this.load();
    const control = controles.find((c) => c.id_control === id);
    if (!control) throw AppError.notFound('Control no encontrado.');
    return control;
  }

  async create(dto: CreateControlDto): Promise<Control> {
    const existe = await this.db.one('SELECT 1 FROM control WHERE codigo_iso = $1', [dto.codigo_iso]);
    if (existe) {
      throw AppError.conflict(`Ya existe un control con el código ${dto.codigo_iso}.`, 'codigo_iso');
    }
    const control = await this.db.one<Control>(
      `INSERT INTO control (codigo_iso, categoria, nombre, criterio, pregunta_orientadora, ejemplo_aplicacion, evidencia_sugerida)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNAS}`,
      [
        dto.codigo_iso,
        dto.categoria,
        dto.nombre,
        dto.criterio,
        dto.pregunta_orientadora,
        dto.ejemplo_aplicacion ?? null,
        dto.evidencia_sugerida ?? null,
      ],
    );
    this.invalidate();
    return control as Control;
  }

  async update(id: number, dto: UpdateControlDto): Promise<Control> {
    if (dto.codigo_iso !== undefined || dto.categoria !== undefined) {
      throw AppError.badRequest(
        'El código ISO y la categoría no se pueden modificar: identifican el control de la norma.',
        dto.codigo_iso !== undefined ? 'codigo_iso' : 'categoria',
      );
    }
    const control = await this.db.one<Control>(
      `UPDATE control SET
         nombre               = COALESCE($2, nombre),
         criterio             = COALESCE($3, criterio),
         pregunta_orientadora = COALESCE($4, pregunta_orientadora),
         ejemplo_aplicacion   = CASE WHEN $5::BOOLEAN THEN $6 ELSE ejemplo_aplicacion END,
         evidencia_sugerida   = CASE WHEN $7::BOOLEAN THEN $8 ELSE evidencia_sugerida END
       WHERE id_control = $1
       RETURNING ${COLUMNAS}`,
      [
        id,
        dto.nombre ?? null,
        dto.criterio ?? null,
        dto.pregunta_orientadora ?? null,
        'ejemplo_aplicacion' in dto,
        dto.ejemplo_aplicacion ?? null,
        'evidencia_sugerida' in dto,
        dto.evidencia_sugerida ?? null,
      ],
    );
    if (!control) throw AppError.notFound('Control no encontrado.');
    this.invalidate();
    return control;
  }
}
