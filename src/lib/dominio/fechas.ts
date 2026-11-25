/**
 * Fechas y plazos.
 *
 * Convención: una fecha sin hora es un string ISO 'YYYY-MM-DD' (así llega de
 * la base, ver src/lib/db). Un momento es un Date. "Hoy" se calcula siempre en
 * la zona horaria de Argentina, sin depender de la del servidor.
 */
import { ZONA_HORARIA } from "./constantes";

export type FechaISO = string; // 'YYYY-MM-DD'

const fmtISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha calendario en Argentina para un momento dado. */
export function fechaDe(momento: Date): FechaISO {
  return fmtISO.format(momento);
}

export function hoy(ahora: Date = new Date()): FechaISO {
  return fechaDe(ahora);
}

export function esFechaISO(valor: unknown): valor is FechaISO {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(Date.parse(valor + "T00:00:00Z"));
}

function aUTC(iso: FechaISO): Date {
  return new Date(iso + "T00:00:00Z");
}

function deUTC(d: Date): FechaISO {
  return d.toISOString().slice(0, 10);
}

export function sumarDias(iso: FechaISO, dias: number): FechaISO {
  const d = aUTC(iso);
  d.setUTCDate(d.getUTCDate() + dias);
  return deUTC(d);
}

/** Días corridos de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  return Math.round((aUTC(hasta).getTime() - aUTC(desde).getTime()) / 86_400_000);
}

export function compararFechas(a: FechaISO, b: FechaISO): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Lunes a viernes que no sea feriado. */
export function esHabil(iso: FechaISO, feriados: ReadonlySet<string>): boolean {
  const dia = aUTC(iso).getUTCDay(); // 0 domingo … 6 sábado
  return dia !== 0 && dia !== 6 && !feriados.has(iso);
}

/**
 * Vencimiento de un plazo de `n` días hábiles que empieza a correr el día
 * hábil siguiente a `desde`. Con n = 0 devuelve `desde`.
 */
export function sumarDiasHabiles(desde: FechaISO, n: number, feriados: ReadonlySet<string>): FechaISO {
  let fecha = desde;
  let contados = 0;
  while (contados < n) {
    fecha = sumarDias(fecha, 1);
    if (esHabil(fecha, feriados)) contados++;
  }
  return fecha;
}

/**
 * Días hábiles que faltan desde `hoyISO` hasta `vence` inclusive.
 * 0 = vence hoy; negativo = días hábiles de atraso.
 */
export function diasHabilesRestantes(hoyISO: FechaISO, vence: FechaISO, feriados: ReadonlySet<string>): number {
  if (hoyISO === vence) return 0;
  if (hoyISO < vence) {
    let n = 0;
    let f = hoyISO;
    while (f < vence) {
      f = sumarDias(f, 1);
      if (esHabil(f, feriados)) n++;
    }
    // Si vence un día no hábil, el plazo se cumple igual ese día: al menos 1.
    return Math.max(n, 1);
  }
  let n = 0;
  let f = vence;
  while (f < hoyISO) {
    f = sumarDias(f, 1);
    if (esHabil(f, feriados)) n++;
  }
  return -Math.max(n, 1);
}

export type NivelPlazo = "vencido" | "hoy" | "proximo" | "en_termino";

export interface EstadoPlazo {
  vence: FechaISO;
  /** Días restantes (hábiles o corridos según `habiles`). Negativo = vencido. */
  dias: number;
  habiles: boolean;
  nivel: NivelPlazo;
  texto: string;
}

/**
 * Describe un vencimiento para mostrarlo en una bandeja.
 * `aviso` = cuántos días antes pasa a "próximo".
 */
export function estadoPlazo(
  hoyISO: FechaISO,
  vence: FechaISO,
  opciones: { habiles: boolean; feriados?: ReadonlySet<string>; aviso?: number },
): EstadoPlazo {
  const { habiles, feriados = new Set<string>(), aviso = 2 } = opciones;
  const dias = habiles ? diasHabilesRestantes(hoyISO, vence, feriados) : diasEntre(hoyISO, vence);
  // "Vence en 2 días hábiles", "Vencido hace 1 día hábil", "Vence en 3 días"
  const plural = (n: number) => {
    const uno = Math.abs(n) === 1;
    if (habiles) return uno ? "día hábil" : "días hábiles";
    return uno ? "día" : "días";
  };
  let nivel: NivelPlazo;
  let texto: string;
  if (dias < 0) {
    nivel = "vencido";
    texto = `Vencido hace ${Math.abs(dias)} ${plural(dias)}`;
  } else if (dias === 0) {
    nivel = "hoy";
    texto = "Vence hoy";
  } else if (dias <= aviso) {
    nivel = "proximo";
    texto = `Vence en ${dias} ${plural(dias)}`;
  } else {
    nivel = "en_termino";
    texto = `Vence en ${dias} ${plural(dias)}`;
  }
  return { vence, dias, habiles, nivel, texto };
}

// ---------------------------------------------------------------------------
// Formato para mostrar
// ---------------------------------------------------------------------------
const fmtFechaHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const fmtHora = new Intl.DateTimeFormat("es-AR", {
  timeZone: ZONA_HORARIA,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 'YYYY-MM-DD' → 'dd/mm/aaaa'. */
export function formatoFecha(iso: FechaISO | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** Momento → 'dd/mm/aaaa HH:mm' (hora de Argentina). */
export function formatoFechaHora(momento: Date | string | null | undefined): string {
  if (!momento) return "—";
  const d = typeof momento === "string" ? new Date(momento) : momento;
  return fmtFechaHora.format(d).replace(",", "");
}

export function formatoHora(momento: Date | string): string {
  const d = typeof momento === "string" ? new Date(momento) : momento;
  return fmtHora.format(d);
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** 'YYYY-MM-DD' → 'martes 24 de noviembre de 2026'. */
export function formatoFechaLarga(iso: FechaISO): string {
  const d = aUTC(iso);
  return `${DIAS_SEMANA[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

/**
 * Arma un momento a partir de fecha y hora de Argentina ('YYYY-MM-DD', 'HH:mm').
 * Argentina no tiene horario de verano: el offset es -03:00 todo el año.
 */
export function momentoArgentina(fecha: FechaISO, hora: string): Date {
  return new Date(`${fecha}T${hora.length === 5 ? hora : hora.slice(0, 5)}:00-03:00`);
}

/** Antigüedad legible entre dos fechas: '2 años y 3 meses'. */
export function antiguedad(desde: FechaISO, hasta: FechaISO): string {
  const a = aUTC(desde);
  const b = aUTC(hasta);
  let meses = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  if (b.getUTCDate() < a.getUTCDate()) meses--;
  if (meses < 0) return "—";
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [];
  if (anios) partes.push(`${anios} ${anios === 1 ? "año" : "años"}`);
  if (resto) partes.push(`${resto} ${resto === 1 ? "mes" : "meses"}`);
  return partes.length ? partes.join(" y ") : "menos de un mes";
}
