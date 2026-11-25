import type { Db } from "@/lib/db";
import type { Usuario } from "@/lib/tipos";

export async function listarUsuarios(db: Db): Promise<Usuario[]> {
  const { rows } = await db.query<Usuario>("select * from usuarios where activo order by orden, id");
  return rows;
}

export async function obtenerUsuario(db: Db, id: number): Promise<Usuario | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const { rows } = await db.query<Usuario>("select * from usuarios where id = $1 and activo", [id]);
  return rows[0] ?? null;
}
