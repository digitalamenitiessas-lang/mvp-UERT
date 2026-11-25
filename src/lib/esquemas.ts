/**
 * Esquemas de validación (zod) compartidos por los formularios del navegador
 * y por las operaciones del servidor. Los campos de texto aceptan "" para
 * "vacío"; las operaciones lo convierten a null.
 */
import { z } from "zod";
import {
  CODIGOS_EXAMEN,
  MAX_DIAGNOSTICOS_EP,
  MOTIVOS_RECHAZO,
  TIPOS,
} from "@/lib/dominio/constantes";
import { esFechaISO } from "@/lib/dominio/fechas";
import {
  dniCoincideConCuil,
  esCuilValido,
  esCuitValido,
  esEmailValido,
  MENSAJE_DNI_CUIL,
  soloDigitos,
} from "@/lib/dominio/validaciones";

const texto = (max = 500) => z.string().trim().max(max, `Máximo ${max} caracteres`);
const textoRequerido = (max = 500) => z.string().trim().min(1, "Completá este campo").max(max, `Máximo ${max} caracteres`);
const fechaOpcional = z.string().refine((v) => v === "" || esFechaISO(v), "Fecha inválida");
const fechaRequerida = z.string().refine(esFechaISO, "Ingresá una fecha válida");
const idNumerico = z.number().int().positive();
const idOpcional = z.number().int().positive().nullable();

/** Fecha de hoy en Argentina, para validar en el navegador o en el servidor. */
function hoyAR(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
}

// ---------------------------------------------------------------------------
// Nueva denuncia (Mesa de entrada)
// ---------------------------------------------------------------------------
export const esquemaDiagnosticoInvocado = z.object({
  cie10: z.string().trim().min(1, "Elegí un diagnóstico CIE-10"),
  agente_causante: z.string().trim(),
});

export const esquemaDocumentoCarga = z.object({
  tipo: z.string().min(1),
  nombre_archivo: z.string().trim().max(255),
  tamano_bytes: z.number().int().nonnegative().nullable(),
});

export const esquemaNuevaDenuncia = z
  .object({
    tipo: z.enum(TIPOS),
    // Persona trabajadora
    cuil: z.string().transform(soloDigitos).refine(esCuilValido, "CUIL inválido (revisá el dígito verificador)"),
    dni: z.string().transform(soloDigitos).refine((v) => /^\d{7,8}$/.test(v), "DNI inválido"),
    apellido: textoRequerido(100),
    nombres: textoRequerido(100),
    fecha_nacimiento: fechaOpcional,
    sexo: z.enum(["F", "M", "X", ""]),
    telefono: texto(40),
    email: texto(120),
    domicilio: texto(200),
    localidad_id: idOpcional,
    // Denunciante y canal
    canal: z.enum(["presencial", "digital"]),
    denunciante_tipo: z.enum(["trabajador", "empleador", "derechohabiente", "otro"]),
    denunciante_nombre: texto(120),
    denunciante_email: texto(120),
    denunciante_telefono: texto(40),
    // Datos laborales
    reparticion: textoRequerido(200),
    domicilio_laboral: texto(200),
    localidad_laboral_id: idOpcional,
    puesto: texto(250),
    ciuo: texto(10),
    tareas: texto(1000),
    antiguedad_empresa: texto(60),
    antiguedad_area: texto(60),
    desvinculado: z.boolean(),
    // El hecho (AT/IT) o la primera manifestación (EP)
    fecha_ocurrencia: fechaOpcional,
    hora_ocurrencia: z.string().refine((v) => v === "" || /^\d{2}:\d{2}$/.test(v), "Hora inválida"),
    lugar_ocurrencia: texto(200),
    localidad_ocurrencia_id: idOpcional,
    descripcion: texto(2000),
    forma_accidente: texto(10),
    agente_material: texto(10),
    trayecto: texto(1000),
    // Enfermedad profesional (FODEP)
    pluriempleo: z.boolean(),
    cuits_pluriempleo: z.array(z.string()),
    obligada_pago: z.boolean().nullable(),
    exposicion_desde: fechaOpcional,
    exposicion_hasta: fechaOpcional,
    diagnosticos: z.array(esquemaDiagnosticoInvocado).max(MAX_DIAGNOSTICOS_EP, "Hasta 10 diagnósticos por denuncia"),
    documentos: z.array(esquemaDocumentoCarga),
    // Vínculo con otro siniestro (intercurrencia, RF-26)
    origen_id: idOpcional,
    es_intercurrencia: z.boolean(),
    confirmo_hecho_distinto: z.boolean(),
  })
  .superRefine((d, ctx) => {
    const falta = (path: string, message = "Completá este campo") => ctx.addIssue({ code: "custom", path: [path], message });
    const hoy = hoyAR();
    if (!dniCoincideConCuil(d.cuil, d.dni)) falta("dni", MENSAJE_DNI_CUIL);
    if (d.email && !esEmailValido(d.email)) falta("email", "Email inválido");
    if (d.denunciante_email && !esEmailValido(d.denunciante_email)) falta("denunciante_email", "Email inválido");
    if (d.denunciante_tipo !== "trabajador" && !d.denunciante_nombre) falta("denunciante_nombre");
    if (d.fecha_ocurrencia && d.fecha_ocurrencia > hoy) falta("fecha_ocurrencia", "No puede ser posterior a hoy");
    if (d.fecha_nacimiento && d.fecha_nacimiento >= hoy) falta("fecha_nacimiento", "Fecha inválida");

    if (d.tipo === "AT" || d.tipo === "IT") {
      if (!d.fecha_ocurrencia) falta("fecha_ocurrencia", "Indicá la fecha del accidente");
      if (!d.descripcion) falta("descripcion", "Describí cómo ocurrió");
      if (d.tipo === "IT" && !d.trayecto) falta("trayecto", "Describí el trayecto");
    }

    if (d.tipo === "EP") {
      // Campos obligatorios del WS FODEP
      if (!d.telefono) falta("telefono", "Obligatorio para la denuncia FODEP");
      else if (!/^\d{6,15}$/.test(d.telefono.replace(/\D/g, ""))) falta("telefono", "Teléfono inválido: con característica, solo números");
      if (!d.email) falta("email", "Obligatorio para la denuncia FODEP");
      if (!d.domicilio_laboral) falta("domicilio_laboral", "Obligatorio para la denuncia FODEP");
      if (!d.localidad_laboral_id) falta("localidad_laboral_id", "Obligatorio para la denuncia FODEP");
      if (!d.puesto) falta("puesto", "Obligatorio para la denuncia FODEP");
      if (!d.tareas) falta("tareas", "Obligatorio para la denuncia FODEP");
      if (!d.antiguedad_empresa) falta("antiguedad_empresa", "Obligatorio para la denuncia FODEP");
      if (!d.antiguedad_area) falta("antiguedad_area", "Obligatorio para la denuncia FODEP");
      if (!d.exposicion_desde) falta("exposicion_desde", "Obligatorio para la denuncia FODEP");
      if (d.exposicion_desde && d.exposicion_hasta && d.exposicion_hasta < d.exposicion_desde) {
        falta("exposicion_hasta", "Debe ser posterior al inicio de la exposición");
      }
      if (d.exposicion_desde && d.exposicion_desde > hoy) falta("exposicion_desde", "No puede ser posterior a hoy");
      if (d.pluriempleo) {
        const cuits = d.cuits_pluriempleo.map(soloDigitos).filter(Boolean);
        if (cuits.length === 0) falta("cuits_pluriempleo", "Indicá al menos un CUIT de los otros empleadores");
        cuits.forEach((c) => {
          if (!esCuitValido(c)) falta("cuits_pluriempleo", `CUIT inválido: ${c}`);
        });
        if (d.obligada_pago === null) falta("obligada_pago", "Indicá si la UERT está obligada al pago");
      }
      if (d.diagnosticos.length === 0) falta("diagnosticos", "La denuncia de EP exige al menos un diagnóstico CIE-10");
      d.diagnosticos.forEach((dx, i) => {
        if (!dx.agente_causante) {
          ctx.addIssue({ code: "custom", path: ["diagnosticos", i, "agente_causante"], message: "Elegí el agente causante" });
        }
      });
    }
    if (d.origen_id && !d.es_intercurrencia) falta("es_intercurrencia", "Indicá el vínculo con el siniestro anterior");
  });

export type NuevaDenunciaEntrada = z.input<typeof esquemaNuevaDenuncia>;
export type NuevaDenuncia = z.output<typeof esquemaNuevaDenuncia>;

// ---------------------------------------------------------------------------
// Mesa de entrada
// ---------------------------------------------------------------------------
export const esquemaVerificacion = z
  .object({
    expediente_id: idNumerico,
    verificada: z.boolean(),
    motivo: z.enum(["falta_cobertura", "relacion_no_corroborada"]).nullable(),
    observacion: texto(500),
  })
  .refine((d) => d.verificada || d.motivo !== null, { path: ["motivo"], message: "Indicá el motivo" });

export const esquemaDesistir = z.object({
  expediente_id: idNumerico,
  motivo: z.enum(["falta_cobertura", "relacion_no_corroborada", "inconsistencia_diagnostico", "incomparecencia"]),
  observacion: texto(500),
});

export const esquemaDocumento = z.object({
  expediente_id: idNumerico,
  tipo: z.string().min(1, "Elegí el tipo de documento"),
  nombre_archivo: textoRequerido(255),
  tamano_bytes: z.number().int().nonnegative().nullable(),
  observacion: texto(500),
});

export const esquemaReingreso = z.object({
  origen_id: idNumerico,
  fecha_ocurrencia: fechaRequerida,
  descripcion: textoRequerido(2000),
});

// ---------------------------------------------------------------------------
// Área médica
// ---------------------------------------------------------------------------
export const esquemaAgregarDiagnostico = z.object({
  expediente_id: idNumerico,
  cie10: z.string().trim().min(1, "Elegí un diagnóstico CIE-10"),
  agente_causante: z.string().trim(),
});

export const esquemaEvaluacion = z
  .object({
    diagnostico_id: idNumerico,
    cie10_adecuado: z.string().trim(),
    patologia_constatada: z.boolean(),
    en_listado: z.boolean().nullable(),
    fecha_diagnostico: fechaRequerida,
    codigo_examen: z.enum([...CODIGOS_EXAMEN, ""]),
    observacion_medica: texto(2000),
    lesiones: z.array(z.string().min(1)).max(9),
    zonas: z.array(z.string().min(1)).min(1, "Indicá al menos una zona del cuerpo").max(9),
  })
  .refine((d) => d.fecha_diagnostico <= hoyAR(), { path: ["fecha_diagnostico"], message: "No puede ser posterior a hoy" });

export const esquemaCitacion = z.object({
  expediente_id: idNumerico,
  fecha: fechaRequerida,
  hora: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  motivo: z.enum(["examen", "estudios", "documentacion"]),
  lugar: textoRequerido(200),
  detalle: texto(1000),
  reiteracion_de: idOpcional,
});

export const esquemaAsistencia = z.object({
  citacion_id: idNumerico,
  asistio: z.boolean(),
});

export const esquemaBaja = z
  .object({
    expediente_id: idNumerico,
    con_baja: z.boolean(),
    fecha_inicio_inasistencia: fechaOpcional,
    estres_postraumatico: z.boolean(),
  })
  .refine((d) => !d.con_baja || d.fecha_inicio_inasistencia !== "", {
    path: ["fecha_inicio_inasistencia"],
    message: "Con baja laboral, indicá desde cuándo no concurre",
  });

// ---------------------------------------------------------------------------
// Área legal
// ---------------------------------------------------------------------------
export const esquemaDecision = z
  .object({
    diagnostico_id: idNumerico,
    decision: z.enum(["aceptado", "rechazado"]),
    motivo_rechazo: z.enum([...MOTIVOS_RECHAZO, ""]),
    fundamento: texto(2000),
    estudios: texto(2000),
    cymat_adjunto: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.decision !== "rechazado") return;
    if (!d.motivo_rechazo) ctx.addIssue({ code: "custom", path: ["motivo_rechazo"], message: "Elegí el motivo del rechazo" });
    if (!d.fundamento) ctx.addIssue({ code: "custom", path: ["fundamento"], message: "Fundamentá el rechazo" });
    if (d.motivo_rechazo === "P" && !d.estudios) {
      ctx.addIssue({ code: "custom", path: ["estudios"], message: "Precisá los estudios en que se basa (Anexo III)" });
    }
    if (d.motivo_rechazo === "E" && !d.cymat_adjunto) {
      ctx.addIssue({ code: "custom", path: ["cymat_adjunto"], message: "El rechazo por falta de exposición exige el relevamiento CYMAT" });
    }
  });

// ---------------------------------------------------------------------------
// Seguimiento de la licencia
// ---------------------------------------------------------------------------
export const esquemaPresentacion = z
  .object({
    expediente_id: idNumerico,
    fecha: fechaRequerida,
    detalle: textoRequerido(1000),
    proxima_fecha: fechaOpcional,
    documentos: z.array(esquemaDocumentoCarga),
  })
  .refine((d) => !d.proxima_fecha || d.proxima_fecha > d.fecha, {
    path: ["proxima_fecha"],
    message: "Debe ser posterior a la presentación",
  });

export const esquemaIntercurrencia = z.object({
  expediente_id: idNumerico,
  fecha_ocurrencia: fechaRequerida,
  descripcion: textoRequerido(2000),
  cie10: z.string().trim(),
});

export const esquemaAlta = z.object({
  expediente_id: idNumerico,
  fecha_alta: fechaRequerida,
  motivo_cese_ilt: z.enum(["L", "P", "D", "T"]),
});

export const esquemaPresentacionCM = z.object({
  expediente_id: idNumerico,
  fecha: fechaRequerida,
});

export const esquemaReencuadre = z
  .object({
    expediente_id: idNumerico,
    agente_causante: z.string().trim().min(1, "Elegí el agente de riesgo"),
    exposicion_desde: fechaRequerida,
    observacion: texto(1000),
    // Datos que exige la denuncia FODEP y que en un accidente son opcionales:
    // se mandan solo los que faltan ("" o ausente = se conserva lo cargado).
    telefono: texto(40).optional(),
    email: texto(120).optional(),
    domicilio_laboral: texto(200).optional(),
    localidad_laboral_id: idOpcional.optional(),
    puesto: texto(250).optional(),
    tareas: texto(1000).optional(),
    antiguedad_empresa: texto(60).optional(),
    antiguedad_area: texto(60).optional(),
  })
  .superRefine((d, ctx) => {
    if (d.telefono && !/^\d{6,15}$/.test(d.telefono.replace(/\D/g, ""))) {
      ctx.addIssue({ code: "custom", path: ["telefono"], message: "Teléfono inválido: con característica, solo números" });
    }
    if (d.email && !esEmailValido(d.email)) ctx.addIssue({ code: "custom", path: ["email"], message: "Email inválido" });
  });
