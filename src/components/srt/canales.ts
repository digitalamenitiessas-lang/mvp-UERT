/**
 * Canales por los que el sistema se comunica con la SRT, el trabajador y el
 * empleador. En la demo todos son simulados (ver src/lib/operaciones/srt.ts).
 *
 * Las clases de Tailwind van completas a propósito para que Tailwind v4 las
 * detecte al leer este archivo.
 */
import type { ComunicacionSRT } from "@/lib/tipos";

export type CanalSrt = ComunicacionSRT["canal"];

export const CANAL_SRT: Record<
  CanalSrt,
  { nombre: string; corto: string; destino: string; descripcion: string; badge: string }
> = {
  ws_fodep: {
    nombre: "Web Service FODEP",
    corto: "WS FODEP",
    destino: "SRT",
    descripcion: "Alta de la denuncia de enfermedad profesional, de sus diagnósticos y de los cambios de estado.",
    badge: "bg-blue-50 text-blue-800 ring-blue-600/20",
  },
  eservicios: {
    nombre: "e-Servicios SRT",
    corto: "e-Servicios",
    destino: "Trabajador/a",
    descripcion: "Notificaciones al trabajador por e-Servicios SRT y al email informado en el formulario.",
    badge: "bg-teal-50 text-teal-800 ring-teal-600/20",
  },
  ventanilla: {
    nombre: "Ventanilla Electrónica",
    corto: "Ventanilla",
    destino: "Empleador",
    descripcion: "Notificaciones al empleador por Ventanilla Electrónica.",
    badge: "bg-indigo-50 text-indigo-800 ring-indigo-600/20",
  },
  intercambio: {
    nombre: "Sistema de Intercambio",
    corto: "Intercambio",
    destino: "SRT",
    descripcion: "Archivos .AD, .AL y .AZ con los diagnósticos, las lesiones y las zonas del cuerpo.",
    badge: "bg-slate-100 text-slate-700 ring-slate-500/20",
  },
};

/** Lee un campo de texto de un request/response guardado como JSON. */
export function campoTexto(valor: unknown, campo: string): string | null {
  if (!valor || typeof valor !== "object") return null;
  const v = (valor as Record<string, unknown>)[campo];
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number") return String(v);
  return null;
}

export interface ErrorSoap {
  codigo: string;
  mensaje: string;
  campo: string | null;
}

/** Errores FOxx de una respuesta SoapException simulada. */
export function erroresSoap(response: unknown): ErrorSoap[] {
  if (!response || typeof response !== "object") return [];
  const lista = (response as Record<string, unknown>).SoapException;
  if (!Array.isArray(lista)) return [];
  return lista.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const r = e as Record<string, unknown>;
    return [
      {
        codigo: typeof r.ErrorNumber === "string" ? r.ErrorNumber : "Error",
        mensaje: typeof r.ErrorMessage === "string" ? r.ErrorMessage : "",
        campo: typeof r.Campo === "string" ? r.Campo : null,
      },
    ];
  });
}
