import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service.js';
import { SQL_LISTADO } from '../auditorias/auditorias.service.js';
import { IndicadoresService } from '../core/indicadores.service.js';

/**
 * Dashboard (RF09 / CP-11). Usa el MISMO servicio de indicadores que el informe, así las
 * tarjetas siempre coinciden con la sección 3 del informe.
 */
@Injectable()
export class DashboardService {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(IndicadoresService) private readonly indicadores: IndicadoresService,
  ) {}

  async resumen(idAuditoria?: number) {
    const recientes = await this.db.query<{ id_auditoria: number }>(
      `${SQL_LISTADO} ORDER BY a.creado_en DESC, a.id_auditoria DESC LIMIT 10`,
    );
    // Auditoría pedida; si no existe o no se indicó, la más reciente.
    const activa =
      (idAuditoria ? recientes.find((a) => a.id_auditoria === idAuditoria) : undefined) ??
      (idAuditoria
        ? await this.db.one<{ id_auditoria: number }>(`${SQL_LISTADO} WHERE a.id_auditoria = $1`, [idAuditoria])
        : null) ??
      recientes[0] ??
      null;

    if (!activa) {
      // Sin auditorías: indicadores en cero para que las tarjetas del dashboard se rendericen.
      const vacios = await this.indicadores.calcular(0);
      return {
        auditoria_activa: null,
        indicadores: vacios,
        hallazgos_por_severidad: vacios.hallazgos_por_severidad,
        auditorias_recientes: [],
      };
    }

    const indicadores = await this.indicadores.calcular(activa.id_auditoria);
    return {
      auditoria_activa: activa,
      indicadores,
      hallazgos_por_severidad: indicadores.hallazgos_por_severidad,
      auditorias_recientes: recientes,
    };
  }
}
