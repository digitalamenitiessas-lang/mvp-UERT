/**
 * Aplica las migraciones pendientes.
 *   Con DATABASE_URL: sobre PostgreSQL (VPS).
 *   Sin DATABASE_URL: sobre PGlite en ~/.mvp-uert/pglite (desarrollo).
 */
import { crearPg, crearPglite, dirPglite } from "../src/lib/db";
import { migrar } from "../src/lib/db/migrar";

async function main() {
  const url = process.env.DATABASE_URL;
  const db = url ? await crearPg(url) : await crearPglite(dirPglite());
  const nuevas = await migrar(db);
  console.log(nuevas.length ? `Migraciones aplicadas: ${nuevas.join(", ")}` : "La base ya estaba al día.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
