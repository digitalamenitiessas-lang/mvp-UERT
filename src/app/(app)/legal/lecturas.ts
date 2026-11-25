/**
 * Lecturas propias de la bandeja del Área legal.
 */
import type { Db } from "@/lib/db";
import { MOTIVOS_RECHAZO, type EstadoExpediente, type MotivoRechazo } from "@/lib/dominio/constantes";

export interface RechazoReciente {
  expediente_id: number;
  estado: EstadoExpediente;
  /** Última decisión de rechazo del dictamen. */
  rechazado_en: Date;
  motivos: MotivoRechazo[];
  rechazados: number;
  total: number;
}

/**
 * Expedientes con diagnósticos rechazados en un dictamen ya cerrado (todos
 * rechazados o rechazo parcial), con la decisión desde `desde`.
 */
export async function listarRechazosRecientes(db: Db, desde: Date): Promise<RechazoReciente[]> {
  const { rows } = await db.query<Omit<RechazoReciente, "motivos"> & { motivos: string | null }>(
    `select e.id as expediente_id, e.estado,
            max(d.decidido_en) filter (where d.estado = 'rechazado') as rechazado_en,
            string_agg(distinct d.motivo_rechazo, '' order by d.motivo_rechazo) filter (where d.estado = 'rechazado') as motivos,
            (count(*) filter (where d.estado = 'rechazado'))::int as rechazados,
            (count(*) filter (where d.estado <> 'desistido'))::int as total
       from expedientes e
       join diagnosticos d on d.expediente_id = e.id
      where e.estado <> 'dictamen_legal'
      group by e.id, e.estado
     having count(*) filter (where d.estado = 'rechazado') > 0
        and max(d.decidido_en) filter (where d.estado = 'rechazado') >= $1
      order by rechazado_en desc`,
    [desde],
  );
  return rows.map((r) => ({
    ...r,
    rechazado_en: new Date(r.rechazado_en),
    motivos: MOTIVOS_RECHAZO.filter((m) => (r.motivos ?? "").includes(m)),
  }));
}
