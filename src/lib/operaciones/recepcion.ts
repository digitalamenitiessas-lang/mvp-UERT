/**
 * Mesa de entrada: configuración de la denuncia, documentación, pase al área
 * médica y desistimiento (Asentamiento de Actuaciones Previas).
 */
import type { Db } from "@/lib/db";
import { DESISTIMIENTO_INFO, PLAZOS, type MotivoDesistimiento } from "@/lib/dominio/constantes";
import { documentosFaltantes, nombreDocumento } from "@/lib/dominio/documentos";
import { esquemaDesistir, esquemaDocumento, esquemaVerificacion } from "@/lib/esquemas";
import type { Expediente } from "@/lib/tipos";
import { describirErrores, type ErrorFODEP } from "@/lib/srt/fodep";
import {
  actualizarExpediente,
  bloquearExpediente,
  cambiarEstado,
  exigir,
  exigirPermiso,
  nulo,
  registrarMovimiento,
  validar,
  type Ctx,
} from "./contexto";
import { cambiarEstadoFODEP, informarAltaFODEP, notificarTrabajador } from "./srt";

/**
 * Control de relación laboral y cotizaciones (Anexo II pto. 2). Si no se
 * corrobora, la denuncia no se configura: queda Desistida y se informa a la
 * SRT dentro de las 48 h.
 */
export async function verificarRelacionLaboral(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaVerificacion, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "verificar_relacion_laboral", exp.estado);
    await actualizarExpediente(tx, ctx, exp.id, { relacion_laboral_verificada: d.verificada, verificado_en: ctx.ahora });
    if (d.verificada) {
      await registrarMovimiento(tx, ctx, {
        expediente_id: exp.id,
        accion: "verificacion",
        detalle: "Se verificó la relación laboral y la existencia de cotizaciones." + (d.observacion ? ` ${d.observacion}` : ""),
      });
      return;
    }
    await desistirInterno(tx, ctx, exp, d.motivo!, nulo(d.observacion));
  });
}

export type ResultadoPase = { ok: true } | { ok: false; mensaje: string; errores: ErrorFODEP[] };

/**
 * Pase al área médica. Exige la relación laboral verificada y la
 * documentación obligatoria. En EP informa la denuncia a la SRT (WS FODEP):
 * si la SRT la rechaza, el expediente queda en Mesa de entrada con el error.
 */
export async function pasarAMedica(ctx: Ctx, entrada: { expediente_id: number }): Promise<ResultadoPase> {
  return ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, Number(entrada.expediente_id));
    exigirPermiso(ctx, "pasar_a_medica", exp.estado);
    exigir(
      exp.relacion_laboral_verificada === true,
      "Primero verificá la relación laboral y las cotizaciones (Anexo II, punto 2).",
    );
    // Los requisitos de reingresos e intercurrencias están pendientes de definir
    // con la UERT: por ahora no se exige la documentación de la recepción.
    if (!exp.es_reingreso && !exp.es_intercurrencia) {
      const { rows: docs } = await tx.query<{ tipo: string }>("select tipo from documentos where expediente_id = $1", [exp.id]);
      const faltan = documentosFaltantes(exp.tipo, docs.map((r) => r.tipo));
      exigir(
        faltan.length === 0,
        "Falta documentación obligatoria para pasar al área médica.",
        faltan.map((f) => f.nombre),
      );
    }
    if (exp.tipo === "EP") {
      const { rows } = await tx.query<{ n: number }>(
        "select count(*)::int as n from diagnosticos where expediente_id = $1",
        [exp.id],
      );
      exigir(rows[0].n > 0, "La denuncia de EP exige al menos un diagnóstico CIE-10.");
      const r = await informarAltaFODEP(tx, ctx, exp);
      if (!r.ok) {
        return {
          ok: false,
          mensaje: "La SRT rechazó la denuncia FODEP. Corregí los datos y volvé a intentar.",
          errores: r.errores,
        };
      }
      await cambiarEstadoFODEP(tx, ctx, exp, 3, "Denuncia configurada: pasa a evaluación médica");
    }
    await cambiarEstado(tx, ctx, exp, "evaluacion_medica", "pase_medica", "Pase al Área médica.");
    return { ok: true };
  });
}

/** Desistimiento manual (Mesa de entrada o Área médica). */
export async function desistir(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaDesistir, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "desistir", exp.estado);
    await desistirInterno(tx, ctx, exp, d.motivo, nulo(d.observacion));
  });
}

/**
 * Deja el expediente Desistido (Asentamiento de Actuaciones Previas): no es
 * un rechazo ni habilita la Comisión Médica. En EP se informa a la SRT por
 * Web Service y se notifica al trabajador.
 */
export async function desistirInterno(
  tx: Db,
  ctx: Ctx,
  exp: Expediente,
  motivo: MotivoDesistimiento,
  observacion: string | null,
): Promise<void> {
  // En EP, si la denuncia todavía no se informó, primero se da de alta en la
  // SRT con sus diagnósticos invocados (antes de marcarlos como desistidos).
  const alta = exp.tipo === "EP" ? await informarAltaFODEP(tx, ctx, exp) : null;
  // Los diagnósticos que ya se informaron por el Sistema de Intercambio se dan de baja (B) en el próximo lote.
  await tx.query(
    `update diagnosticos set estado = 'desistido',
       intercambio_estado = case when intercambio_estado = 'informado' then 'modificado' else intercambio_estado end
     where expediente_id = $1 and estado in ('invocado','evaluado')`,
    [exp.id],
  );
  await cambiarEstado(
    tx,
    ctx,
    exp,
    "desistido",
    "desistimiento",
    `Desistido: ${DESISTIMIENTO_INFO[motivo]}.` + (observacion ? ` ${observacion}` : ""),
    { desistido_motivo: motivo },
  );
  if (alta?.ok) {
    await cambiarEstadoFODEP(tx, ctx, exp, 2, DESISTIMIENTO_INFO[motivo]);
  } else if (alta && !alta.ok) {
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "srt_pendiente",
      detalle: `Queda pendiente informar el desistimiento a la SRT (plazo: ${PLAZOS.configuracionHoras} h): ${describirErrores(alta.errores)}`,
    });
  }
  const textos: Record<MotivoDesistimiento, string> = {
    falta_cobertura: "La denuncia es improcedente por falta de cobertura.",
    relacion_no_corroborada: "No se pudo corroborar la relación laboral denunciada.",
    inconsistencia_diagnostico: "La denuncia no pudo prosperar por inconsistencias en el diagnóstico.",
    incomparecencia:
      "La denuncia no pudo prosperar por las reiteradas inasistencias o la falta de presentación de la documentación requerida. Esto no constituye un rechazo: puede efectuar una nueva presentación.",
  };
  await notificarTrabajador(tx, ctx, exp, `Expediente ${exp.numero}: denuncia desistida`, textos[motivo]);
}

export async function adjuntarDocumento(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaDocumento, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "adjuntar_documento", exp.estado);
    const etapa =
      ctx.usuario.rol === "medico" ? "medica" : ctx.usuario.rol === "legal" ? "legal" : ctx.usuario.rol === "seguimiento" ? "seguimiento" : "recepcion";
    await tx.query(
      `insert into documentos (expediente_id, tipo, nombre_archivo, tamano_bytes, etapa, observacion, cargado_por, cargado_en)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [exp.id, d.tipo, d.nombre_archivo, d.tamano_bytes, etapa, nulo(d.observacion), ctx.usuario.id, ctx.ahora],
    );
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "documento",
      detalle: `Se adjuntó: ${nombreDocumento(d.tipo)} (${d.nombre_archivo}).`,
    });
  });
}
