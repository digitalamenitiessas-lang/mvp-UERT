/**
 * Borra los datos y vuelve a cargar la demo (con fechas relativas a hoy).
 * Los catálogos de la SRT se cargan una sola vez.
 */
import { crearPg, crearPglite, dirPglite } from "../src/lib/db";
import { migrar } from "../src/lib/db/migrar";
import { sembrarDemo } from "../src/lib/demo/sembrar";

async function main() {
  const url = process.env.DATABASE_URL;
  const db = url ? await crearPg(url) : await crearPglite(dirPglite());
  await migrar(db);
  const inicio = Date.now();
  await sembrarDemo(db, { ahora: new Date() });
  const { rows } = await db.query<{ estado: string; n: number }>(
    "select estado, count(*)::int as n from expedientes group by estado order by estado",
  );
  console.log(`Demo cargada en ${((Date.now() - inicio) / 1000).toFixed(1)} s:`);
  for (const r of rows) console.log(`  ${r.estado.padEnd(18)} ${r.n}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
