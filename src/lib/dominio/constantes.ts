/**
 * Vocabulario del dominio: roles, tipos de denuncia, estados, motivos y
 * plazos. Todo texto que ve el usuario sale de acá para que las pantallas
 * hablen igual en todos lados.
 *
 * Las clases de Tailwind se escriben completas a propósito: Tailwind v4 las
 * detecta leyendo este archivo.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const ROLES = ["mesa_entrada", "medico", "legal", "seguimiento", "direccion", "admin"] as const;
export type Rol = (typeof ROLES)[number];

export const ROL_INFO: Record<
  Rol,
  { nombre: string; submodulo: string; descripcion: string; inicio: string; badge: string; punto: string }
> = {
  mesa_entrada: {
    nombre: "Mesa de entrada",
    submodulo: "Submódulo 1",
    descripcion:
      "Recibe la denuncia, digitaliza la documentación, emite la constancia de recepción y la pasa al área médica.",
    inicio: "/mesa",
    badge: "bg-sky-50 text-sky-800 ring-sky-600/20",
    punto: "bg-sky-500",
  },
  medico: {
    nombre: "Área médica",
    submodulo: "Submódulo 1",
    descripcion:
      "Evalúa cada diagnóstico, cita al trabajador, define si hay baja laboral y completa los datos que se informan a la SRT.",
    inicio: "/medica",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    punto: "bg-emerald-500",
  },
  legal: {
    nombre: "Área legal",
    submodulo: "Submódulo 2",
    descripcion:
      "Dentro del plazo de 10 días hábiles acepta o rechaza cada diagnóstico y emite la notificación del rechazo.",
    inicio: "/legal",
    badge: "bg-violet-50 text-violet-800 ring-violet-600/20",
    punto: "bg-violet-500",
  },
  seguimiento: {
    nombre: "Seguimiento de licencias",
    submodulo: "Submódulo 3",
    descripcion:
      "Controla las presentaciones de la licencia, sus vencimientos, las intercurrencias y el alta médica.",
    inicio: "/seguimiento",
    badge: "bg-amber-50 text-amber-800 ring-amber-600/20",
    punto: "bg-amber-500",
  },
  direccion: {
    nombre: "Dirección",
    submodulo: "Supervisión",
    descripcion: "Ve el estado de todos los expedientes, los plazos vencidos y las comunicaciones con la SRT.",
    inicio: "/direccion",
    badge: "bg-slate-100 text-slate-800 ring-slate-600/20",
    punto: "bg-slate-500",
  },
  admin: {
    nombre: "Administración",
    submodulo: "Sistema",
    descripcion: "Administra usuarios, consulta los catálogos y puede reiniciar los datos de la demo.",
    inicio: "/admin",
    badge: "bg-zinc-100 text-zinc-800 ring-zinc-600/20",
    punto: "bg-zinc-500",
  },
};

// ---------------------------------------------------------------------------
// Tipos de denuncia
// ---------------------------------------------------------------------------
export const TIPOS = ["EP", "AT", "IT"] as const;
export type TipoDenuncia = (typeof TIPOS)[number];

export const TIPO_INFO: Record<TipoDenuncia, { nombre: string; corto: string; badge: string; extension: "EF" | "AT" }> = {
  EP: {
    nombre: "Enfermedad profesional",
    corto: "EP",
    badge: "bg-rose-50 text-rose-800 ring-rose-600/20",
    extension: "EF",
  },
  AT: {
    nombre: "Accidente de trabajo",
    corto: "AT",
    badge: "bg-blue-50 text-blue-800 ring-blue-600/20",
    extension: "AT",
  },
  IT: {
    nombre: "Accidente in itinere",
    corto: "In itinere",
    badge: "bg-indigo-50 text-indigo-800 ring-indigo-600/20",
    extension: "AT",
  },
};

// ---------------------------------------------------------------------------
// Estados del expediente
// ---------------------------------------------------------------------------
export const ESTADOS = [
  "recepcion",
  "evaluacion_medica",
  "dictamen_legal",
  "licencia_activa",
  "sin_baja",
  "alta",
  "rechazado",
  "desistido",
  "cerrado",
] as const;
export type EstadoExpediente = (typeof ESTADOS)[number];

export const ESTADO_INFO: Record<
  EstadoExpediente,
  { nombre: string; abierto: boolean; area: Rol | null; badge: string; descripcion: string }
> = {
  recepcion: {
    nombre: "En Mesa de entrada",
    abierto: true,
    area: "mesa_entrada",
    badge: "bg-sky-50 text-sky-800 ring-sky-600/20",
    descripcion: "Recibida. Falta controlar la documentación y pasarla al área médica.",
  },
  evaluacion_medica: {
    nombre: "En evaluación médica",
    abierto: true,
    area: "medico",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    descripcion: "El área médica evalúa cada diagnóstico y define si hay baja laboral.",
  },
  dictamen_legal: {
    nombre: "En dictamen legal",
    abierto: true,
    area: "legal",
    badge: "bg-violet-50 text-violet-800 ring-violet-600/20",
    descripcion: "El área legal tiene 10 días hábiles para aceptar o rechazar cada diagnóstico.",
  },
  licencia_activa: {
    nombre: "Licencia activa",
    abierto: true,
    area: "seguimiento",
    badge: "bg-amber-50 text-amber-800 ring-amber-600/20",
    descripcion: "Aceptada con baja laboral. Se controlan las presentaciones hasta el alta.",
  },
  sin_baja: {
    nombre: "Aceptado sin baja",
    abierto: true,
    area: "seguimiento",
    badge: "bg-teal-50 text-teal-800 ring-teal-600/20",
    descripcion: "Aceptada sin baja laboral: hay 20 días para presentar el trámite ante la Comisión Médica.",
  },
  alta: {
    nombre: "Alta médica",
    abierto: false,
    area: null,
    badge: "bg-green-50 text-green-800 ring-green-600/20",
    descripcion: "Licencia finalizada con alta médica. Puede rehabilitarse como reingreso.",
  },
  rechazado: {
    nombre: "Rechazado",
    abierto: false,
    area: null,
    badge: "bg-red-50 text-red-800 ring-red-600/20",
    descripcion: "Todos los diagnósticos fueron rechazados y se notificó al trabajador.",
  },
  desistido: {
    nombre: "Desistido",
    abierto: false,
    area: null,
    badge: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
    descripcion: "Asentamiento de Actuaciones Previas: no se configuró o caducó. No es un rechazo.",
  },
  cerrado: {
    nombre: "Cerrado",
    abierto: false,
    area: null,
    badge: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
    descripcion: "Trámite terminado: se presentó ante la Comisión Médica.",
  },
};

/** Etapas del circuito, en orden, para el indicador visual de avance. */
export const ETAPAS_CIRCUITO = [
  { clave: "recepcion", nombre: "Recepción", rol: "mesa_entrada" },
  { clave: "evaluacion_medica", nombre: "Área médica", rol: "medico" },
  { clave: "dictamen_legal", nombre: "Área legal", rol: "legal" },
  { clave: "licencia", nombre: "Licencia", rol: "seguimiento" },
  { clave: "cierre", nombre: "Cierre", rol: null },
] as const;

// ---------------------------------------------------------------------------
// Diagnósticos
// ---------------------------------------------------------------------------
export const ESTADOS_DIAGNOSTICO = ["invocado", "evaluado", "aceptado", "rechazado", "desistido"] as const;
export type EstadoDiagnostico = (typeof ESTADOS_DIAGNOSTICO)[number];

export const ESTADO_DIAGNOSTICO_INFO: Record<EstadoDiagnostico, { nombre: string; badge: string }> = {
  invocado: { nombre: "Pendiente de evaluación", badge: "bg-zinc-100 text-zinc-700 ring-zinc-500/20" },
  evaluado: { nombre: "Evaluado", badge: "bg-emerald-50 text-emerald-800 ring-emerald-600/20" },
  aceptado: { nombre: "Aceptado", badge: "bg-green-50 text-green-800 ring-green-600/20" },
  rechazado: { nombre: "Rechazado", badge: "bg-red-50 text-red-800 ring-red-600/20" },
  desistido: { nombre: "Desistido", badge: "bg-zinc-100 text-zinc-600 ring-zinc-500/20" },
};

/** Hasta 10 diagnósticos por denuncia de EP (WS FODEP, error FO23). */
export const MAX_DIAGNOSTICOS_EP = 10;

export const MOTIVOS_RECHAZO = ["R", "D", "E", "P", "L"] as const;
export type MotivoRechazo = (typeof MOTIVOS_RECHAZO)[number];

export const MOTIVO_RECHAZO_INFO: Record<
  MotivoRechazo,
  { nombre: string; detalle: string; aplica: "AT_IT" | "EP" | "REINGRESO" }
> = {
  R: {
    nombre: "Rechazo de la denuncia",
    detalle: "En los términos del art. 6°, apartados 2 y 3 de la Ley N° 24.557 y del art. 6° del Decreto 717/96.",
    aplica: "AT_IT",
  },
  D: {
    nombre: "Reingreso denegado",
    detalle: "Reingreso denegado por ratificación del alta inmediata anterior.",
    aplica: "REINGRESO",
  },
  E: {
    nombre: "Ausencia de exposición a agentes de riesgo",
    detalle:
      "Patología de carácter inculpable en razón de la ausencia de exposición. Exige adjuntar el relevamiento CYMAT.",
    aplica: "EP",
  },
  P: {
    nombre: "Ausencia de patología según exámenes",
    detalle:
      "Patología inculpable o ausencia de patología según los exámenes practicados (Anexo III, estudios mínimos). Hay que precisar los estudios.",
    aplica: "EP",
  },
  L: {
    nombre: "Patología no incluida en el Listado",
    detalle:
      "Patología no incluida en el Listado de Enfermedades Profesionales (Decreto N° 658/96). El trabajador puede instar el trámite ante la Comisión Médica.",
    aplica: "EP",
  },
};

export const CODIGOS_EXAMEN = ["P", "R", "E", "A", "T", "O", "N", "H", "M", "J", "S", "B", "F"] as const;
export type CodigoExamen = (typeof CODIGOS_EXAMEN)[number];
export const CODIGO_EXAMEN_INFO: Record<CodigoExamen, string> = {
  P: "Preocupacional",
  R: "Periódico",
  E: "Egreso",
  A: "Ausencia prolongada",
  T: "Transferencia",
  O: "Obra social",
  N: "Consultorio privado",
  H: "Hospital público",
  M: "Ámbito público no hospitalario",
  J: "Peritaje judicial",
  S: "Comisión Médica",
  B: "Prestador ART",
  F: "FODEP",
};
/** Con estos códigos el ID_FODEP no es obligatorio en el archivo .AD. */
export const CODIGOS_EXAMEN_SIN_FODEP: readonly CodigoExamen[] = ["P", "R", "A", "E", "T"];

// ---------------------------------------------------------------------------
// Recepción, desistimiento, citaciones, licencia
// ---------------------------------------------------------------------------
export const DENUNCIANTE_INFO = {
  trabajador: "El trabajador",
  empleador: "El empleador (servicio de medicina laboral)",
  derechohabiente: "Un derechohabiente",
  otro: "Otra persona",
} as const;
export type TipoDenunciante = keyof typeof DENUNCIANTE_INFO;

export const CANAL_INFO = { presencial: "Presencial (carga asistida)", digital: "Digital" } as const;
export type Canal = keyof typeof CANAL_INFO;

export const DESISTIMIENTO_INFO = {
  falta_cobertura: "Falta de cobertura",
  relacion_no_corroborada: "Relación laboral no corroborada",
  inconsistencia_diagnostico: "Inconsistencia en el diagnóstico",
  incomparecencia: "Incomparecencia (caducidad del trámite)",
} as const;
export type MotivoDesistimiento = keyof typeof DESISTIMIENTO_INFO;

export const MOTIVO_CITACION_INFO = {
  examen: "Examen médico",
  estudios: "Estudios complementarios",
  documentacion: "Presentación de documentación",
} as const;
export type MotivoCitacion = keyof typeof MOTIVO_CITACION_INFO;

export const ESTADO_CITACION_INFO = {
  programada: { nombre: "Programada", badge: "bg-sky-50 text-sky-800 ring-sky-600/20" },
  asistio: { nombre: "Asistió", badge: "bg-green-50 text-green-800 ring-green-600/20" },
  no_asistio: { nombre: "No asistió", badge: "bg-red-50 text-red-800 ring-red-600/20" },
} as const;
export type EstadoCitacion = keyof typeof ESTADO_CITACION_INFO;

export const MOTIVO_CESE_ILT_INFO = {
  L: "Alta médica",
  P: "Declaración de Incapacidad Laboral Permanente",
  D: "Fallecimiento",
  T: "Transcurso de un año desde la primera manifestación",
} as const;
export type MotivoCeseIlt = keyof typeof MOTIVO_CESE_ILT_INFO;

// ---------------------------------------------------------------------------
// Plazos (días hábiles salvo aclaración)
// ---------------------------------------------------------------------------
export const PLAZOS = {
  /** Falta de cobertura: informar a la SRT dentro de 48 h (Anexo II pto. 2). */
  configuracionHoras: 48,
  /** Las citaciones se notifican con al menos 72 h de anticipación (Anexo II pto. 1.6). */
  citacionHorasMinimas: 72,
  /** Plazo del área legal para expedirse (RF-10). */
  legalDiasHabiles: 10,
  /** Prórroga del área legal (RF-10). A confirmar con la UERT: 20 días según el relevamiento. */
  prorrogaDiasHabiles: 20,
  /** Contingencias sin baja: presentar ante la Comisión Médica (Res. EP, art. 9). */
  sinBajaDiasHabiles: 20,
  /** Tope de la ILT en días corridos desde el siniestro (Ley 24.557, art. 7; RF-22). */
  topeIltDias: 365,
  /** Aviso antes del tope de la ILT, en días corridos. */
  avisoTopeIltDias: 30,
  /** Aviso antes de cada presentación de la licencia (RF-15: a definir con la UERT). */
  avisoPresentacionDias: 3,
  /** Primera presentación de la licencia, en días corridos desde la aceptación. */
  primeraPresentacionDias: 15,
} as const;

// ---------------------------------------------------------------------------
// Datos fijos de la UERT y de la SRT
// ---------------------------------------------------------------------------
export const UERT = {
  nombre: "Unidad Ejecutora de Riesgos del Trabajo",
  sigla: "UERT",
  provincia: "Santiago del Estero",
  /** CUIT de la Provincia de Santiago del Estero (campo precargado, RNF-05). */
  cuitEmpleador: "30999164990",
  /** Código de establecimiento fijo en "0" (RNF-05). */
  codigoEstablecimiento: "0",
  /** Código de ART/EA asignado por la SRT. Tomado del sistema anterior: a confirmar. */
  cart: "00050",
  /** 8 posiciones de uso libre del número de siniestro (Res. SRT 3326/14). Tomado del sistema anterior: a confirmar. */
  prefijoSiniestro: "00050024",
  comisionMedica: {
    codigo: "029",
    nombre: "Comisión Médica Jurisdiccional N° 029 – Santiago del Estero",
    direccion: "Alem 379, Santiago del Estero",
  },
} as const;

/** Estados del formulario FODEP en el WS de la SRT. SIMULADOS: falta la tabla oficial ESTADOFODEP. */
export const FODEP_ESTADOS: Record<number, string> = {
  1: "Recibida",
  2: "Desistida (Asentamiento de Actuaciones Previas)",
  3: "En análisis",
  4: "Finalizada",
};

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";
