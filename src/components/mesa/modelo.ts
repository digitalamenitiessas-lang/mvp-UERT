/**
 * Modelo del formulario de denuncia de Mesa de entrada: valores vacíos,
 * solapas, en qué solapa se carga cada campo y armado de los datos que se
 * envían. Sin dependencias de servidor: lo usan los componentes de cliente.
 */
import type { TipoDenuncia } from "@/lib/dominio/constantes";
import { documentosDeRecepcion } from "@/lib/dominio/documentos";
import { esCuilValido, soloDigitos } from "@/lib/dominio/validaciones";
import { esquemaNuevaDenuncia, type NuevaDenuncia, type NuevaDenunciaEntrada } from "@/lib/esquemas";

export type Entrada = NuevaDenunciaEntrada;

/** Valores del formulario antes de elegir el tipo de denuncia. */
export type ValoresFormulario = Omit<Entrada, "tipo"> & { tipo?: TipoDenuncia };

export type ModoFormulario = "nueva" | "editar";

export type ClaveSolapa = "trabajador" | "denunciante" | "laboral" | "hecho" | "diagnosticos" | "documentacion";

/** Ubicación de un campo: el paso 1 ("persona") o una de las solapas del formulario. */
export type Ubicacion = ClaveSolapa | "persona";

export function solapasDe(modo: ModoFormulario): ClaveSolapa[] {
  const todas: ClaveSolapa[] = ["trabajador", "denunciante", "laboral", "hecho", "diagnosticos", "documentacion"];
  // La documentación de una denuncia ya registrada se maneja desde la ficha.
  return modo === "nueva" ? todas : todas.filter((s) => s !== "documentacion");
}

export function nombreSolapa(clave: ClaveSolapa, tipo: TipoDenuncia | undefined): string {
  switch (clave) {
    case "trabajador":
      return "Trabajador/a";
    case "denunciante":
      return "Denunciante y canal";
    case "laboral":
      return "Datos laborales";
    case "hecho":
      return tipo === "EP" ? "La enfermedad" : "El accidente";
    case "diagnosticos":
      return "Diagnósticos";
    case "documentacion":
      return "Documentación";
  }
}

export const UBICACION_CAMPO = {
  tipo: "persona",
  origen_id: "persona",
  es_intercurrencia: "persona",
  confirmo_hecho_distinto: "persona",
  cuil: "trabajador",
  dni: "trabajador",
  apellido: "trabajador",
  nombres: "trabajador",
  fecha_nacimiento: "trabajador",
  sexo: "trabajador",
  telefono: "trabajador",
  email: "trabajador",
  domicilio: "trabajador",
  localidad_id: "trabajador",
  canal: "denunciante",
  denunciante_tipo: "denunciante",
  denunciante_nombre: "denunciante",
  denunciante_email: "denunciante",
  denunciante_telefono: "denunciante",
  reparticion: "laboral",
  domicilio_laboral: "laboral",
  localidad_laboral_id: "laboral",
  puesto: "laboral",
  ciuo: "laboral",
  tareas: "laboral",
  antiguedad_empresa: "laboral",
  antiguedad_area: "laboral",
  desvinculado: "laboral",
  fecha_ocurrencia: "hecho",
  hora_ocurrencia: "hecho",
  lugar_ocurrencia: "hecho",
  localidad_ocurrencia_id: "hecho",
  descripcion: "hecho",
  forma_accidente: "hecho",
  agente_material: "hecho",
  trayecto: "hecho",
  pluriempleo: "hecho",
  cuits_pluriempleo: "hecho",
  obligada_pago: "hecho",
  exposicion_desde: "hecho",
  exposicion_hasta: "hecho",
  diagnosticos: "diagnosticos",
  documentos: "documentacion",
} as const satisfies Record<keyof Entrada, Ubicacion>;

export function ubicacionDe(campo: PropertyKey | undefined): Ubicacion {
  return (UBICACION_CAMPO as Record<PropertyKey, Ubicacion>)[campo ?? ""] ?? "trabajador";
}

/** Primera solapa (en el orden del formulario) que tiene alguno de estos campos. */
export function primeraSolapaCon(campos: Iterable<string>, solapas: ClaveSolapa[]): ClaveSolapa | null {
  const conError = new Set([...campos].map((c) => ubicacionDe(c.split(".")[0])));
  return solapas.find((s) => conError.has(s)) ?? null;
}

export function valoresVacios(): ValoresFormulario {
  return {
    cuil: "",
    dni: "",
    apellido: "",
    nombres: "",
    fecha_nacimiento: "",
    sexo: "",
    telefono: "",
    email: "",
    domicilio: "",
    localidad_id: null,
    canal: "presencial",
    denunciante_tipo: "trabajador",
    denunciante_nombre: "",
    denunciante_email: "",
    denunciante_telefono: "",
    reparticion: "",
    domicilio_laboral: "",
    localidad_laboral_id: null,
    puesto: "",
    ciuo: "",
    tareas: "",
    antiguedad_empresa: "",
    antiguedad_area: "",
    desvinculado: false,
    fecha_ocurrencia: "",
    hora_ocurrencia: "",
    lugar_ocurrencia: "",
    localidad_ocurrencia_id: null,
    descripcion: "",
    forma_accidente: "",
    agente_material: "",
    trayecto: "",
    pluriempleo: false,
    cuits_pluriempleo: [],
    obligada_pago: null,
    exposicion_desde: "",
    exposicion_hasta: "",
    diagnosticos: [],
    documentos: [],
    origen_id: null,
    es_intercurrencia: false,
    confirmo_hecho_distinto: false,
  };
}

/** Campos de la persona que se precargan cuando ya está registrada. */
export const CAMPOS_PERSONA = [
  "apellido",
  "nombres",
  "fecha_nacimiento",
  "sexo",
  "telefono",
  "email",
  "domicilio",
  "localidad_id",
] as const;

/** Problemas de validación por paso o solapa, con los valores tal como están. */
export function problemasPorUbicacion(valores: unknown): Record<Ubicacion, number> {
  const cuenta: Record<Ubicacion, number> = {
    persona: 0,
    trabajador: 0,
    denunciante: 0,
    laboral: 0,
    hecho: 0,
    diagnosticos: 0,
    documentacion: 0,
  };
  const r = esquemaNuevaDenuncia.safeParse(valores);
  if (r.success) return cuenta;
  // Un mismo campo puede tener varios avisos (p. ej. varios CUIT inválidos): se cuenta una vez.
  const vistos = new Set<string>();
  for (const issue of r.error.issues) {
    const clave = issue.path.join(".");
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    cuenta[ubicacionDe(issue.path[0])]++;
  }
  return cuenta;
}

/**
 * Deja solo los datos que corresponden al tipo de denuncia (si se cambió el
 * tipo a mitad de la carga pueden quedar campos de otro tipo).
 */
export function armarDatos(d: NuevaDenuncia, modo: ModoFormulario): Entrada {
  const esEP = d.tipo === "EP";
  const esIT = d.tipo === "IT";
  const delTipo = new Set(documentosDeRecepcion(d.tipo).map((t) => t.clave));
  delTipo.add("otro");
  const conDenunciante = d.denunciante_tipo !== "trabajador";
  return {
    ...d,
    denunciante_nombre: conDenunciante ? d.denunciante_nombre : "",
    denunciante_email: conDenunciante ? d.denunciante_email : "",
    denunciante_telefono: conDenunciante ? d.denunciante_telefono : "",
    hora_ocurrencia: esEP ? "" : d.hora_ocurrencia,
    lugar_ocurrencia: esEP ? "" : d.lugar_ocurrencia,
    localidad_ocurrencia_id: esEP ? null : d.localidad_ocurrencia_id,
    forma_accidente: esEP ? "" : d.forma_accidente,
    agente_material: esEP ? "" : d.agente_material,
    trayecto: esIT ? d.trayecto : "",
    pluriempleo: esEP ? d.pluriempleo : false,
    cuits_pluriempleo: esEP && d.pluriempleo ? d.cuits_pluriempleo.map(soloDigitos).filter(Boolean) : [],
    obligada_pago: esEP && d.pluriempleo ? d.obligada_pago : null,
    exposicion_desde: esEP ? d.exposicion_desde : "",
    exposicion_hasta: esEP ? d.exposicion_hasta : "",
    diagnosticos: d.diagnosticos.map((dx) => ({ cie10: dx.cie10, agente_causante: esEP ? dx.agente_causante : "" })),
    documentos: modo === "nueva" ? d.documentos.filter((doc) => delTipo.has(doc.tipo)) : [],
  };
}

/** CUIT/CUIL con guiones mientras se escribe: '20-99000101-3'. */
export function formatearCuit(valor: string): string {
  const d = soloDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** DNI que surge de un CUIL válido (los 8 dígitos centrales, sin ceros a la izquierda). */
export function dniDesdeCuil(cuil: string): string | null {
  const d = soloDigitos(cuil);
  if (!esCuilValido(d)) return null;
  return String(Number(d.slice(2, 10)));
}

/** Clave de una etiqueta de catálogo ya conocida (para mostrar descripciones). */
export function claveEtiqueta(catalogo: string, codigo: string | number): string {
  return `${catalogo}:${codigo}`;
}

export const TIPO_EXPLICACION: Record<TipoDenuncia, string> = {
  EP: "Patología causada por la exposición a agentes de riesgo en el trabajo. Se informa a la SRT con el formulario FODEP.",
  AT: "Hecho súbito y violento ocurrido por el hecho o en ocasión del trabajo.",
  IT: "Accidente en el trayecto entre el domicilio y el lugar de trabajo, o al revés.",
};

export const SEXO_INFO = { F: "Femenino", M: "Masculino", X: "X (no binario)" } as const;
