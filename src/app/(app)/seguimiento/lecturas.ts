/**
 * Lecturas propias de la bandeja de Seguimiento de licencias: los datos de la
 * licencia que no trae `ExpedienteFila` (inicio de la inasistencia, motivo del
 * cese y la última presentación). Solo para Server Components.
 */
import type { Db } from "@/lib/db";
import type { MotivoCeseIlt } from "@/lib/dominio/constantes";
import type { FechaISO } from "@/lib/dominio/fechas";

export interface DatosLicencia {
  id: number;
  fecha_inicio_inasistencia: FechaISO | null;
  motivo_cese_ilt: MotivoCeseIlt | null;
  presentaciones: number;
  ultima_presentacion: FechaISO | null;
  ultima_presentacion_detalle: string | null;
}

export async function datosDeLicencias(db: Db, ids: number[]): Promise<Map<number, DatosLicencia>> {
  if (!ids.length) return new Map();
  const { rows } = await db.query<DatosLicencia>(
    `select e.id, e.fecha_inicio_inasistencia, e.motivo_cese_ilt,
            (select count(*)::int from presentaciones p where p.expediente_id = e.id) as presentaciones,
            up.fecha as ultima_presentacion, up.detalle as ultima_presentacion_detalle
       from expedientes e
       left join lateral (
         select fecha, detalle from presentaciones p where p.expediente_id = e.id order by p.fecha desc, p.id desc limit 1
       ) up on true
      where e.id = any($1)`,
    [ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}
