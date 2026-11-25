/**
 * Carga de los catálogos de la SRT desde db/catalogos/*.json.
 * Son copias de las tablas de referencia publicadas por la SRT (agosto–octubre
 * 2024, tomadas del sistema anterior). Localidades: solo Santiago del Estero.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Db } from "@/lib/db";

const DIR = path.join(process.cwd(), "db", "catalogos");

async function leer<T>(nombre: string): Promise<T> {
  return JSON.parse(await readFile(path.join(DIR, `${nombre}.json`), "utf8")) as T;
}

const SIMPLES = [
  ["cie10", "cat_cie10"],
  ["agente_causante", "cat_agente_causante"],
  ["lesion", "cat_lesion"],
  ["zona_cuerpo", "cat_zona_cuerpo"],
  ["forma_accidente", "cat_forma_accidente"],
  ["agente_material", "cat_agente_material"],
  ["ciuo88", "cat_ciuo88"],
] as const;

export async function cargarCatalogos(db: Db): Promise<void> {
  const { rows } = await db.query<{ n: number }>("select count(*)::int as n from cat_cie10");
  if (rows[0].n > 0) return;
  await db.transaction(async (tx) => {
    for (const [archivo, tabla] of SIMPLES) {
      const pares = await leer<Array<[string, string]>>(archivo);
      await tx.query(
        `insert into ${tabla} (codigo, descripcion) select * from unnest($1::text[], $2::text[]) on conflict do nothing`,
        [pares.map((p) => p[0]), pares.map((p) => p[1])],
      );
    }
    const provincias = await leer<Array<[number, string, string]>>("provincia");
    await tx.query(
      "insert into cat_provincia (id, codigo_dgi, nombre) select * from unnest($1::int[], $2::text[], $3::text[]) on conflict do nothing",
      [provincias.map((p) => p[0]), provincias.map((p) => p[1]), provincias.map((p) => p[2])],
    );
    const localidades = await leer<Array<[number, number, string, string | null, string | null]>>("localidad");
    await tx.query(
      `insert into cat_localidad (id, provincia_id, nombre, codigo_postal, departamento)
       select * from unnest($1::int[], $2::int[], $3::text[], $4::text[], $5::text[]) on conflict do nothing`,
      [
        localidades.map((l) => l[0]),
        localidades.map((l) => l[1]),
        localidades.map((l) => l[2]),
        localidades.map((l) => l[3]),
        localidades.map((l) => l[4]),
      ],
    );
  });
}

/**
 * Feriados nacionales de fecha fija (y Carnaval y Viernes Santo) para los
 * plazos en días hábiles. Los feriados trasladables quedan a completar.
 */
export const FERIADOS: Array<[string, string]> = [
  ["2026-01-01", "Año Nuevo"],
  ["2026-02-16", "Carnaval"],
  ["2026-02-17", "Carnaval"],
  ["2026-03-24", "Día Nacional de la Memoria por la Verdad y la Justicia"],
  ["2026-04-02", "Día del Veterano y de los Caídos en la Guerra de Malvinas"],
  ["2026-04-03", "Viernes Santo"],
  ["2026-05-01", "Día del Trabajador"],
  ["2026-05-25", "Día de la Revolución de Mayo"],
  ["2026-06-20", "Paso a la Inmortalidad del Gral. Manuel Belgrano"],
  ["2026-07-09", "Día de la Independencia"],
  ["2026-12-08", "Inmaculada Concepción de María"],
  ["2026-12-25", "Navidad"],
  ["2027-01-01", "Año Nuevo"],
  ["2027-02-08", "Carnaval"],
  ["2027-02-09", "Carnaval"],
  ["2027-03-24", "Día Nacional de la Memoria por la Verdad y la Justicia"],
  ["2027-03-26", "Viernes Santo"],
  ["2027-04-02", "Día del Veterano y de los Caídos en la Guerra de Malvinas"],
  ["2027-05-01", "Día del Trabajador"],
  ["2027-05-25", "Día de la Revolución de Mayo"],
  ["2027-06-20", "Paso a la Inmortalidad del Gral. Manuel Belgrano"],
  ["2027-07-09", "Día de la Independencia"],
  ["2027-12-08", "Inmaculada Concepción de María"],
  ["2027-12-25", "Navidad"],
];

export async function cargarFeriados(db: Db): Promise<void> {
  await db.query(
    "insert into feriados (fecha, descripcion) select * from unnest($1::date[], $2::text[]) on conflict do nothing",
    [FERIADOS.map((f) => f[0]), FERIADOS.map((f) => f[1])],
  );
}
