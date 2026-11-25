/**
 * Documentación a adjuntar según el tipo de denuncia.
 * Fuente: relevamiento de Informática de Casa de Gobierno (tabla "Documentos a
 * adjuntar según el tipo de denuncia"). Para in itinere el relevamiento solo
 * confirma la Declaración Jurada de Trayecto: el resto queda a confirmar.
 */
import type { TipoDenuncia } from "./constantes";

export type Exigencia = "obligatorio" | "si_corresponde";

export interface TipoDocumento {
  clave: string;
  nombre: string;
  /** Exigencia en la recepción, por tipo de denuncia. Si no figura, no se pide en la recepción. */
  exige?: Partial<Record<TipoDenuncia, Exigencia>>;
  aclaracion?: string;
}

export const TIPOS_DOCUMENTO: readonly TipoDocumento[] = [
  { clave: "dni", nombre: "DNI frente y dorso", exige: { AT: "obligatorio", EP: "obligatorio" } },
  { clave: "recibo_haberes", nombre: "Último recibo de haberes", exige: { AT: "obligatorio", EP: "obligatorio" } },
  {
    clave: "certificacion_autoridad",
    nombre: "Certificación de la autoridad competente",
    exige: { AT: "obligatorio", EP: "obligatorio" },
  },
  {
    clave: "certificado_medico",
    nombre: "Certificado médico, historia clínica y reseña del tratamiento",
    exige: { AT: "obligatorio", EP: "obligatorio" },
  },
  { clave: "formulario_anexo1", nombre: "Formulario Anexo 1", exige: { AT: "obligatorio" } },
  {
    clave: "antecedentes_medicos",
    nombre: "Formulario de Antecedentes Médicos",
    exige: { AT: "obligatorio", EP: "obligatorio" },
  },
  {
    clave: "comision_servicio",
    nombre: "Resolución de comisión de servicio",
    exige: { AT: "si_corresponde" },
    aclaracion: "Si el accidente ocurrió en comisión de servicio.",
  },
  { clave: "dj_trayecto", nombre: "Declaración Jurada de Trayecto", exige: { IT: "obligatorio" } },
  {
    clave: "regimen_incompatibilidad",
    nombre: "Régimen de Incompatibilidad",
    exige: { EP: "si_corresponde" },
    aclaracion: "Solo docentes.",
  },
  {
    clave: "fodep",
    nombre: "Formulario de Denuncia de Enfermedad Profesional (FODEP) firmado",
    exige: { EP: "obligatorio" },
  },
  // Documentos que se suman durante el trámite
  { clave: "cymat", nombre: "Relevamiento CYMAT", aclaracion: "Obligatorio para rechazar por ausencia de exposición." },
  { clave: "estudios", nombre: "Estudios médicos complementarios" },
  { clave: "certificado_control", nombre: "Certificado médico de control" },
  { clave: "orden_practicas", nombre: "Pedido de kinesiología, cirugía, prótesis u otras prácticas" },
  { clave: "carta_documento", nombre: "Carta documento / notificación enviada" },
  { clave: "otro", nombre: "Otro documento" },
];

export const TIPO_DOCUMENTO_POR_CLAVE: Record<string, TipoDocumento> = Object.fromEntries(
  TIPOS_DOCUMENTO.map((t) => [t.clave, t]),
);

export function nombreDocumento(clave: string): string {
  return TIPO_DOCUMENTO_POR_CLAVE[clave]?.nombre ?? clave;
}

/** Documentos que se piden al recibir una denuncia de ese tipo. */
export function documentosDeRecepcion(tipo: TipoDenuncia): Array<TipoDocumento & { exigencia: Exigencia }> {
  return TIPOS_DOCUMENTO.filter((t) => t.exige?.[tipo]).map((t) => ({ ...t, exigencia: t.exige![tipo]! }));
}

/** Claves obligatorias que faltan entre las presentadas. */
export function documentosFaltantes(tipo: TipoDenuncia, presentadas: Iterable<string>): TipoDocumento[] {
  const set = new Set(presentadas);
  return documentosDeRecepcion(tipo).filter((d) => d.exigencia === "obligatorio" && !set.has(d.clave));
}

export const AVISO_IN_ITINERE =
  "Para in itinere el relevamiento solo confirma la Declaración Jurada de Trayecto. El resto de la documentación queda a confirmar con la UERT.";
