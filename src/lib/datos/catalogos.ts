/**
 * Búsqueda en los catálogos de la SRT para los combos con buscador (RF-31):
 * por código o por palabras de la descripción, sin importar acentos.
 */
import type { Db } from "@/lib/db";
import { normalizar } from "./expedientes";

export const CATALOGOS = {
  cie10: { tabla: "cat_cie10", nombre: "Diagnóstico CIE-10" },
  agente_causante: { tabla: "cat_agente_causante", nombre: "Agente causante" },
  lesion: { tabla: "cat_lesion", nombre: "Lesión" },
  zona_cuerpo: { tabla: "cat_zona_cuerpo", nombre: "Zona del cuerpo" },
  forma_accidente: { tabla: "cat_forma_accidente", nombre: "Forma del accidente" },
  agente_material: { tabla: "cat_agente_material", nombre: "Agente material" },
  ciuo88: { tabla: "cat_ciuo88", nombre: "Ocupación (CIUO-88)" },
  localidad: { tabla: "cat_localidad", nombre: "Localidad" },
} as const;

export type Catalogo = keyof typeof CATALOGOS;

export interface OpcionCatalogo {
  codigo: string;
  descripcion: string;
  detalle?: string | null;
}

export function esCatalogo(valor: string): valor is Catalogo {
  return valor in CATALOGOS;
}

/** Escapa los comodines de LIKE (en Postgres el escape por defecto es "\"). */
function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Condición "contiene todas las palabras" sobre una columna, sin importar
 * acentos ni el orden: "fractura muñeca" encuentra "Fractura a nivel de la
 * muñeca y de la mano". Agrega los parámetros a `params`.
 */
export function todasLasPalabras(columna: string, palabras: string[], params: unknown[]): string {
  return palabras
    .map((p) => {
      params.push(`%${escaparLike(p)}%`);
      return `translate(lower(${columna}), 'áéíóúüñ', 'aeiouun') like $${params.length}`;
    })
    .join(" and ");
}

export async function buscarEnCatalogo(db: Db, catalogo: Catalogo, consulta: string, limite = 30): Promise<OpcionCatalogo[]> {
  const palabras = normalizar(consulta).split(/\s+/).filter(Boolean).slice(0, 8);
  if (catalogo === "localidad") {
    // Sin consulta no se manda el código postal: Postgres rechaza un parámetro
    // que la consulta no usa ("could not determine data type of parameter").
    const params: unknown[] = [];
    let where = "";
    if (palabras.length) {
      params.push(consulta.trim());
      where = `where codigo_postal = $1 or (${todasLasPalabras("nombre", palabras, params)})`;
    }
    params.push(`${escaparLike(palabras[0] ?? "")}%`);
    const empieza = params.length;
    params.push(limite);
    const { rows } = await db.query<{ id: number; nombre: string; codigo_postal: string | null; departamento: string | null }>(
      `select id, nombre, codigo_postal, departamento from cat_localidad
        ${where}
        order by (translate(lower(nombre), 'áéíóúüñ', 'aeiouun') like $${empieza}) desc, nombre
        limit $${params.length}`,
      params,
    );
    return rows.map((r) => ({
      codigo: String(r.id),
      descripcion: r.nombre,
      detalle: [r.departamento ? `Depto. ${r.departamento}` : null, r.codigo_postal ? `CP ${r.codigo_postal}` : null]
        .filter(Boolean)
        .join(" · "),
    }));
  }
  const { tabla } = CATALOGOS[catalogo];
  // Código: "s62.0", "S62 0" y "S620" son lo mismo.
  const params: unknown[] = [`${escaparLike(consulta.trim().toUpperCase().replace(/[.\s]/g, ""))}%`];
  const where = palabras.length ? `where codigo like $1 or (${todasLasPalabras("descripcion", palabras, params)})` : "";
  params.push(limite);
  const { rows } = await db.query<OpcionCatalogo>(
    `select codigo, descripcion from ${tabla}
      ${where}
      order by (codigo like $1) desc, length(codigo), codigo
      limit $${params.length}`,
    params,
  );
  return rows;
}

export async function descripcionDe(db: Db, catalogo: Catalogo, codigo: string | number | null): Promise<string | null> {
  if (codigo === null || codigo === "") return null;
  if (catalogo === "localidad") {
    const { rows } = await db.query<{ nombre: string }>("select nombre from cat_localidad where id = $1", [Number(codigo)]);
    return rows[0]?.nombre ?? null;
  }
  const { rows } = await db.query<{ descripcion: string }>(
    `select descripcion from ${CATALOGOS[catalogo].tabla} where codigo = $1`,
    [String(codigo)],
  );
  return rows[0]?.descripcion ?? null;
}

export async function contarCatalogos(db: Db): Promise<Array<{ catalogo: Catalogo; nombre: string; registros: number }>> {
  const salida = [];
  for (const [catalogo, info] of Object.entries(CATALOGOS)) {
    const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from ${info.tabla}`);
    salida.push({ catalogo: catalogo as Catalogo, nombre: info.nombre, registros: rows[0].n });
  }
  return salida;
}
