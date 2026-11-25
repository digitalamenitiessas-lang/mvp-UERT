import type { Db } from "./index";
import { migrar } from "./migrar";

/**
 * Solo para PGlite (desarrollo): deja la base lista sin pasos manuales.
 * En la VPS esto lo hacen los scripts `npm run db:migrar` y `npm run db:sembrar`.
 */
export async function prepararBaseDesarrollo(db: Db): Promise<void> {
  await migrar(db);
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from uert.usuarios");
  if (rows[0].n === 0) {
    const { sembrarDemo } = await import("@/lib/demo/sembrar");
    await sembrarDemo(db, { ahora: new Date() });
  }
}
