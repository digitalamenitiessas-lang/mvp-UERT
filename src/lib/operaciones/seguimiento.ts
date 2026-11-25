/**
 * Seguimiento de la licencia (submódulo 3): presentaciones periódicas,
 * intercurrencias, alta médica y presentación ante la Comisión Médica.
 */
import { MOTIVO_CESE_ILT_INFO, PLAZOS } from "@/lib/dominio/constantes";
import { nombreDocumento } from "@/lib/dominio/documentos";
import { formatoFecha, sumarDias } from "@/lib/dominio/fechas";
import { esquemaAlta, esquemaIntercurrencia, esquemaPresentacion, esquemaPresentacionCM } from "@/lib/esquemas";
import {
  actualizarExpediente,
  bloquearExpediente,
  cambiarEstado,
  exigir,
  exigirPermiso,
  hoyCtx,
  nulo,
  registrarMovimiento,
  validar,
  verificarCodigos,
  type Ctx,
} from "./contexto";
import { notificarEmpleador, notificarTrabajador } from "./srt";

export async function registrarPresentacion(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaPresentacion, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "registrar_presentacion", exp.estado);
    const hoy = hoyCtx(ctx);
    exigir(d.fecha <= hoy, "La fecha de la presentación no puede ser posterior a hoy.");
    if (d.proxima_fecha) exigir(d.proxima_fecha > hoy, "La próxima presentación debe ser posterior a hoy.");
    await tx.query(
      `insert into presentaciones (expediente_id, fecha, detalle, proxima_fecha, registrada_por, registrada_en)
       values ($1, $2, $3, $4, $5, $6)`,
      [exp.id, d.fecha, d.detalle, nulo(d.proxima_fecha), ctx.usuario.id, ctx.ahora],
    );
    for (const doc of d.documentos) {
      await tx.query(
        `insert into documentos (expediente_id, tipo, nombre_archivo, tamano_bytes, etapa, cargado_por, cargado_en)
         values ($1, $2, $3, $4, 'seguimiento', $5, $6)`,
        [exp.id, doc.tipo, nulo(doc.nombre_archivo), doc.tamano_bytes, ctx.usuario.id, ctx.ahora],
      );
    }
    await actualizarExpediente(tx, ctx, exp.id, { proxima_presentacion: nulo(d.proxima_fecha) });
    const docs = d.documentos.map((x) => nombreDocumento(x.tipo)).join(", ");
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "presentacion",
      detalle:
        `Presentación del ${formatoFecha(d.fecha)}: ${d.detalle.replace(/[\s.]+$/, "")}.` +
        (docs ? ` Documentos: ${docs}.` : "") +
        (d.proxima_fecha ? ` Próxima presentación: ${formatoFecha(d.proxima_fecha)}.` : ""),
    });
    if (d.proxima_fecha) {
      await notificarTrabajador(
        tx,
        ctx,
        exp,
        `Expediente ${exp.numero}: próxima presentación`,
        `Debe presentarse el ${formatoFecha(d.proxima_fecha)} con la documentación indicada.`,
      );
    }
  });
}

/**
 * Intercurrencia (RF-18, RF-26): hecho ocurrido durante la licencia activa,
 * por el tratamiento o en el traslado al prestador. Se carga como un siniestro
 * nuevo, vinculado al anterior, y va directo al área médica.
 */
export async function registrarIntercurrencia(ctx: Ctx, entrada: unknown): Promise<{ id: number; numero: string }> {
  const d = validar(esquemaIntercurrencia, entrada);
  return ctx.db.transaction(async (tx) => {
    const origen = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "registrar_intercurrencia", origen.estado);
    const hoy = hoyCtx(ctx);
    exigir(d.fecha_ocurrencia <= hoy, "La fecha no puede ser posterior a hoy.");
    if (origen.fecha_inicio_inasistencia) {
      exigir(
        d.fecha_ocurrencia >= origen.fecha_inicio_inasistencia,
        `La intercurrencia ocurre durante la licencia (desde el ${formatoFecha(origen.fecha_inicio_inasistencia)}).`,
      );
    }
    await verificarCodigos(tx, "cat_cie10", [d.cie10], "Diagnóstico CIE-10");
    const anio = Number(hoy.slice(0, 4));
    const { rows: c } = await tx.query<{ ultimo: number }>(
      `insert into contadores (anio, ultimo) values ($1, 1)
       on conflict (anio) do update set ultimo = contadores.ultimo + 1 returning ultimo`,
      [anio],
    );
    const { rows } = await tx.query<{ id: number; numero: string }>(
      `insert into expedientes (
         anio, contador, sufijo, tipo, estado, persona_id, origen_id, es_intercurrencia,
         canal, denunciante_tipo, denunciante_nombre, denunciante_email, denunciante_telefono,
         recibido_en, recibido_por, reparticion, cuit_empleador, codigo_establecimiento,
         domicilio_laboral, localidad_laboral_id, puesto, ciuo, tareas, antiguedad_empresa, antiguedad_area,
         fecha_ocurrencia, descripcion, relacion_laboral_verificada, verificado_en, creado_en, actualizado_en)
       select $2, $3, 0, 'AT', 'evaluacion_medica', persona_id, id, true,
         'presencial', 'trabajador', denunciante_nombre, denunciante_email, denunciante_telefono,
         $4, $5, reparticion, cuit_empleador, codigo_establecimiento,
         domicilio_laboral, localidad_laboral_id, puesto, ciuo, tareas, antiguedad_empresa, antiguedad_area,
         $6, $7, true, $4, $4, $4
       from expedientes where id = $1
       returning id, numero`,
      [origen.id, anio, c[0].ultimo, ctx.ahora, ctx.usuario.id, d.fecha_ocurrencia, d.descripcion],
    );
    const nuevo = rows[0];
    if (d.cie10) {
      await tx.query(
        "insert into diagnosticos (expediente_id, orden, cie10, origen) values ($1, 1, $2, 'denuncia')",
        [nuevo.id, d.cie10],
      );
    }
    await registrarMovimiento(tx, ctx, {
      expediente_id: nuevo.id,
      accion: "intercurrencia",
      detalle: `Intercurrencia del siniestro ${origen.numero}: pasa directo al Área médica.`,
      estado_nuevo: "evaluacion_medica",
    });
    await registrarMovimiento(tx, ctx, {
      expediente_id: origen.id,
      accion: "intercurrencia",
      detalle: `Se registró la intercurrencia ${nuevo.numero} durante la licencia.`,
      datos: { intercurrencia_id: nuevo.id },
    });
    return nuevo;
  });
}

/** Alta médica: fecha de alta = fecha de cese de la ILT (RF-21). */
export async function darAlta(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaAlta, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "dar_alta", exp.estado);
    exigir(d.fecha_alta <= hoyCtx(ctx), "La fecha de alta no puede ser posterior a hoy.");
    if (exp.fecha_inicio_inasistencia) {
      exigir(
        d.fecha_alta >= exp.fecha_inicio_inasistencia,
        `El alta no puede ser anterior al inicio de la licencia (${formatoFecha(exp.fecha_inicio_inasistencia)}).`,
      );
    }
    const tope = exp.fecha_ocurrencia ? sumarDias(exp.fecha_ocurrencia, PLAZOS.topeIltDias) : null;
    if (tope && d.motivo_cese_ilt === "L") {
      exigir(
        d.fecha_alta <= tope,
        `La ILT no puede superar los ${PLAZOS.topeIltDias} días desde el siniestro (tope: ${formatoFecha(tope)}). Usá el motivo "Transcurso de un año".`,
      );
    }
    if (d.motivo_cese_ilt === "T") {
      // El motivo T (RF-22) solo corresponde cuando se cumplió el año sin alta.
      exigir(
        tope !== null,
        `El motivo "Transcurso de un año" necesita la fecha del siniestro para calcular el tope de ${PLAZOS.topeIltDias} días.`,
      );
      exigir(
        d.fecha_alta >= tope,
        `El motivo "Transcurso de un año" corresponde solo cuando se cumplió el tope de ${PLAZOS.topeIltDias} días (${formatoFecha(tope)}). Antes de esa fecha elegí otro motivo.`,
      );
    }
    await cambiarEstado(
      tx,
      ctx,
      exp,
      "alta",
      "alta",
      `Fin de la ILT el ${formatoFecha(d.fecha_alta)}: ${MOTIVO_CESE_ILT_INFO[d.motivo_cese_ilt]}.`,
      { fecha_fin_ilt: d.fecha_alta, motivo_cese_ilt: d.motivo_cese_ilt, proxima_presentacion: null },
    );
    await notificarTrabajador(
      tx,
      ctx,
      exp,
      `Expediente ${exp.numero}: fin de la licencia`,
      `Fin de la incapacidad laboral temporaria el ${formatoFecha(d.fecha_alta)} (${MOTIVO_CESE_ILT_INFO[d.motivo_cese_ilt]}).`,
    );
    await notificarEmpleador(
      tx,
      ctx,
      exp,
      `Alta del expediente ${exp.numero}`,
      `El trabajador se reintegra: fin de la ILT el ${formatoFecha(d.fecha_alta)}.`,
    );
  });
}

export async function registrarPresentacionCM(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaPresentacionCM, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "registrar_presentacion_cm", exp.estado);
    exigir(d.fecha <= hoyCtx(ctx), "La fecha no puede ser posterior a hoy.");
    await cambiarEstado(
      tx,
      ctx,
      exp,
      "cerrado",
      "comision_medica",
      `Trámite presentado ante la Comisión Médica el ${formatoFecha(d.fecha)} para determinar u homologar la incapacidad (Res. EP, art. 9).`,
      { cm_presentado_en: d.fecha },
    );
  });
}
