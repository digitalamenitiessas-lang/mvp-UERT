/**
 * Cálculos de la ILT (incapacidad laboral temporaria) para la bandeja y la
 * ficha. Puro: sirve en el servidor y en el navegador.
 *
 * - Días de licencia: desde el inicio de la inasistencia (o el siniestro).
 * - Tope: 365 días corridos desde el siniestro o la primera manifestación
 *   (Ley 24.557, art. 7; RF-22), igual que `plazosDe` y `darAlta`.
 */
import { PLAZOS } from "@/lib/dominio/constantes";
import { diasEntre, sumarDias, type FechaISO, type NivelPlazo } from "@/lib/dominio/fechas";

export interface ResumenIlt {
  /** Inicio de la licencia: el inicio de la inasistencia o, si falta, el siniestro. */
  inicio: FechaISO | null;
  /** Días de licencia hasta la fecha de corte (hoy o el alta). */
  dias: number | null;
  /** Desde cuándo corre el año de la ILT (siniestro o primera manifestación). */
  base: FechaISO | null;
  /** Fecha tope: base + 365 días. */
  tope: FechaISO | null;
  /** Días del año ya transcurridos. */
  transcurridos: number | null;
  /** Días que faltan para el tope (negativo si ya pasó). */
  restantes: number | null;
  /** Porcentaje del año transcurrido (0 a 100). */
  porcentaje: number;
}

export function resumenIlt(
  exp: { fecha_inicio_inasistencia: FechaISO | null; fecha_ocurrencia: FechaISO | null },
  hasta: FechaISO,
): ResumenIlt {
  const inicio = exp.fecha_inicio_inasistencia ?? exp.fecha_ocurrencia;
  const base = exp.fecha_ocurrencia ?? exp.fecha_inicio_inasistencia;
  const tope = base ? sumarDias(base, PLAZOS.topeIltDias) : null;
  const transcurridos = base ? Math.max(0, diasEntre(base, hasta)) : null;
  return {
    inicio,
    dias: inicio ? Math.max(0, diasEntre(inicio, hasta)) : null,
    base,
    tope,
    transcurridos,
    restantes: tope ? diasEntre(hasta, tope) : null,
    porcentaje: transcurridos === null ? 0 : Math.min(100, Math.round((transcurridos / PLAZOS.topeIltDias) * 100)),
  };
}

/** Color del indicador de <Progress> según la urgencia del tope. */
export const CLASE_BARRA_NIVEL: Record<NivelPlazo, string> = {
  vencido: "*:data-[slot=progress-indicator]:bg-red-600",
  hoy: "*:data-[slot=progress-indicator]:bg-orange-500",
  proximo: "*:data-[slot=progress-indicator]:bg-amber-500",
  en_termino: "*:data-[slot=progress-indicator]:bg-primary",
};

/** Texto corto de lo que falta para el tope. */
export function textoRestante(restantes: number | null): string {
  if (restantes === null) return "—";
  if (restantes > 1) return `Faltan ${restantes} días`;
  if (restantes === 1) return "Falta 1 día";
  if (restantes === 0) return "Se cumple hoy";
  return `Superado hace ${Math.abs(restantes)} ${Math.abs(restantes) === 1 ? "día" : "días"}`;
}
