/**
 * Búsqueda unificada (RF-02): por nombre, apellido, DNI, CUIL o número de
 * siniestro del sistema actual trae todos los
 * siniestros de la persona, del sistema nuevo y del que la UERT usa hoy,
 * agrupados por año.
 */
import type { Db } from "@/lib/db";
import type { EstadoExpediente, TipoDenuncia } from "@/lib/dominio/constantes";
import type { FechaISO } from "@/lib/dominio/fechas";
import { todasLasPalabras } from "./catalogos";
import { normalizar } from "./expedientes";

export interface IncidenteBusqueda {
  origen: "nuevo" | "actual";
  id: number | null;
  numero: string;
  anio: number;
  tipo: string;
  tipo_codigo: TipoDenuncia | null;
  estado: string;
  estado_codigo: EstadoExpediente | null;
  abierto: boolean;
  fecha: FechaISO | null;
  diagnostico: string | null;
  reparticion: string | null;
}

export interface PersonaBusqueda {
  clave: string; // CUIL o DNI
  persona_id: number | null;
  apellido_nombre: string;
  cuil: string | null;
  dni: string | null;
  incidentes: IncidenteBusqueda[];
}

export async function buscarIncidentes(db: Db, consulta: string): Promise<PersonaBusqueda[]> {
  const q = consulta.trim();
  if (q.length < 3) return [];
  const digitos = q.replace(/\D/g, "");
  const porDigitos = digitos.length >= 6 ? `%${digitos}%` : null;
  // Palabra por palabra y en cualquier orden: "carlos juarez" encuentra "JUÁREZ, Carlos Alberto".
  const palabras = normalizar(q)
    .split(/[\s,;]+/)
    .filter(Boolean)
    .slice(0, 8);

  // Un número de siniestro del sistema actual (p. ej. AT-2026-0611) trae a esa persona:
  // se buscan después todos sus siniestros por CUIL o DNI, en los dos sistemas.
  const claveNumero = q.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const delNumero =
    claveNumero.length >= 6
      ? (
          await db.query<{ cuil: string | null; dni: string | null }>(
            `select cuil, dni from legado_siniestros
              where regexp_replace(upper(numero), '[^A-Z0-9]', '', 'g') = $1`,
            [claveNumero],
          )
        ).rows
      : [];
  const cuilsDelNumero = delNumero.map((r) => r.cuil).filter((c): c is string => !!c);
  const dnisDelNumero = delNumero.map((r) => r.dni).filter((d): d is string => !!d);

  const paramsNuevos: unknown[] = [porDigitos, cuilsDelNumero, dnisDelNumero];
  const porNombreNuevo = todasLasPalabras("p.apellido || ' ' || p.nombres", palabras, paramsNuevos);
  const paramsActuales: unknown[] = [porDigitos, cuilsDelNumero, dnisDelNumero];
  const porNombreActual = todasLasPalabras("apellido_nombre", palabras, paramsActuales);

  const [nuevos, actuales] = await Promise.all([
    db.query<{
      persona_id: number;
      apellido: string;
      nombres: string;
      cuil: string;
      dni: string;
      id: number | null;
      numero: string | null;
      anio: number | null;
      tipo: TipoDenuncia | null;
      estado: EstadoExpediente | null;
      fecha: FechaISO | null;
      recibido_en: Date | null;
      reparticion: string | null;
      diagnostico: string | null;
    }>(
      `select p.id as persona_id, p.apellido, p.nombres, p.cuil, p.dni,
              e.id, e.numero, e.anio, e.tipo, e.estado, e.fecha_ocurrencia as fecha, e.recibido_en, e.reparticion,
              (select string_agg(coalesce(d.cie10_adecuado, d.cie10), ', ' order by d.orden)
                 from diagnosticos d where d.expediente_id = e.id) as diagnostico
         from personas p
         left join expedientes e on e.persona_id = p.id
        where (${porNombreNuevo || "false"})
           or ($1::text is not null and (p.dni like $1 or p.cuil like $1))
           or p.cuil = any($2::text[]) or p.dni = any($3::text[])
        order by p.apellido, p.nombres, e.anio desc, e.contador desc, e.sufijo desc
        limit 300`,
      paramsNuevos,
    ),
    db.query<{
      id: number;
      cuil: string | null;
      dni: string | null;
      apellido_nombre: string;
      numero: string;
      anio: number;
      tipo: string;
      estado: string;
      abierto: boolean;
      fecha_ocurrencia: FechaISO | null;
      diagnostico: string | null;
      reparticion: string | null;
    }>(
      `select * from legado_siniestros
        where (${porNombreActual || "false"})
           or ($1::text is not null and (dni like $1 or cuil like $1))
           or cuil = any($2::text[]) or dni = any($3::text[])
        order by anio desc limit 300`,
      paramsActuales,
    ),
  ]);

  const personas = new Map<string, PersonaBusqueda>();
  const clave = (cuil: string | null, dni: string | null, nombre: string) => cuil ?? dni ?? nombre;

  for (const r of nuevos.rows) {
    const k = clave(r.cuil, r.dni, `${r.apellido}, ${r.nombres}`);
    if (!personas.has(k)) {
      personas.set(k, {
        clave: k,
        persona_id: r.persona_id,
        apellido_nombre: `${r.apellido}, ${r.nombres}`,
        cuil: r.cuil,
        dni: r.dni,
        incidentes: [],
      });
    }
    if (r.id && r.numero && r.anio && r.tipo && r.estado) {
      personas.get(k)!.incidentes.push({
        origen: "nuevo",
        id: r.id,
        numero: r.numero,
        anio: r.anio,
        tipo: r.tipo,
        tipo_codigo: r.tipo,
        estado: r.estado,
        estado_codigo: r.estado,
        abierto: !["alta", "rechazado", "desistido", "cerrado"].includes(r.estado),
        fecha: r.fecha,
        diagnostico: r.diagnostico,
        reparticion: r.reparticion,
      });
    }
  }
  for (const r of actuales.rows) {
    // Se agrupa con la persona del sistema nuevo si coincide el CUIL o el DNI
    const existente = [...personas.values()].find(
      (p) => (r.cuil && p.cuil === r.cuil) || (r.dni && p.dni === r.dni),
    );
    const k = existente?.clave ?? clave(r.cuil, r.dni, r.apellido_nombre);
    if (!personas.has(k)) {
      personas.set(k, { clave: k, persona_id: null, apellido_nombre: r.apellido_nombre, cuil: r.cuil, dni: r.dni, incidentes: [] });
    }
    personas.get(k)!.incidentes.push({
      origen: "actual",
      id: null,
      numero: r.numero,
      anio: r.anio,
      tipo: r.tipo,
      tipo_codigo: null,
      estado: r.estado,
      estado_codigo: null,
      abierto: r.abierto,
      fecha: r.fecha_ocurrencia,
      diagnostico: r.diagnostico,
      reparticion: r.reparticion,
    });
  }
  for (const p of personas.values()) {
    p.incidentes.sort((a, b) => b.anio - a.anio || (b.fecha ?? "").localeCompare(a.fecha ?? ""));
  }
  return [...personas.values()];
}

/** Agrupa los incidentes de una persona por año (más reciente primero). */
export function porAnio(incidentes: IncidenteBusqueda[]): Array<{ anio: number; incidentes: IncidenteBusqueda[] }> {
  const mapa = new Map<number, IncidenteBusqueda[]>();
  for (const i of incidentes) mapa.set(i.anio, [...(mapa.get(i.anio) ?? []), i]);
  return [...mapa.entries()].sort((a, b) => b[0] - a[0]).map(([anio, lista]) => ({ anio, incidentes: lista }));
}
