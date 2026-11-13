import { Inject, Injectable } from '@nestjs/common';
import type { Rol } from '../../common/decorators.js';
import { DatabaseService } from '../../database/database.service.js';

export interface Usuario {
  id_usuario: number;
  nombre: string;
  correo: string;
  rol: Rol;
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
      'SELECT id_usuario, nombre, correo, rol FROM usuario ORDER BY id_usuario',
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
}
