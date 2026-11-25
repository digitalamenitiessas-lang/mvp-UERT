/**
 * Comunicaciones con la SRT y notificaciones al trabajador y al empleador.
 * TODAS SIMULADAS en el MVP: se arma el mismo contenido que se enviaría, se
 * valida con las reglas publicadas y se registra en srt_comunicaciones.
 */
import type { Db } from "@/lib/db";
import { FODEP_ESTADOS, UERT } from "@/lib/dominio/constantes";
import { fechaDe } from "@/lib/dominio/fechas";
import {
  describirErrores,
  validarDenunciaFODEP,
  validarDiagnosticosFODEP,
  type DenunciaFODEP,
  type DiagnosticoFODEP,
  type ErrorFODEP,
} from "@/lib/srt/fodep";
import type { Expediente, Persona } from "@/lib/tipos";
import { actualizarExpediente, registrarMovimiento, type Ctx } from "./contexto";

type Canal = "ws_fodep" | "eservicios" | "ventanilla" | "intercambio";

export async function registrarComunicacion(
  tx: Db,
  ctx: Ctx,
  c: {
    expediente_id: number | null;
    canal: Canal;
    operacion: string;
    request?: unknown;
    response?: unknown;
    ok: boolean;
    error_codigo?: string | null;
    error_mensaje?: string | null;
  },
): Promise<void> {
  await tx.query(
    `insert into srt_comunicaciones (expediente_id, canal, operacion, request, response, ok, error_codigo, error_mensaje, simulado, fecha)
     values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)`,
    [
      c.expediente_id,
      c.canal,
      c.operacion,
      c.request === undefined ? null : JSON.stringify(c.request),
      c.response === undefined ? null : JSON.stringify(c.response),
      c.ok,
      c.error_codigo ?? null,
      c.error_mensaje ?? null,
      ctx.ahora,
    ],
  );
}

export async function armarDenunciaFODEP(tx: Db, exp: Expediente): Promise<DenunciaFODEP> {
  const { rows: personas } = await tx.query<Persona>("select * from personas where id = $1", [exp.persona_id]);
  const p = personas[0];
  const { rows: locs } = await tx.query<{ provincia_id: number }>("select provincia_id from cat_localidad where id = $1", [
    exp.localidad_laboral_id,
  ]);
  return {
    ...(exp.fodep_codigo ? { CodigoDenuncia: exp.fodep_codigo } : {}),
    CuilTrabajador: p.cuil,
    NombreTrabajador: `${p.apellido}, ${p.nombres}`,
    TelefonoTrabajador: (p.telefono ?? "").replace(/\D/g, ""),
    EmailTrabajador: p.email ?? "",
    CuitEmpleador: exp.cuit_empleador,
    DomicilioEmpleador: exp.domicilio_laboral ?? "",
    PisoEmp: null,
    DptoEmp: null,
    LocalidadIdEmp: exp.localidad_laboral_id,
    ProvinciaIdEmp: locs[0]?.provincia_id ?? null,
    Pluriempleo: !!exp.pluriempleo,
    CuitesPluriempleo: exp.pluriempleo ? (exp.cuits_pluriempleo ?? []) : null,
    ObligadaPago: exp.pluriempleo ? exp.obligada_pago : null,
    AntArea: exp.antiguedad_area ?? "",
    AntEmpresa: exp.antiguedad_empresa ?? "",
    Puesto: exp.puesto ?? "",
    Tareas: exp.tareas ?? "",
    ExposicionDesde: exp.exposicion_desde,
    ExposicionHasta: exp.exposicion_hasta,
    RecepcionDenuncia: fechaDe(exp.recibido_en),
  };
}

async function diagnosticosFODEP(tx: Db, expedienteId: number): Promise<DiagnosticoFODEP[]> {
  const { rows } = await tx.query<{ cie10: string; agente_causante: string | null }>(
    `select coalesce(cie10_adecuado, cie10) as cie10, agente_causante
       from diagnosticos where expediente_id = $1 and estado <> 'desistido' order by orden`,
    [expedienteId],
  );
  return rows.map((r) => ({ CIE10: r.cie10, AgenteCausante: r.agente_causante ?? "" }));
}

async function catalogosFODEP(tx: Db, diags: DiagnosticoFODEP[]) {
  const cie = diags.map((d) => d.CIE10);
  const ag = diags.map((d) => d.AgenteCausante).filter(Boolean);
  const [c, a] = await Promise.all([
    tx.query<{ codigo: string }>("select codigo from cat_cie10 where codigo = any($1)", [cie]),
    tx.query<{ codigo: string }>("select codigo from cat_agente_causante where codigo = any($1)", [ag]),
  ]);
  return { cie10: new Set(c.rows.map((r) => r.codigo)), agentes: new Set(a.rows.map((r) => r.codigo)) };
}

export type ResultadoFODEP = { ok: true; codigo: number; numero: number } | { ok: false; errores: ErrorFODEP[] };

/**
 * AltaDenunciaEP + AltaDiagnosticosEP. Si la SRT (simulada) rechaza los datos,
 * queda registrado el intento con los códigos de error y no se lanza excepción:
 * quien llama decide qué hacer.
 */
export async function informarAltaFODEP(tx: Db, ctx: Ctx, exp: Expediente): Promise<ResultadoFODEP> {
  if (exp.fodep_codigo && exp.fodep_numero) return { ok: true, codigo: exp.fodep_codigo, numero: exp.fodep_numero };
  const denuncia = await armarDenunciaFODEP(tx, exp);
  const diags = await diagnosticosFODEP(tx, exp.id);
  const errores = [
    ...validarDenunciaFODEP(denuncia, fechaDe(ctx.ahora)),
    ...validarDiagnosticosFODEP(diags, await catalogosFODEP(tx, diags)),
  ];
  if (errores.length) {
    await registrarComunicacion(tx, ctx, {
      expediente_id: exp.id,
      canal: "ws_fodep",
      operacion: "AltaDenunciaEP",
      request: { DenunciaFODEP: denuncia, Diagnosticos: diags },
      response: { SoapException: errores.map((e) => ({ ErrorNumber: e.codigo, ErrorMessage: e.mensaje, Campo: e.campo })) },
      ok: false,
      error_codigo: errores[0].codigo,
      error_mensaje: describirErrores(errores),
    });
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "srt_error",
      detalle: `La SRT rechazó la denuncia FODEP: ${describirErrores(errores)}`,
    });
    return { ok: false, errores };
  }
  const { rows } = await tx.query<{ codigo: number; numero: number }>(
    "select nextval('fodep_codigo_seq')::int as codigo, nextval('fodep_numero_seq') as numero",
  );
  const { codigo, numero } = rows[0];
  await registrarComunicacion(tx, ctx, {
    expediente_id: exp.id,
    canal: "ws_fodep",
    operacion: "AltaDenunciaEP",
    request: { DenunciaFODEP: denuncia },
    response: { CodigoDenuncia: codigo, NroDenuncia: numero, IdEstadoActual: 1 },
    ok: true,
  });
  await registrarComunicacion(tx, ctx, {
    expediente_id: exp.id,
    canal: "ws_fodep",
    operacion: "AltaDiagnosticosEP",
    request: { CodigoDenuncia: codigo, Diagnosticos: diags },
    response: { Diagnosticos: diags },
    ok: true,
  });
  await actualizarExpediente(tx, ctx, exp.id, { fodep_codigo: codigo, fodep_numero: numero, fodep_estado: 1 });
  exp.fodep_codigo = codigo;
  exp.fodep_numero = numero;
  exp.fodep_estado = 1;
  await registrarMovimiento(tx, ctx, {
    expediente_id: exp.id,
    accion: "srt_fodep",
    detalle: `Denuncia informada a la SRT por Web Service. N° de formulario FODEP ${numero}.`,
    datos: { codigo, numero },
  });
  return { ok: true, codigo, numero };
}

/**
 * AltaDiagnosticosEP de un diagnóstico que se agrega a una denuncia ya
 * informada (patología detectada en la evaluación). Los códigos ya se
 * validaron contra los catálogos de la SRT.
 */
export async function informarDiagnosticoFODEP(tx: Db, ctx: Ctx, exp: Expediente, dx: DiagnosticoFODEP): Promise<void> {
  if (!exp.fodep_codigo) return;
  await registrarComunicacion(tx, ctx, {
    expediente_id: exp.id,
    canal: "ws_fodep",
    operacion: "AltaDiagnosticosEP",
    request: { CodigoDenuncia: exp.fodep_codigo, Diagnosticos: [dx] },
    response: { Diagnosticos: [dx] },
    ok: true,
  });
}

/** CambiarEstado del WS FODEP. */
export async function cambiarEstadoFODEP(tx: Db, ctx: Ctx, exp: Expediente, idEstado: number, motivo: string): Promise<void> {
  if (!exp.fodep_codigo) return;
  await registrarComunicacion(tx, ctx, {
    expediente_id: exp.id,
    canal: "ws_fodep",
    operacion: "CambiarEstado",
    request: { CodigoDenuncia: exp.fodep_codigo, IdEstado: idEstado, Motivo: motivo },
    response: { CambioAceptado: true, IdEstado: idEstado },
    ok: true,
  });
  await actualizarExpediente(tx, ctx, exp.id, { fodep_estado: idEstado });
  exp.fodep_estado = idEstado;
  await registrarMovimiento(tx, ctx, {
    expediente_id: exp.id,
    accion: "srt_estado",
    detalle: `Se informó a la SRT el estado "${FODEP_ESTADOS[idEstado] ?? idEstado}" del formulario FODEP.`,
  });
}

/**
 * Notificación al trabajador: e-Servicios SRT y el email del formulario
 * (Anexo II pto. 1.6). Simulada.
 */
export async function notificarTrabajador(
  tx: Db,
  ctx: Ctx,
  exp: Expediente,
  asunto: string,
  cuerpo: string,
): Promise<void> {
  const { rows } = await tx.query<{ cuil: string; email: string | null }>("select cuil, email from personas where id = $1", [
    exp.persona_id,
  ]);
  await registrarComunicacion(tx, ctx, {
    expediente_id: exp.id,
    canal: "eservicios",
    operacion: "Notificación al trabajador",
    request: { Cuil: rows[0]?.cuil, Email: rows[0]?.email, Asunto: asunto, Cuerpo: cuerpo },
    response: { Notificado: true },
    ok: true,
  });
}

/** Notificación al empleador por Ventanilla Electrónica (Anexo II pto. 4.1). Simulada. */
export async function notificarEmpleador(tx: Db, ctx: Ctx, exp: Expediente, asunto: string, cuerpo: string): Promise<void> {
  await registrarComunicacion(tx, ctx, {
    expediente_id: exp.id,
    canal: "ventanilla",
    operacion: "Ventanilla Electrónica al empleador",
    request: { CuitEmpleador: exp.cuit_empleador, Reparticion: exp.reparticion, Asunto: asunto, Cuerpo: cuerpo },
    response: { Enviado: true },
    ok: true,
  });
}

export const NOMBRE_EMISOR = `${UERT.nombre} (${UERT.sigla})`;
