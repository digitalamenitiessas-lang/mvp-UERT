/**
 * Web Service FODEP de la SRT — SIMULADO.
 * Fuente: "Especificación Técnica del Web Service FODEP", v1.0 (borrador,
 * 19/10/2026).
 *
 * En el MVP no hay conexión real (falta el certificado x.509 y el WSDL). Este
 * módulo arma los mismos datos que se enviarían, aplica las validaciones que
 * documenta la SRT (códigos FOxx) y devuelve respuestas con la forma de las
 * reales. La conexión real reemplaza solo la función que "envía".
 */
import { MAX_DIAGNOSTICOS_EP } from "@/lib/dominio/constantes";
import type { FechaISO } from "@/lib/dominio/fechas";
import { esCuilValido, esCuitValido, esEmailValido } from "@/lib/dominio/validaciones";

export interface DenunciaFODEP {
  CodigoDenuncia?: number;
  NroDenuncia?: number;
  CuilTrabajador: string;
  NombreTrabajador: string;
  TelefonoTrabajador: string;
  EmailTrabajador: string;
  CuitEmpleador: string;
  DomicilioEmpleador: string;
  PisoEmp?: string | null;
  DptoEmp?: string | null;
  LocalidadIdEmp: number | null;
  ProvinciaIdEmp: number | null;
  Pluriempleo: boolean;
  CuitesPluriempleo?: string[] | null;
  ObligadaPago?: boolean | null;
  AntArea: string;
  AntEmpresa: string;
  Puesto: string;
  Tareas: string;
  ExposicionDesde: FechaISO | null;
  ExposicionHasta?: FechaISO | null;
  RecepcionDenuncia: FechaISO;
  IdEstadoActual?: number;
  FODEPrelacionado?: number | null;
}

export interface DiagnosticoFODEP {
  CIE10: string;
  AgenteCausante: string;
}

export interface ErrorFODEP {
  codigo: string;
  mensaje: string;
  campo?: string;
}

/** Tabla de errores del WS (sección 3.6.1), los que aplican al alta. */
export const ERRORES_FODEP = {
  FO01: "El CUIL no es válido.",
  FO09: "La Fecha de exposición Desde debe ser anterior o igual a la Hasta.",
  FO10: "La Fecha de recepción de la Denuncia debe ser menor o igual a hoy y mayor a 01/01/2026.",
  FO18: "El CIE10 no es válido.",
  FO19: "El agente causante no es válido.",
  FO21: "El CUIT no es válido.",
  FO23: "No se puede enviar más de 10 Diagnósticos.",
  FO24: "El estado indicado es de uso exclusivo de la SRT.",
  FO26: "El campo es obligatorio.",
  FO27: "El campo informado no posee un formato o longitud válida.",
  FO28: "Debe informar al menos un CUIT de pluriempleo cuando Pluriempleo es verdadero.",
  FO29: "No se deben informar CUITs de pluriempleo cuando Pluriempleo es falso.",
  FO30: "Debe informar ObligadaPago cuando Pluriempleo es verdadero.",
  FO31: "No se debe informar ObligadaPago cuando Pluriempleo es falso.",
} as const;

function error(codigo: keyof typeof ERRORES_FODEP, campo?: string): ErrorFODEP {
  return { codigo, mensaje: ERRORES_FODEP[codigo], campo };
}

export function validarDenunciaFODEP(d: DenunciaFODEP, hoyISO: FechaISO): ErrorFODEP[] {
  const errores: ErrorFODEP[] = [];
  const obligatorios: Array<keyof DenunciaFODEP> = [
    "CuilTrabajador",
    "NombreTrabajador",
    "TelefonoTrabajador",
    "EmailTrabajador",
    "CuitEmpleador",
    "DomicilioEmpleador",
    "LocalidadIdEmp",
    "ProvinciaIdEmp",
    "AntArea",
    "AntEmpresa",
    "Puesto",
    "Tareas",
    "ExposicionDesde",
    "RecepcionDenuncia",
  ];
  for (const campo of obligatorios) {
    const v = d[campo];
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
      errores.push(error("FO26", campo));
    }
  }
  if (d.CuilTrabajador && !esCuilValido(d.CuilTrabajador)) errores.push(error("FO01", "CuilTrabajador"));
  if (d.CuitEmpleador && !esCuitValido(d.CuitEmpleador)) errores.push(error("FO21", "CuitEmpleador"));
  if (d.EmailTrabajador && !esEmailValido(d.EmailTrabajador)) errores.push(error("FO27", "EmailTrabajador"));
  if (d.TelefonoTrabajador && !/^\d{6,15}$/.test(d.TelefonoTrabajador.replace(/\D/g, ""))) {
    errores.push(error("FO27", "TelefonoTrabajador"));
  }
  if (d.Puesto && d.Puesto.length > 250) errores.push(error("FO27", "Puesto"));
  if (d.ExposicionDesde && d.ExposicionHasta && d.ExposicionDesde > d.ExposicionHasta) {
    errores.push(error("FO09", "ExposicionHasta"));
  }
  if (d.RecepcionDenuncia && (d.RecepcionDenuncia > hoyISO || d.RecepcionDenuncia <= "2026-01-01")) {
    errores.push(error("FO10", "RecepcionDenuncia"));
  }
  const cuits = d.CuitesPluriempleo ?? [];
  if (d.Pluriempleo) {
    if (cuits.length === 0) errores.push(error("FO28", "CuitesPluriempleo"));
    if (d.ObligadaPago === null || d.ObligadaPago === undefined) errores.push(error("FO30", "ObligadaPago"));
    cuits.forEach((c) => {
      if (!esCuitValido(c)) errores.push(error("FO21", "CuitesPluriempleo"));
    });
  } else {
    if (cuits.length > 0) errores.push(error("FO29", "CuitesPluriempleo"));
    if (d.ObligadaPago !== null && d.ObligadaPago !== undefined) errores.push(error("FO31", "ObligadaPago"));
  }
  return errores;
}

export function validarDiagnosticosFODEP(
  diagnosticos: DiagnosticoFODEP[],
  catalogos: { cie10: ReadonlySet<string>; agentes: ReadonlySet<string> },
): ErrorFODEP[] {
  const errores: ErrorFODEP[] = [];
  if (diagnosticos.length === 0) errores.push(error("FO26", "Diagnosticos"));
  if (diagnosticos.length > MAX_DIAGNOSTICOS_EP) errores.push(error("FO23", "Diagnosticos"));
  diagnosticos.forEach((dx, i) => {
    if (!catalogos.cie10.has(dx.CIE10)) errores.push(error("FO18", `Diagnosticos[${i}].CIE10`));
    if (!catalogos.agentes.has(dx.AgenteCausante)) errores.push(error("FO19", `Diagnosticos[${i}].AgenteCausante`));
  });
  // FO22 (relación CIE-10 / agente causante) queda pendiente: falta la tabla de la SRT.
  return errores;
}

/** Datos que se mostrarían como "Error SoapException" en el sistema real. */
export function describirErrores(errores: ErrorFODEP[]): string {
  return errores.map((e) => `${e.codigo}${e.campo ? ` (${e.campo})` : ""}: ${e.mensaje}`).join(" · ");
}
