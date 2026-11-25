/**
 * Motivos de rechazo que corresponden a cada expediente.
 *
 * Replica la regla de `motivoPermitido` (src/lib/operaciones/legal.ts), que
 * vuelve a controlarla en el servidor: EP → E, P y L; AT e in itinere → R;
 * reingresos → además D. Es puro para poder usarlo en el navegador.
 */
import {
  MOTIVO_RECHAZO_INFO,
  MOTIVOS_RECHAZO,
  type MotivoRechazo,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";

export interface ExpedienteParaMotivos {
  tipo: TipoDenuncia;
  es_reingreso: boolean;
}

export function motivoPermitido(exp: ExpedienteParaMotivos, motivo: MotivoRechazo): boolean {
  const aplica = MOTIVO_RECHAZO_INFO[motivo].aplica;
  if (aplica === "EP") return exp.tipo === "EP";
  if (aplica === "REINGRESO") return exp.es_reingreso;
  return exp.tipo === "AT" || exp.tipo === "IT";
}

/** Motivos permitidos, en el orden oficial (R, D, E, P, L). */
export function motivosPermitidos(exp: ExpedienteParaMotivos): MotivoRechazo[] {
  return MOTIVOS_RECHAZO.filter((m) => motivoPermitido(exp, m));
}

/** A qué denuncias aplica cada motivo, para mostrarlo en la interfaz. */
export const APLICA_TEXTO: Record<(typeof MOTIVO_RECHAZO_INFO)[MotivoRechazo]["aplica"], string> = {
  AT_IT: "Accidentes de trabajo e in itinere",
  EP: "Enfermedades profesionales",
  REINGRESO: "Reingresos",
};

/** Clases de la etiqueta de un motivo de rechazo. */
export const CLASE_MOTIVO = "bg-red-50 font-mono text-red-800 ring-red-600/20";
