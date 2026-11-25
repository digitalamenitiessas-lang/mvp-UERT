/**
 * Datos serializables que el panel del Área médica (servidor) les pasa a sus
 * diálogos (cliente).
 */
import type { CodigoExamen, EstadoDiagnostico, MotivoCitacion } from "@/lib/dominio/constantes";
import type { FechaISO } from "@/lib/dominio/fechas";

export interface CodigoDescripto {
  codigo: string;
  descripcion: string;
}

/** Diagnóstico tal como lo necesita el diálogo de evaluación. */
export interface DiagnosticoEvaluable {
  id: number;
  orden: number;
  estado: EstadoDiagnostico;
  cie10: string;
  cie10_descripcion: string;
  cie10_adecuado: string | null;
  agente_causante: string | null;
  agente_descripcion: string | null;
  patologia_constatada: boolean | null;
  en_listado: boolean | null;
  fecha_diagnostico: FechaISO | null;
  codigo_examen: CodigoExamen | null;
  observacion_medica: string | null;
  lesiones: CodigoDescripto[];
  zonas: CodigoDescripto[];
}

/** Citación a la que no asistió y que se puede reiterar (precarga el diálogo). */
export interface CitacionAReiterar {
  id: number;
  /** Fecha y hora original, ya formateada. */
  fecha: string;
  motivo: MotivoCitacion;
  lugar: string;
  detalle: string | null;
}

/**
 * Datos que exige la denuncia FODEP y que en un accidente son opcionales: si
 * faltan, el diálogo de reencuadre los pide.
 */
export type DatoFodep =
  | "telefono"
  | "email"
  | "domicilio_laboral"
  | "localidad_laboral_id"
  | "puesto"
  | "tareas"
  | "antiguedad_empresa"
  | "antiguedad_area";

/** Límites de fecha para una citación nueva (al menos 72 h de anticipación). */
export interface LimitesCitacion {
  /** Primer día hábil sugerido. */
  sugerida: FechaISO;
  /** Primer día posible (para el atributo min del campo). */
  minimaFecha: FechaISO;
  /** Momento mínimo, formateado 'dd/mm/aaaa HH:mm'. */
  minimaTexto: string;
}
