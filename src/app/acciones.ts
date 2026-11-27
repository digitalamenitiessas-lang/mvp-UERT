"use server";
/**
 * Acciones del servidor (Server Functions) que llaman las pantallas.
 * Cada una toma el usuario de la demo, ejecuta la operación y devuelve un
 * ResultadoAccion: { ok: true, datos? } o { ok: false, error, detalles? }.
 * Los errores de negocio (ErrorNegocio) llegan al usuario tal cual.
 */
import { cookies } from "next/headers";
import { redirect, RedirectType, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { ROL_INFO } from "@/lib/dominio/constantes";
import { obtenerUsuario } from "@/lib/datos/usuarios";
import type { NuevaDenunciaEntrada } from "@/lib/esquemas";
import {
  adjuntarDocumento,
  agregarDiagnostico,
  cerrarDictamen,
  crearDenuncia,
  crearReingreso,
  darAlta,
  decidirDiagnostico,
  definirBaja,
  describirOmitido,
  desistir,
  editarDenuncia,
  ErrorNegocio,
  evaluarDiagnostico,
  generarLoteIntercambio,
  pasarALegal,
  pasarAMedica,
  programarCitacion,
  reencuadrarComoEP,
  registrarAsistencia,
  registrarIntercurrencia,
  registrarPresentacion,
  registrarPresentacionCM,
  siniestrosAbiertos,
  solicitarProrroga,
  verificarRelacionLaboral,
  type Ctx,
  type SiniestroAbierto,
} from "@/lib/operaciones";
import { exigirPermiso } from "@/lib/operaciones/contexto";
import { COOKIE_USUARIO, contextoActual, usuarioActual } from "@/lib/sesion";
import { limpiarConsulta, responderConsulta } from "@/lib/asistente/responder";
import type { ConsultaAsistente, Respuesta } from "@/lib/asistente/tipos";
import type { Persona } from "@/lib/tipos";

export type ResultadoAccion<T = undefined> =
  | { ok: true; datos: T; mensaje?: string }
  | { ok: false; error: string; detalles?: string[] };

async function ejecutar<T>(fn: (ctx: Ctx) => Promise<T>, mensaje?: string): Promise<ResultadoAccion<T>> {
  try {
    const ctx = await contextoActual();
    const datos = await fn(ctx);
    revalidatePath("/", "layout");
    return { ok: true, datos, mensaje };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ErrorNegocio) return { ok: false, error: e.message, detalles: e.detalles };
    console.error(e);
    return { ok: false, error: "Ocurrió un error inesperado. Probá de nuevo." };
  }
}

// ---------------------------------------------------------------------------
// Sesión de la demo
// ---------------------------------------------------------------------------
/**
 * Pantallas que ven todos los roles (la ficha, el listado de expedientes y la
 * búsqueda): al cambiar de rol se sigue ahí. Solo rutas internas, sin "//".
 */
const RUTA_DE_TODOS = /^\/(?:expedientes(?:\/\d{1,9})?|buscar)(?:\?[^#\s]*)?$/;

/**
 * "Viendo como": cambia el usuario de la demo. Si se estaba en una pantalla
 * que ven todos los roles, se queda ahí (la ficha invita a cambiar de rol
 * para seguir con el expediente); si no, va a la bandeja del rol nuevo.
 */
export async function cambiarUsuario(usuarioId: number, rutaActual?: string): Promise<void> {
  const usuario = await obtenerUsuario(await getDb(), Number(usuarioId));
  if (!usuario) redirect("/ingresar");
  (await cookies()).set(COOKIE_USUARIO, String(usuario.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  if (typeof rutaActual === "string" && RUTA_DE_TODOS.test(rutaActual)) redirect(rutaActual, RedirectType.replace);
  redirect(ROL_INFO[usuario.rol].inicio);
}

/** Entrada desde /ingresar: siempre a la bandeja del rol elegido. */
export async function ingresar(usuarioId: number): Promise<void> {
  await cambiarUsuario(usuarioId);
}

export async function salir(): Promise<void> {
  (await cookies()).delete(COOKIE_USUARIO);
  redirect("/ingresar");
}

// ---------------------------------------------------------------------------
// Mesa de entrada
// ---------------------------------------------------------------------------
export async function accionCrearDenuncia(datos: NuevaDenunciaEntrada) {
  return ejecutar((ctx) => crearDenuncia(ctx, datos), "Denuncia registrada");
}

export async function accionEditarDenuncia(expedienteId: number, datos: NuevaDenunciaEntrada) {
  return ejecutar((ctx) => editarDenuncia(ctx, { expediente_id: expedienteId, datos }), "Datos actualizados");
}

/** Siniestros abiertos de la persona (sistema nuevo y actual) y sus datos si ya existe (RF-25). */
export async function accionConsultarPersona(cuil: string, dni: string) {
  return ejecutar<{ persona: Persona | null; abiertos: SiniestroAbierto[] }>(async (ctx) => {
    exigirPermiso(ctx, "crear_denuncia");
    const c = cuil.replace(/\D/g, "");
    const d = dni.replace(/\D/g, "");
    // El DNI no es único: primero la persona con ese CUIL exacto y, si no hay, otra con el mismo DNI.
    const { rows } = await ctx.db.query<Persona>(
      "select * from personas where cuil = $1 or dni = $2 order by (cuil = $1) desc, id limit 1",
      [c, d],
    );
    return { persona: rows[0] ?? null, abiertos: await siniestrosAbiertos(ctx.db, c, d) };
  });
}

export async function accionVerificar(datos: {
  expediente_id: number;
  verificada: boolean;
  motivo: "falta_cobertura" | "relacion_no_corroborada" | null;
  observacion: string;
}) {
  return ejecutar((ctx) => verificarRelacionLaboral(ctx, datos), datos.verificada ? "Relación laboral verificada" : "Denuncia desistida");
}

export async function accionPasarAMedica(expedienteId: number) {
  return ejecutar(async (ctx) => {
    const r = await pasarAMedica(ctx, { expediente_id: expedienteId });
    if (!r.ok) throw new ErrorNegocio(r.mensaje, r.errores.map((e) => `${e.codigo}${e.campo ? ` (${e.campo})` : ""}: ${e.mensaje}`));
    return undefined;
  }, "Pasó al Área médica");
}

export async function accionDesistir(datos: {
  expediente_id: number;
  motivo: "falta_cobertura" | "relacion_no_corroborada" | "inconsistencia_diagnostico" | "incomparecencia";
  observacion: string;
}) {
  return ejecutar((ctx) => desistir(ctx, datos), "Denuncia desistida");
}

export async function accionAdjuntarDocumento(datos: {
  expediente_id: number;
  tipo: string;
  nombre_archivo: string;
  tamano_bytes: number | null;
  observacion: string;
}) {
  return ejecutar((ctx) => adjuntarDocumento(ctx, datos), "Documento adjuntado");
}

/** Varios archivos del mismo tipo de documento (se eligen juntos o en varias tandas, RNF-03). */
export async function accionAdjuntarDocumentos(datos: {
  expediente_id: number;
  tipo: string;
  archivos: Array<{ nombre_archivo: string; tamano_bytes: number | null }>;
  observacion: string;
}) {
  const cantidad = Array.isArray(datos.archivos) ? datos.archivos.length : 0;
  return ejecutar(
    async (ctx) => {
      if (!cantidad) throw new ErrorNegocio("Elegí al menos un archivo.");
      for (const a of datos.archivos) {
        await adjuntarDocumento(ctx, {
          expediente_id: datos.expediente_id,
          tipo: datos.tipo,
          nombre_archivo: a.nombre_archivo,
          tamano_bytes: a.tamano_bytes,
          observacion: datos.observacion,
        });
      }
      return undefined;
    },
    cantidad > 1 ? `${cantidad} documentos adjuntados` : "Documento adjuntado",
  );
}

export async function accionCrearReingreso(datos: { origen_id: number; fecha_ocurrencia: string; descripcion: string }) {
  return ejecutar((ctx) => crearReingreso(ctx, datos), "Reingreso registrado");
}

// ---------------------------------------------------------------------------
// Área médica
// ---------------------------------------------------------------------------
export async function accionAgregarDiagnostico(datos: { expediente_id: number; cie10: string; agente_causante: string }) {
  return ejecutar((ctx) => agregarDiagnostico(ctx, datos), "Diagnóstico agregado");
}

export async function accionEvaluarDiagnostico(datos: {
  diagnostico_id: number;
  cie10_adecuado: string;
  patologia_constatada: boolean;
  en_listado: boolean | null;
  fecha_diagnostico: string;
  codigo_examen: string;
  observacion_medica: string;
  lesiones: string[];
  zonas: string[];
}) {
  return ejecutar((ctx) => evaluarDiagnostico(ctx, datos), "Evaluación guardada");
}

export async function accionProgramarCitacion(datos: {
  expediente_id: number;
  fecha: string;
  hora: string;
  motivo: "examen" | "estudios" | "documentacion";
  lugar: string;
  detalle: string;
  reiteracion_de: number | null;
}) {
  return ejecutar((ctx) => programarCitacion(ctx, datos), "Citación notificada (simulado)");
}

export async function accionRegistrarAsistencia(datos: { citacion_id: number; asistio: boolean }) {
  return ejecutar((ctx) => registrarAsistencia(ctx, datos));
}

export async function accionDefinirBaja(datos: {
  expediente_id: number;
  con_baja: boolean;
  fecha_inicio_inasistencia: string;
  estres_postraumatico: boolean;
}) {
  return ejecutar((ctx) => definirBaja(ctx, datos), "Baja laboral definida");
}

export async function accionReencuadrar(datos: {
  expediente_id: number;
  agente_causante: string;
  exposicion_desde: string;
  observacion: string;
}) {
  return ejecutar((ctx) => reencuadrarComoEP(ctx, datos), "Reencuadrado como enfermedad profesional");
}

export async function accionPasarALegal(expedienteId: number) {
  return ejecutar((ctx) => pasarALegal(ctx, { expediente_id: expedienteId }), "Pasó al Área legal");
}

// ---------------------------------------------------------------------------
// Área legal
// ---------------------------------------------------------------------------
export async function accionDecidirDiagnostico(datos: {
  diagnostico_id: number;
  decision: "aceptado" | "rechazado";
  motivo_rechazo: string;
  fundamento: string;
  estudios: string;
  cymat_adjunto: boolean;
}) {
  return ejecutar((ctx) => decidirDiagnostico(ctx, datos), "Decisión guardada");
}

export async function accionSolicitarProrroga(expedienteId: number) {
  return ejecutar((ctx) => solicitarProrroga(ctx, { expediente_id: expedienteId }), "Prórroga registrada");
}

export async function accionCerrarDictamen(expedienteId: number) {
  return ejecutar((ctx) => cerrarDictamen(ctx, { expediente_id: expedienteId }), "Dictamen cerrado");
}

// ---------------------------------------------------------------------------
// Seguimiento de la licencia
// ---------------------------------------------------------------------------
export async function accionRegistrarPresentacion(datos: {
  expediente_id: number;
  fecha: string;
  detalle: string;
  proxima_fecha: string;
  documentos: Array<{ tipo: string; nombre_archivo: string; tamano_bytes: number | null }>;
}) {
  return ejecutar((ctx) => registrarPresentacion(ctx, datos), "Presentación registrada");
}

export async function accionRegistrarIntercurrencia(datos: {
  expediente_id: number;
  fecha_ocurrencia: string;
  descripcion: string;
  cie10: string;
}) {
  return ejecutar((ctx) => registrarIntercurrencia(ctx, datos), "Intercurrencia registrada");
}

export async function accionDarAlta(datos: { expediente_id: number; fecha_alta: string; motivo_cese_ilt: "L" | "P" | "D" | "T" }) {
  return ejecutar((ctx) => darAlta(ctx, datos), "Alta registrada");
}

export async function accionPresentacionCM(datos: { expediente_id: number; fecha: string }) {
  return ejecutar((ctx) => registrarPresentacionCM(ctx, datos), "Presentación ante la Comisión Médica registrada");
}

// ---------------------------------------------------------------------------
// SRT y administración
// ---------------------------------------------------------------------------
export async function accionGenerarLote() {
  return ejecutar(async (ctx) => {
    const lote = await generarLoteIntercambio(ctx);
    return { id: lote.id, registros: lote.registros, omitidos: lote.omitidos.map(describirOmitido) };
  }, "Archivos de intercambio generados");
}

export async function accionReiniciarDemo() {
  return ejecutar(async (ctx) => {
    exigirPermiso(ctx, "reiniciar_demo");
    const { sembrarDemo } = await import("@/lib/demo/sembrar");
    await sembrarDemo(ctx.db, { ahora: new Date() });
    return undefined;
  }, "Datos de la demo reiniciados");
}

// ---------------------------------------------------------------------------
// Asistente virtual (Yanapa): solo lee, no modifica nada
// ---------------------------------------------------------------------------
/**
 * Responde una consulta del asistente. Funciona también sin usuario (en
 * /ingresar): ahí contesta lo general y pide elegir un rol para los datos.
 */
export async function accionAsistente(consulta: ConsultaAsistente): Promise<ResultadoAccion<Respuesta>> {
  try {
    const datos = await responderConsulta(await getDb(), await usuarioActual(), limpiarConsulta(consulta));
    return { ok: true, datos };
  } catch (e) {
    unstable_rethrow(e);
    console.error(e);
    return { ok: false, error: "No pude responder ahora. Probá de nuevo en un momento." };
  }
}
