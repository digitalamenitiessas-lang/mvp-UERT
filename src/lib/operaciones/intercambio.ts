/**
 * Sistema de Intercambio: arma los registros .AD/.AL/.AZ a partir de los
 * diagnósticos evaluados y genera lotes con los archivos (RF-09, RF-64 a RF-67).
 */
import type { Db } from "@/lib/db";
import { TIPO_INFO, UERT } from "@/lib/dominio/constantes";
import { fechaDe } from "@/lib/dominio/fechas";
import { numeroSiniestroSRT } from "@/lib/dominio/numeracion";
import {
  ErrorIntercambio,
  generarArchivos,
  type ArchivoIntercambio,
  type RegistroDiagnostico,
  type TipoOperacion,
} from "@/lib/srt/intercambio";
import type { Diagnostico, Expediente, LoteIntercambio } from "@/lib/tipos";
import { ErrorNegocio, exigirPermiso, type Ctx } from "./contexto";
import { registrarComunicacion } from "./srt";

type FilaRegistro = Diagnostico &
  Pick<Expediente, "anio" | "contador" | "sufijo" | "tipo" | "desvinculado" | "fodep_codigo" | "recibido_en" | "numero"> & {
    lesiones: Array<{ orden: number; codigo: string }> | null;
    zonas: Array<{ orden: number; codigo: string }> | null;
  };

// Un diagnóstico desistido entra solo si ya se había informado: viaja como baja (B).
const SELECT_REGISTROS = `
  select d.*, e.anio, e.contador, e.sufijo, e.tipo, e.desvinculado, e.fodep_codigo, e.recibido_en, e.numero,
    (select json_agg(json_build_object('orden', l.orden, 'codigo', l.codigo) order by l.orden)
       from diagnostico_lesiones l where l.diagnostico_id = d.id) as lesiones,
    (select json_agg(json_build_object('orden', z.orden, 'codigo', z.codigo) order by z.orden)
       from diagnostico_zonas z where z.diagnostico_id = d.id) as zonas
  from diagnosticos d join expedientes e on e.id = d.expediente_id
  where (d.estado in ('evaluado','aceptado','rechazado') or (d.estado = 'desistido' and d.intercambio_lote_id is not null))`;

function operacionDe(f: FilaRegistro): TipoOperacion {
  if (f.estado === "desistido") return "B";
  return f.intercambio_estado === "modificado" ? "M" : "A";
}

function aRegistro(f: FilaRegistro, operacion?: TipoOperacion): RegistroDiagnostico {
  return {
    numeroSiniestro: numeroSiniestroSRT(f.anio, f.contador, f.sufijo),
    extension: TIPO_INFO[f.tipo].extension,
    numeroUnico: f.numero_unico,
    orden: f.orden,
    tipoOperacion: operacion ?? operacionDe(f),
    cie10: f.cie10_adecuado ?? f.cie10,
    fechaDiagnostico: f.fecha_diagnostico ?? fechaDe(f.recibido_en),
    codigoExamen: f.codigo_examen,
    desvinculado: f.desvinculado,
    idFodep: f.codigo_examen && !["P", "R", "A", "E", "T"].includes(f.codigo_examen) ? f.fodep_codigo : null,
    lesiones: f.lesiones ?? [],
    zonas: f.zonas ?? [],
  };
}

/** Un diagnóstico está listo para el intercambio si la evaluación médica dejó lo que el archivo exige. */
function listo(f: FilaRegistro): boolean {
  const tieneZonas = (f.zonas ?? []).length > 0;
  const tieneLesiones = (f.lesiones ?? []).length > 0;
  return tieneZonas && (f.tipo === "EP" || tieneLesiones);
}

export interface VistaIntercambio {
  registros: RegistroDiagnostico[];
  archivos: ArchivoIntercambio[];
  error: string | null;
}

/** Diagnóstico que el formato del archivo no admite: queda fuera del lote y se informa aparte. */
export interface RegistroOmitido {
  expediente_id: number;
  numero: string;
  orden: number;
  error: string;
}

export function describirOmitido(o: RegistroOmitido): string {
  return `Expediente ${o.numero}, diagnóstico ${o.orden}: ${o.error}`;
}

/**
 * Arma los archivos con los diagnósticos que el formato admite. Un registro
 * inválido no frena a los demás: queda en `omitidos` con el motivo.
 */
function armarArchivos(filas: FilaRegistro[]): {
  validas: FilaRegistro[];
  registros: RegistroDiagnostico[];
  archivos: ArchivoIntercambio[];
  omitidos: RegistroOmitido[];
} {
  const validas: FilaRegistro[] = [];
  const registros: RegistroDiagnostico[] = [];
  const omitidos: RegistroOmitido[] = [];
  for (const f of filas) {
    const r = aRegistro(f);
    try {
      generarArchivos([r], UERT.cart);
      validas.push(f);
      registros.push(r);
    } catch (e) {
      if (!(e instanceof ErrorIntercambio)) throw e;
      omitidos.push({ expediente_id: f.expediente_id, numero: f.numero, orden: f.orden, error: e.message });
    }
  }
  return { validas, registros, archivos: generarArchivos(registros, UERT.cart), omitidos };
}

/** Vista previa de lo que se informa por un expediente (estado actual de sus diagnósticos). */
export async function vistaPreviaIntercambio(db: Db, expedienteId: number): Promise<VistaIntercambio> {
  const { rows } = await db.query<FilaRegistro>(`${SELECT_REGISTROS} and d.expediente_id = $1 order by d.orden`, [
    expedienteId,
  ]);
  const { registros, archivos, omitidos } = armarArchivos(rows.filter(listo));
  const error = omitidos.length ? omitidos.map((o) => `Diagnóstico ${o.orden}: ${o.error}`).join(" · ") : null;
  return { registros, archivos, error };
}

/** Diagnósticos con novedades para el próximo lote (los que el archivo admite). */
export async function pendientesDeIntercambio(db: Db): Promise<number> {
  const { rows } = await db.query<FilaRegistro>(`${SELECT_REGISTROS} and d.intercambio_estado in ('pendiente','modificado')`);
  return armarArchivos(rows.filter(listo)).registros.length;
}

/**
 * Genera el lote del día con todos los diagnósticos pendientes o modificados.
 * En la SRT el intercambio corre de lunes a viernes de noche y las respuestas
 * se publican el día hábil siguiente (RF-66). Los registros que el formato no
 * admite quedan pendientes y se devuelven en `omitidos`.
 */
export async function generarLoteIntercambio(ctx: Ctx): Promise<LoteIntercambio & { omitidos: RegistroOmitido[] }> {
  exigirPermiso(ctx, "generar_intercambio");
  return ctx.db.transaction(async (tx) => {
    const { rows } = await tx.query<FilaRegistro>(
      `${SELECT_REGISTROS} and d.intercambio_estado in ('pendiente','modificado') order by e.anio, e.contador, e.sufijo, d.orden`,
    );
    const { validas: filas, archivos, omitidos } = armarArchivos(rows.filter(listo));
    if (!filas.length) {
      throw new ErrorNegocio(
        omitidos.length
          ? "Los diagnósticos pendientes tienen datos que el archivo no admite: hay que corregirlos antes de informarlos."
          : "No hay diagnósticos nuevos ni modificados para informar.",
        omitidos.map(describirOmitido),
      );
    }
    const total = archivos.reduce((n, a) => n + a.registros, 0);
    const { rows: lote } = await tx.query<LoteIntercambio>(
      `insert into intercambio_lotes (generado_en, generado_por, archivos, registros) values ($1, $2, $3, $4) returning *`,
      [ctx.ahora, ctx.usuario.id, JSON.stringify(archivos), total],
    );
    await tx.query(
      "update diagnosticos set intercambio_estado = 'informado', intercambio_lote_id = $2 where id = any($1)",
      [filas.map((f) => f.id), lote[0].id],
    );
    await registrarComunicacion(tx, ctx, {
      expediente_id: null,
      canal: "intercambio",
      operacion: `Lote ${lote[0].id}`,
      request: {
        archivos: archivos.map((a) => ({ nombre: a.nombre, registros: a.registros })),
        ...(omitidos.length ? { omitidos: omitidos.map(describirOmitido) } : {}),
      },
      response: { Recibido: true, Respuesta: "Se publica el día hábil siguiente" },
      ok: true,
    });
    const expedientes = [...new Set(filas.map((f) => f.expediente_id))];
    for (const id of expedientes) {
      await tx.query(
        `insert into movimientos (expediente_id, fecha, usuario_id, rol, accion, detalle)
         values ($1, $2, $3, $4, 'intercambio', $5)`,
        [
          id,
          ctx.ahora,
          ctx.usuario.id,
          ctx.usuario.rol,
          `Diagnósticos informados a la SRT en el lote ${lote[0].id} del Sistema de Intercambio (.AD/.AL/.AZ).`,
        ],
      );
    }
    return { ...lote[0], omitidos };
  });
}
