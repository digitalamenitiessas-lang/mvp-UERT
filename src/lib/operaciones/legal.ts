/**
 * Área legal: decisión por diagnóstico (aceptación o rechazo con los
 * motivos R, D, E, P o L), prórroga y cierre del dictamen.
 */
import { MOTIVO_RECHAZO_INFO, PLAZOS, type MotivoRechazo } from "@/lib/dominio/constantes";
import { formatoFecha, sumarDias, sumarDiasHabiles } from "@/lib/dominio/fechas";
import { esquemaDecision } from "@/lib/esquemas";
import type { Diagnostico, Expediente } from "@/lib/tipos";
import {
  bloquearExpediente,
  cambiarEstado,
  cargarFeriados,
  exigir,
  exigirPermiso,
  hoyCtx,
  nulo,
  actualizarExpediente,
  registrarMovimiento,
  validar,
  type Ctx,
} from "./contexto";
import { cambiarEstadoFODEP, notificarEmpleador, notificarTrabajador } from "./srt";

/** ¿El motivo corresponde a este expediente? */
export function motivoPermitido(exp: Pick<Expediente, "tipo" | "es_reingreso">, motivo: MotivoRechazo): boolean {
  const aplica = MOTIVO_RECHAZO_INFO[motivo].aplica;
  if (aplica === "EP") return exp.tipo === "EP";
  if (aplica === "REINGRESO") return exp.es_reingreso;
  return exp.tipo === "AT" || exp.tipo === "IT";
}

export async function decidirDiagnostico(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaDecision, entrada);
  await ctx.db.transaction(async (tx) => {
    const { rows } = await tx.query<Diagnostico>("select * from diagnosticos where id = $1", [d.diagnostico_id]);
    const dx = rows[0];
    exigir(dx, "El diagnóstico no existe.");
    const exp = await bloquearExpediente(tx, dx.expediente_id);
    exigirPermiso(ctx, "decidir_diagnostico", exp.estado);
    exigir(
      ["evaluado", "aceptado", "rechazado"].includes(dx.estado),
      "Solo se decide sobre diagnósticos evaluados por el área médica.",
    );
    const motivo = d.decision === "rechazado" ? (d.motivo_rechazo as MotivoRechazo) : null;
    if (motivo) {
      exigir(
        motivoPermitido(exp, motivo),
        `El motivo "${MOTIVO_RECHAZO_INFO[motivo].nombre}" no corresponde a este tipo de expediente.`,
      );
      if (motivo === "E") {
        exigir(d.cymat_adjunto, "El rechazo por ausencia de exposición exige el relevamiento CYMAT (Anexo II pto. 5.1.a).");
        const { rows: cymat } = await tx.query("select 1 from documentos where expediente_id = $1 and tipo = 'cymat'", [exp.id]);
        if (!cymat.length) {
          await tx.query(
            `insert into documentos (expediente_id, tipo, nombre_archivo, etapa, observacion, cargado_por, cargado_en)
             values ($1, 'cymat', 'Relevamiento CYMAT.pdf', 'legal', 'Adjuntado al decidir el rechazo', $2, $3)`,
            [exp.id, ctx.usuario.id, ctx.ahora],
          );
        }
      }
    }
    await tx.query(
      `update diagnosticos set estado = $2, motivo_rechazo = $3, fundamento = $4, estudios = $5, cymat_adjunto = $6, decidido_en = $7
        where id = $1`,
      [
        dx.id,
        d.decision,
        motivo,
        nulo(d.fundamento),
        motivo === "P" ? nulo(d.estudios) : null,
        motivo === "E" ? true : null,
        ctx.ahora,
      ],
    );
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "decision",
      detalle:
        d.decision === "aceptado"
          ? `Diagnóstico ${dx.orden} (${dx.cie10_adecuado ?? dx.cie10}): aceptado.`
          : `Diagnóstico ${dx.orden} (${dx.cie10_adecuado ?? dx.cie10}): rechazado (${motivo} · ${MOTIVO_RECHAZO_INFO[motivo!].nombre}).`,
    });
  });
}

export async function solicitarProrroga(ctx: Ctx, entrada: { expediente_id: number }): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, Number(entrada.expediente_id));
    exigirPermiso(ctx, "solicitar_prorroga", exp.estado);
    exigir(!exp.legal_prorroga_usada, "La prórroga ya se usó.");
    exigir(exp.legal_vence, "El expediente no tiene plazo legal.");
    const vence = sumarDiasHabiles(exp.legal_vence!, PLAZOS.prorrogaDiasHabiles, await cargarFeriados(tx));
    await actualizarExpediente(tx, ctx, exp.id, { legal_vence: vence, legal_prorroga_usada: true });
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "prorroga",
      detalle: `Prórroga de ${PLAZOS.prorrogaDiasHabiles} días hábiles: el plazo vence el ${formatoFecha(vence)}.`,
    });
  });
}

/**
 * Cierra el dictamen cuando todos los diagnósticos tienen decisión.
 * Con al menos uno aceptado: licencia activa (con baja) o aceptado sin baja
 * (20 días para la Comisión Médica). Si todos se rechazan: rechazado.
 */
export async function cerrarDictamen(ctx: Ctx, entrada: { expediente_id: number }): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, Number(entrada.expediente_id));
    exigirPermiso(ctx, "cerrar_dictamen", exp.estado);
    const { rows: dxs } = await tx.query<Diagnostico>(
      "select * from diagnosticos where expediente_id = $1 and estado <> 'desistido' order by orden",
      [exp.id],
    );
    const sinDecidir = dxs.filter((x) => x.estado !== "aceptado" && x.estado !== "rechazado");
    exigir(
      !sinDecidir.length,
      "Falta decidir sobre algunos diagnósticos.",
      sinDecidir.map((x) => `Diagnóstico ${x.orden}: ${x.cie10_adecuado ?? x.cie10}`),
    );
    const aceptados = dxs.filter((x) => x.estado === "aceptado");
    const rechazados = dxs.filter((x) => x.estado === "rechazado");
    const hoy = hoyCtx(ctx);

    if (rechazados.length) {
      const lista = rechazados
        .map((x) => `${x.cie10_adecuado ?? x.cie10} (${MOTIVO_RECHAZO_INFO[x.motivo_rechazo!].nombre})`)
        .join("; ");
      await notificarTrabajador(
        tx,
        ctx,
        exp,
        `Expediente ${exp.numero}: notificación de rechazo`,
        `Se rechazan los siguientes diagnósticos: ${lista}. Se adjuntan los fundamentos y, cuando corresponde, el relevamiento CYMAT o los estudios en que se basa la decisión.`,
      );
      await registrarMovimiento(tx, ctx, {
        expediente_id: exp.id,
        accion: "notificacion_rechazo",
        detalle: `Se emitió la notificación de rechazo (${rechazados.length} diagnóstico${rechazados.length > 1 ? "s" : ""}).`,
      });
    }

    if (!aceptados.length) {
      await cambiarEstado(tx, ctx, exp, "rechazado", "dictamen", "Dictamen legal: contingencia rechazada.");
    } else if (exp.con_baja) {
      const proxima = sumarDias(hoy, PLAZOS.primeraPresentacionDias);
      await cambiarEstado(
        tx,
        ctx,
        exp,
        "licencia_activa",
        "dictamen",
        `Dictamen legal: contingencia aceptada con baja laboral. Primera presentación: ${formatoFecha(proxima)}.`,
        { proxima_presentacion: proxima },
      );
    } else {
      const vence = sumarDiasHabiles(hoy, PLAZOS.sinBajaDiasHabiles, await cargarFeriados(tx));
      await cambiarEstado(
        tx,
        ctx,
        exp,
        "sin_baja",
        "dictamen",
        `Dictamen legal: contingencia aceptada sin baja laboral. Presentar el trámite ante la Comisión Médica antes del ${formatoFecha(vence)}.`,
        { cm_vence: vence },
      );
    }

    if (aceptados.length) {
      await notificarTrabajador(
        tx,
        ctx,
        exp,
        `Expediente ${exp.numero}: contingencia aceptada`,
        `Se acepta el carácter laboral de la contingencia ${exp.con_baja ? "con" : "sin"} baja laboral.`,
      );
      await notificarEmpleador(
        tx,
        ctx,
        exp,
        `Resultado de la evaluación del expediente ${exp.numero}`,
        `Contingencia aceptada ${exp.con_baja ? "con" : "sin"} baja laboral (notificación dentro del día hábil siguiente, Anexo II pto. 4.1).`,
      );
    }
    if (exp.tipo === "EP") {
      await cambiarEstadoFODEP(tx, ctx, exp, 4, "Resolución informada al Registro de EP por el Sistema de Intercambio");
    }
  });
}
