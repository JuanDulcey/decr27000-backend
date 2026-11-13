import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { JwtAuthGuard, RolesGuard } from './common/guards.js';
import { ResponseInterceptor } from './common/response.interceptor.js';
import { buildValidationPipe } from './common/validation.js';
import { validateEnv } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { AuditoriasModule } from './modules/auditorias/auditorias.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ControlesModule } from './modules/controles/controles.module.js';
import { CoreModule } from './modules/core/core.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { EvaluacionesModule } from './modules/evaluaciones/evaluaciones.module.js';
import { HallazgosModule } from './modules/hallazgos/hallazgos.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { InformesModule } from './modules/informes/informes.module.js';
import { SeedModule } from './modules/seed/seed.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Las pruebas nunca leen .env (que apunta a Supabase): usan solo variables explícitas.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    DatabaseModule,
    CoreModule,
    HealthModule,
    AuthModule,
    UsuariosModule,
    ControlesModule,
    AuditoriasModule,
    EvaluacionesModule,
    HallazgosModule,
    InformesModule,
    DashboardModule,
    SeedModule,
  ],
  providers: [
    // Orden: primero autenticación (JWT), luego autorización por rol.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_PIPE, useFactory: buildValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
