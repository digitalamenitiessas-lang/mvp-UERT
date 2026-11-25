import type { Db } from "@/lib/db";
import type { ComunicacionSRT, LoteIntercambio } from "@/lib/tipos";

export interface ComunicacionFila extends ComunicacionSRT {
  numero: string | null;
  apellido: string | null;
  nombres: string | null;
}

export async function listarComunicaciones(
  db: Db,
  f: { canal?: ComunicacionSRT["canal"]; soloErrores?: boolean; limite?: number } = {},
): Promise<ComunicacionFila[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.canal) {
    params.push(f.canal);
    where.push(`c.canal = $${params.length}`);
  }
  if (f.soloErrores) where.push("not c.ok");
  params.push(f.limite ?? 100);
  const { rows } = await db.query<ComunicacionFila>(
    `select c.*, e.numero, p.apellido, p.nombres
       from srt_comunicaciones c
       left join expedientes e on e.id = c.expediente_id
       left join personas p on p.id = e.persona_id
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by c.fecha desc, c.id desc
      limit $${params.length}`,
    params,
  );
  return rows;
}

export async function listarLotes(db: Db): Promise<Array<LoteIntercambio & { generado_por_nombre: string | null }>> {
  const { rows } = await db.query<LoteIntercambio & { generado_por_nombre: string | null }>(
    `select l.*, u.nombre as generado_por_nombre from intercambio_lotes l left join usuarios u on u.id = l.generado_por
      order by l.generado_en desc, l.id desc`,
  );
  return rows;
}

export async function obtenerLote(db: Db, id: number): Promise<LoteIntercambio | null> {
  const { rows } = await db.query<LoteIntercambio>("select * from intercambio_lotes where id = $1", [id]);
  return rows[0] ?? null;
}
