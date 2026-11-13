import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { AppError } from '../../common/app-error.js';
import { Usuario, UsuariosService } from '../usuarios/usuarios.service.js';

const INVALID_CREDENTIALS = 'Credenciales inválidas. Verifique su correo y contraseña.';

/** Hash ficticio para que el tiempo de respuesta no revele si el correo existe. */
const DUMMY_HASH = bcrypt.hashSync('decr27000-dummy-password', 10);

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(UsuariosService) private readonly usuarios: UsuariosService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(correo: string, password: string): Promise<{ token: string; usuario: Usuario }> {
    const found = await this.usuarios.findByCorreoWithHash(correo);
    const hash = found?.password_hash ?? DUMMY_HASH;

    if (found && !hash.startsWith('$2')) {
      // La semilla guarda la clave en texto plano; debe hashearse con `pnpm db:security`.
      this.logger.error(
        `El usuario ${found.id_usuario} tiene la contraseña sin hashear. Ejecute "pnpm db:security".`,
      );
      throw AppError.unauthorized(INVALID_CREDENTIALS);
    }

    const valid = await bcrypt.compare(password, hash);
    if (!found || !valid) throw AppError.unauthorized(INVALID_CREDENTIALS);

    const usuario: Usuario = {
      id_usuario: found.id_usuario,
      nombre: found.nombre,
      correo: found.correo,
      rol: found.rol,
    };
    const token = await this.jwt.signAsync({
      sub: usuario.id_usuario,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
    });
    return { token, usuario };
  }

  async me(idUsuario: number): Promise<Usuario> {
    const usuario = await this.usuarios.findById(idUsuario);
    if (!usuario) throw AppError.unauthorized('El usuario de la sesión ya no existe.');
    return usuario;
  }
}
