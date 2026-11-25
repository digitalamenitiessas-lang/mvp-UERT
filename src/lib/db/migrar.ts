import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "./index";

/** Aplica las migraciones de db/migraciones que falten, en orden de nombre. */
export async function migrar(db: Db, dir = path.join(process.cwd(), "db", "migraciones")): Promise<string[]> {
  await db.exec(`
    create schema if not exists uert;
    create table if not exists uert.schema_migraciones (
      nombre      text primary key,
      aplicada_en timestamptz not null default now()
    );
  `);
  const { rows } = await db.query<{ nombre: string }>("select nombre from uert.schema_migraciones");
  const aplicadas = new Set(rows.map((r) => r.nombre));
  const archivos = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const nuevas: string[] = [];
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    // turbopackIgnore: la ruta es dinámica y, sin el comentario, el build rastrea
    // todo el proyecto. Las migraciones se leen del disco, no del bundle.
    const sql = await readFile(path.join(/*turbopackIgnore: true*/ dir, archivo), "utf8");
    await db.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query("insert into uert.schema_migraciones (nombre) values ($1)", [archivo]);
    });
    nuevas.push(archivo);
  }
  return nuevas;
}
