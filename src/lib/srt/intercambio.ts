/**
 * Archivos del Sistema de Intercambio de la SRT para FODEP.
 * Fuente: "Implementación de FODEP en intercambio", v0.2 (octubre 2026).
 *
 * Con FODEP, los campos de diagnóstico, lesión y zona del cuerpo de los
 * archivos .AT y .EF van vacíos y la información viaja en tres archivos
 * nuevos, de ancho fijo:
 *   .AD  diagnósticos (65 posiciones)
 *   .AL  lesiones de cada diagnóstico (21 posiciones)
 *   .AZ  zonas del cuerpo de cada diagnóstico (22 posiciones)
 * Se vinculan por el Número Único de Diagnóstico.
 *
 * Diferencias detectadas en el documento (borrador) que hay que confirmar con
 * la SRT: los ejemplos de la sección 8 muestran el Nro. de siniestro en .AL y
 * .AZ, pero la definición de campos (6.2 y 6.3) no lo incluye. Acá se sigue la
 * definición de campos.
 */
import { CODIGOS_EXAMEN_SIN_FODEP, type CodigoExamen } from "@/lib/dominio/constantes";
import type { FechaISO } from "@/lib/dominio/fechas";

export type TipoOperacion = "A" | "B" | "M";

export interface RegistroDiagnostico {
  numeroSiniestro: string; // 20 posiciones
  extension: "AT" | "EF";
  numeroUnico: number;
  orden: number;
  tipoOperacion: TipoOperacion;
  cie10: string;
  fechaDiagnostico: FechaISO;
  codigoExamen: CodigoExamen | null;
  desvinculado: boolean;
  idFodep: number | null;
  lesiones: Array<{ orden: number; codigo: string }>;
  zonas: Array<{ orden: number; codigo: string }>;
}

export interface CampoLayout {
  pos: number;
  campo: string;
  desde: number;
  hasta: number;
  obligatorio: "SI" | "CONDICIONAL";
  observacion?: string;
}

export const LAYOUT_AD: CampoLayout[] = [
  { pos: 1, campo: "CART", desde: 1, hasta: 5, obligatorio: "SI" },
  { pos: 2, campo: "Nro. SINIESTRO", desde: 6, hasta: 25, obligatorio: "SI" },
  { pos: 3, campo: "EXTENSION", desde: 26, hasta: 27, obligatorio: "SI", observacion: "AT o EF" },
  { pos: 4, campo: "Número único de DIAGNÓSTICO", desde: 28, hasta: 37, obligatorio: "SI" },
  { pos: 5, campo: "ORDEN", desde: 38, hasta: 40, obligatorio: "SI", observacion: "1 a 999" },
  { pos: 6, campo: "TIPO OPERACIÓN", desde: 41, hasta: 41, obligatorio: "SI", observacion: "A / B / M" },
  { pos: 7, campo: "CIE10", desde: 42, hasta: 45, obligatorio: "SI" },
  { pos: 8, campo: "Fecha de diagnóstico", desde: 46, hasta: 53, obligatorio: "SI", observacion: "AAAAMMDD" },
  { pos: 9, campo: "Código examen de detección", desde: 54, hasta: 54, obligatorio: "CONDICIONAL", observacion: "F = FODEP" },
  { pos: 10, campo: "Desvinculado", desde: 55, hasta: 55, obligatorio: "SI", observacion: "0 = NO, 1 = SI" },
  {
    pos: 11,
    campo: "ID_FODEP",
    desde: 56,
    hasta: 65,
    obligatorio: "CONDICIONAL",
    observacion: "Obligatorio si el código de examen no es P, R, A, E ni T",
  },
];

export const LAYOUT_AL: CampoLayout[] = [
  { pos: 1, campo: "CART", desde: 1, hasta: 5, obligatorio: "SI" },
  { pos: 2, campo: "Número único de DIAGNÓSTICO", desde: 6, hasta: 15, obligatorio: "SI" },
  { pos: 3, campo: "ORDEN", desde: 16, hasta: 18, obligatorio: "SI", observacion: "1 a 999" },
  { pos: 4, campo: "TIPO OPERACIÓN", desde: 19, hasta: 19, obligatorio: "SI", observacion: "A / B / M" },
  { pos: 5, campo: "Código de LESIÓN", desde: 20, hasta: 21, obligatorio: "SI" },
];

export const LAYOUT_AZ: CampoLayout[] = [
  { pos: 1, campo: "CART", desde: 1, hasta: 5, obligatorio: "SI" },
  { pos: 2, campo: "Número único de DIAGNÓSTICO", desde: 6, hasta: 15, obligatorio: "SI" },
  { pos: 3, campo: "ORDEN", desde: 16, hasta: 18, obligatorio: "SI", observacion: "1 a 999" },
  { pos: 4, campo: "TIPO OPERACIÓN", desde: 19, hasta: 19, obligatorio: "SI", observacion: "A / B / M" },
  { pos: 5, campo: "Código de zona del cuerpo", desde: 20, hasta: 22, obligatorio: "SI" },
];

export const LARGO = { AD: 65, AL: 21, AZ: 22 } as const;

export class ErrorIntercambio extends Error {}

/** Numérico alineado a la derecha con ceros. */
function num(valor: number | string, largo: number, campo: string): string {
  const s = String(valor);
  if (!/^\d+$/.test(s)) throw new ErrorIntercambio(`${campo}: "${s}" no es numérico`);
  if (s.length > largo) throw new ErrorIntercambio(`${campo}: "${s}" supera ${largo} posiciones`);
  return s.padStart(largo, "0");
}

/** Alfanumérico alineado a la izquierda con espacios. */
function txt(valor: string | null | undefined, largo: number, campo: string): string {
  const s = valor ?? "";
  if (s.length > largo) throw new ErrorIntercambio(`${campo}: "${s}" supera ${largo} posiciones`);
  return s.padEnd(largo, " ");
}

export function lineaAD(r: RegistroDiagnostico, cart: string): string {
  if (r.numeroSiniestro.length !== 20) throw new ErrorIntercambio("Nro. SINIESTRO: debe tener 20 posiciones");
  const requiereFodep = r.codigoExamen !== null && !CODIGOS_EXAMEN_SIN_FODEP.includes(r.codigoExamen);
  if (requiereFodep && !r.idFodep) {
    throw new ErrorIntercambio(`ID_FODEP: obligatorio con código de examen ${r.codigoExamen}`);
  }
  const linea =
    num(cart, 5, "CART") +
    num(r.numeroSiniestro, 20, "Nro. SINIESTRO") +
    txt(r.extension, 2, "EXTENSION") +
    num(r.numeroUnico, 10, "Número único de DIAGNÓSTICO") +
    num(r.orden, 3, "ORDEN") +
    txt(r.tipoOperacion, 1, "TIPO OPERACIÓN") +
    txt(r.cie10, 4, "CIE10") +
    num(r.fechaDiagnostico.replaceAll("-", ""), 8, "Fecha de diagnóstico") +
    txt(r.codigoExamen ?? "", 1, "Código examen de detección") +
    (r.desvinculado ? "1" : "0") +
    (r.idFodep ? num(r.idFodep, 10, "ID_FODEP") : " ".repeat(10));
  if (linea.length !== LARGO.AD) throw new ErrorIntercambio(`.AD: largo ${linea.length} en vez de ${LARGO.AD}`);
  return linea;
}

export function lineasAL(r: RegistroDiagnostico, cart: string): string[] {
  return r.lesiones.map((l) => {
    const linea =
      num(cart, 5, "CART") +
      num(r.numeroUnico, 10, "Número único de DIAGNÓSTICO") +
      num(l.orden, 3, "ORDEN") +
      txt(r.tipoOperacion, 1, "TIPO OPERACIÓN") +
      num(l.codigo, 2, "Código de LESIÓN");
    if (linea.length !== LARGO.AL) throw new ErrorIntercambio(`.AL: largo ${linea.length}`);
    return linea;
  });
}

export function lineasAZ(r: RegistroDiagnostico, cart: string): string[] {
  return r.zonas.map((z) => {
    const linea =
      num(cart, 5, "CART") +
      num(r.numeroUnico, 10, "Número único de DIAGNÓSTICO") +
      num(z.orden, 3, "ORDEN") +
      txt(r.tipoOperacion, 1, "TIPO OPERACIÓN") +
      num(z.codigo, 3, "Código de zona del cuerpo");
    if (linea.length !== LARGO.AZ) throw new ErrorIntercambio(`.AZ: largo ${linea.length}`);
    return linea;
  });
}

export type ExtensionNueva = "AD" | "AL" | "AZ";

export interface ArchivoIntercambio {
  extension: ExtensionNueva;
  nombre: string;
  registros: number;
  contenido: string;
}

/**
 * Nombre según la convención ARTcartn.XXn del documento de la SRT
 * (n = número de parte, de 1 a 9).
 */
export function nombreArchivo(cart: string, extension: string, parte = 1): string {
  return `ART${cart}${parte}.${extension}${parte}`;
}

/** Genera los tres archivos nuevos para un conjunto de diagnósticos. Fin de línea CRLF. */
export function generarArchivos(registros: RegistroDiagnostico[], cart: string, parte = 1): ArchivoIntercambio[] {
  const ad = registros.map((r) => lineaAD(r, cart));
  const al = registros.flatMap((r) => lineasAL(r, cart));
  const az = registros.flatMap((r) => lineasAZ(r, cart));
  const armar = (extension: ExtensionNueva, lineas: string[]): ArchivoIntercambio => ({
    extension,
    nombre: nombreArchivo(cart, extension, parte),
    registros: lineas.length,
    contenido: lineas.length ? lineas.join("\r\n") + "\r\n" : "",
  });
  return [armar("AD", ad), armar("AL", al), armar("AZ", az)];
}

/** Separa una línea en sus campos según el layout (para mostrarla en pantalla). */
export function desarmarLinea(linea: string, layout: CampoLayout[]): Array<{ campo: string; valor: string }> {
  return layout.map((c) => ({ campo: c.campo, valor: linea.slice(c.desde - 1, c.hasta) }));
}
