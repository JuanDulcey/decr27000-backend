import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AppError } from '../../common/app-error.js';
import type { Rol } from '../../common/decorators.js';
import { DatabaseService } from '../../database/database.service.js';
import type { CreateUsuarioDto, UpdateUsuarioDto } from './usuarios.dto.js';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
  auditorias_asignadas?: number;
}

export interface UsuarioConHash extends Usuario {
  password_hash: string;
}

/** Nunca devuelve password_hash fuera de este servicio, salvo para el login. */
@Injectable()
export class UsuariosService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  findAll(): Promise<Usuario[]> {
    return this.db.query<Usuario>(
      `SELECT u.id_usuario, u.nombre, u.correo, u.rol,
              COUNT(a.id_auditoria)::int AS auditorias_asignadas
       FROM usuario u
       LEFT JOIN auditoria a ON a.id_auditor = u.id_usuario
       GROUP BY u.id_usuario
       ORDER BY u.id_usuario`,
    );
  }

  findById(id: number): Promise<Usuario | null> {
    return this.db.one<Usuario>(
      'SELECT id_usuario, nombre, correo, rol FROM usuario WHERE id_usuario = $1',
      [id],
    );
  }

  findByCorreoWithHash(correo: string): Promise<UsuarioConHash | null> {
    return this.db.one<UsuarioConHash>(
      'SELECT id_usuario, nombre, correo, rol, password_hash FROM usuario WHERE LOWER(correo) = LOWER($1)',
      [correo],
    );
  }

  async create(dto: CreateUsuarioDto): Promise<Usuario> {
    const existing = await this.db.one<{ id_usuario: number }>(
      'SELECT id_usuario FROM usuario WHERE LOWER(correo) = LOWER($1)',
      [dto.correo],
    );
    if (existing) {
      throw AppError.conflict(`Ya existe un usuario registrado con el correo "${dto.correo}".`, 'correo');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.db.one<Usuario>(
      `INSERT INTO usuario (nombre, correo, password_hash, rol)
       VALUES ($1, $2, $3, $4)
       RETURNING id_usuario, nombre, correo, rol`,
      [dto.nombre, dto.correo, passwordHash, dto.rol],
    );
    if (!created) throw AppError.badRequest('No se pudo crear el usuario.');
    return { ...created, auditorias_asignadas: 0 };
  }

  async update(id: number, dto: UpdateUsuarioDto, currentUserId: number): Promise<Usuario> {
    const target = await this.findById(id);
    if (!target) {
      throw AppError.notFound(`El usuario #${id} no existe.`);
    }

    if (id === currentUserId && target.rol === 'admin' && dto.rol !== 'admin') {
      throw AppError.badRequest('No puede retirar su propio rol de Administrador.', 'rol');
    }

    const duplicate = await this.db.one<{ id_usuario: number }>(
      'SELECT id_usuario FROM usuario WHERE LOWER(correo) = LOWER($1) AND id_usuario <> $2',
      [dto.correo, id],
    );
    if (duplicate) {
      throw AppError.conflict(`Ya existe otro usuario con el correo "${dto.correo}".`, 'correo');
    }

    const updated = await this.db.one<Usuario>(
      `UPDATE usuario
       SET nombre = $1, correo = $2, rol = $3
       WHERE id_usuario = $4
       RETURNING id_usuario, nombre, correo, rol`,
      [dto.nombre, dto.correo, dto.rol, id],
    );
    if (!updated) throw AppError.notFound(`El usuario #${id} no existe.`);
    return updated;
  }

  async resetPassword(id: number, password: string): Promise<{ id_usuario: number; nombre: string; correo: string }> {
    const target = await this.findById(id);
    if (!target) {
      throw AppError.notFound(`El usuario #${id} no existe.`);
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.db.query('UPDATE usuario SET password_hash = $1 WHERE id_usuario = $2', [passwordHash, id]);
    return { id_usuario: target.id_usuario, nombre: target.nombre, correo: target.correo };
  }

  async remove(id: number, currentUserId: number): Promise<Usuario> {
    if (id === currentUserId) {
      throw AppError.badRequest('No puede eliminar su propio usuario administrador mientras está autenticado.');
    }

    const target = await this.findById(id);
    if (!target) {
      throw AppError.notFound(`El usuario #${id} no existe.`);
    }

    const auditsRow = await this.db.one<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM auditoria WHERE id_auditor = $1',
      [id],
    );
    if ((auditsRow?.total ?? 0) > 0) {
      throw AppError.conflict(
        `No se puede eliminar a "${target.nombre}" porque tiene ${auditsRow?.total} auditoría(s) asignada(s). Reasigne sus auditorías primero.`,
      );
    }

    await this.db.query('DELETE FROM usuario WHERE id_usuario = $1', [id]);
    return target;
  }
}
