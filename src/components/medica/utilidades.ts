/**
 * Ayudas de presentación del Área médica (puras: sirven en servidor y cliente).
 */
import { diasEntre, fechaDe } from "@/lib/dominio/fechas";

/** Lugar habitual de las citaciones. */
export const LUGAR_CITACION = "Consultorio de la UERT, Av. Belgrano Sur 1150";

/** "Hoy", "Mañana", "En 3 días", "Ayer", "Hace 2 días" (días corridos, hora de Argentina). */
export function cuandoRelativo(momento: Date | string, ahora: Date): string {
  const d = diasEntre(fechaDe(ahora), fechaDe(new Date(momento)));
  if (d === 0) return "Hoy";
  if (d === 1) return "Mañana";
  if (d === -1) return "Ayer";
  return d > 1 ? `En ${d} días` : `Hace ${-d} días`;
}

/** ¿La fecha y hora ya pasó? */
export function yaPaso(momento: Date | string, ahora: Date): boolean {
  return new Date(momento).getTime() < ahora.getTime();
}

/** Clases de las etiquetas propias del área (Tailwind las detecta en este archivo). */
export const TONO = {
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
  ambar: "bg-amber-50 text-amber-800 ring-amber-600/25",
  naranja: "bg-orange-50 text-orange-800 ring-orange-600/25",
  rojo: "bg-red-50 text-red-800 ring-red-600/20",
  azul: "bg-sky-50 text-sky-800 ring-sky-600/20",
  turquesa: "bg-teal-50 text-teal-800 ring-teal-600/20",
  gris: "bg-zinc-50 text-zinc-700 ring-zinc-500/20",
} as const;
