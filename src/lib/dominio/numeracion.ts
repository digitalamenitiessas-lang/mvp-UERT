/**
 * Número de siniestro (Res. SRT 3326/14, RF-23/RF-24).
 *
 * Para la SRT es un número de 20 posiciones:
 *   8 de uso libre + año de denuncia (4) + contador (6) + sufijo (2).
 * El sufijo identifica el caso: 00 el siniestro, 01 el 1.er reingreso, etc.
 * En pantalla se muestra como AAAA-NNNNNN-SS (igual que el sistema anterior).
 */
import { UERT } from "./constantes";

export function numeroExpediente(anio: number, contador: number, sufijo: number): string {
  return `${anio}-${String(contador).padStart(6, "0")}-${String(sufijo).padStart(2, "0")}`;
}

export function numeroSiniestroSRT(
  anio: number,
  contador: number,
  sufijo: number,
  prefijo: string = UERT.prefijoSiniestro,
): string {
  const n = `${prefijo.padStart(8, "0")}${anio}${String(contador).padStart(6, "0")}${String(sufijo).padStart(2, "0")}`;
  if (n.length !== 20) throw new Error(`Número de siniestro inválido: ${n}`);
  return n;
}

/** '2026-000123-01' → { anio: 2026, contador: 123, sufijo: 1 } */
export function parsearNumero(numero: string): { anio: number; contador: number; sufijo: number } | null {
  const m = /^(\d{4})-(\d{6})-(\d{2})$/.exec(numero.trim());
  if (!m) return null;
  return { anio: Number(m[1]), contador: Number(m[2]), sufijo: Number(m[3]) };
}
