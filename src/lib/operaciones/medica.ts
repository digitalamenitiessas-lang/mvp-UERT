/**
 * Área médica: evaluación por diagnóstico, citaciones (con reiteración y
 * caducidad), baja laboral, reencuadre de AT a EP y pase al área legal.
 */
import { CODIGOS_EXAMEN_SIN_FODEP, MAX_DIAGNOSTICOS_EP, MOTIVO_CITACION_INFO, PLAZOS } from "@/lib/dominio/constantes";
import { formatoFecha, formatoFechaHora, momentoArgentina, sumarDias, sumarDiasHabiles } from "@/lib/dominio/fechas";
import {
  esquemaAgregarDiagnostico,
  esquemaAsistencia,
  esquemaBaja,
  esquemaCitacion,
  esquemaEvaluacion,
  esquemaReencuadre,
} from "@/lib/esquemas";
import type { Citacion, Diagnostico } from "@/lib/tipos";
import {
  actualizarExpediente,
  bloquearExpediente,
  cambiarEstado,
  cargarFeriados,
  ErrorNegocio,
  exigir,
  exigirPermiso,
  hoyCtx,
  nulo,
  registrarMovimiento,
  validar,
  verificarCodigos,
  verificarLocalidad,
  type Ctx,
} from "./contexto";
import { desistirInterno } from "./recepcion";
import {
  cambiarEstadoFODEP,
  informarAltaFODEP,
  informarDiagnosticoFODEP,
  notificarEmpleador,
  notificarTrabajador,
} from "./srt";

export async function agregarDiagnostico(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaAgregarDiagnostico, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "agregar_diagnostico", exp.estado);
    await verificarCodigos(tx, "cat_cie10", [d.cie10], "Diagnóstico CIE-10");
    await verificarCodigos(tx, "cat_agente_causante", [d.agente_causante], "Agente causante");
    const { rows } = await tx.query<{ n: number; max: number }>(
      "select count(*)::int as n, coalesce(max(orden), 0) as max from diagnosticos where expediente_id = $1",
      [exp.id],
    );
    if (exp.tipo === "EP") {
      exigir(rows[0].n < MAX_DIAGNOSTICOS_EP, "La denuncia de EP admite hasta 10 diagnósticos.");
      exigir(d.agente_causante, "En una enfermedad profesional cada diagnóstico lleva su agente causante.");
    }
    await tx.query(
      `insert into diagnosticos (expediente_id, orden, cie10, agente_causante, codigo_examen, origen)
       values ($1, $2, $3, $4, $5, 'evaluacion')`,
      [exp.id, rows[0].max + 1, d.cie10, nulo(d.agente_causante), exp.tipo === "EP" ? "F" : null],
    );
    if (exp.tipo !== "EP") {
      await registrarMovimiento(tx, ctx, {
        expediente_id: exp.id,
        accion: "diagnostico",
        detalle: `Se agregó el diagnóstico ${d.cie10}.`,
      });
      return;
    }
    // Patología detectada en la evaluación: se suma al formulario FODEP y se notifica (Anexo II pto. 3.6)
    await informarDiagnosticoFODEP(tx, ctx, exp, { CIE10: d.cie10, AgenteCausante: d.agente_causante });
    const aviso = `En la evaluación médica se detectó la patología ${d.cie10}, que se suma a la denuncia de enfermedad profesional (Anexo II pto. 3.6).`;
    await notificarTrabajador(tx, ctx, exp, `Expediente ${exp.numero}: patología detectada en la evaluación`, aviso);
    await notificarEmpleador(tx, ctx, exp, `Expediente ${exp.numero}: patología detectada en la evaluación`, aviso);
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "diagnostico",
      detalle:
        `Se agregó el diagnóstico ${d.cie10} detectado en la evaluación. Se notificó al trabajador y al empleador (Anexo II pto. 3.6)` +
        (exp.fodep_codigo ? " y se sumó al formulario FODEP de la SRT." : "."),
    });
  });
}

export async function evaluarDiagnostico(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaEvaluacion, entrada);
  await ctx.db.transaction(async (tx) => {
    const { rows: dxs } = await tx.query<Diagnostico>("select * from diagnosticos where id = $1", [d.diagnostico_id]);
    const dx = dxs[0];
    exigir(dx, "El diagnóstico no existe.");
    const exp = await bloquearExpediente(tx, dx.expediente_id);
    exigirPermiso(ctx, "evaluar_diagnostico", exp.estado);
    exigir(dx.estado === "invocado" || dx.estado === "evaluado", "Este diagnóstico ya no se puede evaluar.");
    exigir(d.fecha_diagnostico <= hoyCtx(ctx), "La fecha del diagnóstico no puede ser posterior a hoy.");
    await verificarCodigos(tx, "cat_cie10", [d.cie10_adecuado], "CIE-10 adecuado");
    await verificarCodigos(tx, "cat_lesion", d.lesiones, "Lesión");
    await verificarCodigos(tx, "cat_zona_cuerpo", d.zonas, "Zona del cuerpo");
    if (exp.tipo === "AT" || exp.tipo === "IT") {
      exigir(d.lesiones.length > 0, "En un accidente indicá al menos una lesión.");
      // Con los demás códigos el archivo .AD exige el ID_FODEP, que un accidente no tiene.
      exigir(
        !d.codigo_examen || CODIGOS_EXAMEN_SIN_FODEP.includes(d.codigo_examen),
        `En un accidente el examen de detección solo puede ser ${CODIGOS_EXAMEN_SIN_FODEP.join(", ")} o quedar sin indicar: los demás códigos exigen un formulario FODEP.`,
      );
    }
    if (exp.tipo === "EP") {
      exigir(d.en_listado !== null, "Indicá si la patología está incluida en el Listado (Decreto 658/96).");
    }
    const codigoExamen = d.codigo_examen || (exp.tipo === "EP" ? "F" : null);
    await tx.query(
      `update diagnosticos set
         cie10_adecuado = $2, patologia_constatada = $3, en_listado = $4, fecha_diagnostico = $5,
         codigo_examen = $6, observacion_medica = $7, estado = 'evaluado', evaluado_en = $8,
         intercambio_estado = case when intercambio_estado = 'informado' then 'modificado' else intercambio_estado end
       where id = $1`,
      [
        dx.id,
        nulo(d.cie10_adecuado),
        d.patologia_constatada,
        exp.tipo === "EP" ? d.en_listado : null,
        d.fecha_diagnostico,
        codigoExamen,
        nulo(d.observacion_medica),
        ctx.ahora,
      ],
    );
    await tx.query("delete from diagnostico_lesiones where diagnostico_id = $1", [dx.id]);
    await tx.query("delete from diagnostico_zonas where diagnostico_id = $1", [dx.id]);
    for (const [i, codigo] of [...new Set(d.lesiones)].entries()) {
      await tx.query("insert into diagnostico_lesiones (diagnostico_id, orden, codigo) values ($1, $2, $3)", [dx.id, i + 1, codigo]);
    }
    for (const [i, codigo] of [...new Set(d.zonas)].entries()) {
      await tx.query("insert into diagnostico_zonas (diagnostico_id, orden, codigo) values ($1, $2, $3)", [dx.id, i + 1, codigo]);
    }
    const notas = [
      d.cie10_adecuado && d.cie10_adecuado !== dx.cie10 ? `adecuado a ${d.cie10_adecuado} (CIE-10)` : null,
      d.patologia_constatada ? "patología constatada" : "patología no constatada",
      exp.tipo === "EP" ? (d.en_listado ? "incluida en el Listado" : "no incluida en el Listado") : null,
    ].filter(Boolean);
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "evaluacion",
      detalle: `Diagnóstico ${dx.orden} (${dx.cie10}) evaluado: ${notas.join(", ")}.`,
    });
  });
}

/**
 * Citación a examen o a presentar documentación. Se notifica por e-Servicios
 * de la SRT y al email del formulario con al menos 72 h de anticipación
 * (Anexo II pto. 1.6). Una citación sin asistencia se reitera una sola vez.
 */
export async function programarCitacion(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaCitacion, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "programar_citacion", exp.estado);
    const fechaHora = momentoArgentina(d.fecha, d.hora);
    const minimo = new Date(ctx.ahora.getTime() + PLAZOS.citacionHorasMinimas * 3_600_000);
    exigir(
      fechaHora >= minimo,
      `La citación se notifica con al menos ${PLAZOS.citacionHorasMinimas} horas de anticipación: elegí una fecha desde el ${formatoFechaHora(minimo)}.`,
    );
    const { rows: pendientes } = await tx.query<Citacion>(
      "select * from citaciones where expediente_id = $1 and estado = 'programada'",
      [exp.id],
    );
    exigir(!pendientes.length, "Ya hay una citación programada: registrá primero si asistió.");
    if (!d.reiteracion_de) {
      // Una inasistencia se reitera por única vez: la próxima citación es esa reiteración (si no, nunca caducaría).
      const { rows: sinReiterar } = await tx.query(
        `select 1 from citaciones c
          where c.expediente_id = $1 and c.estado = 'no_asistio' and c.reiteracion_de is null
            and not exists (select 1 from citaciones r where r.reiteracion_de = c.id)`,
        [exp.id],
      );
      exigir(
        !sinReiterar.length,
        "El trabajador no asistió a la última citación: la próxima tiene que ser su reiteración, por única vez y bajo apercibimiento de caducidad (Anexo II pto. 3.3).",
      );
    }
    if (d.reiteracion_de) {
      const { rows } = await tx.query<Citacion & { reiterada: boolean }>(
        `select c.*, exists(select 1 from citaciones r where r.reiteracion_de = c.id) as reiterada
           from citaciones c where c.id = $1 and c.expediente_id = $2`,
        [d.reiteracion_de, exp.id],
      );
      const original = rows[0];
      exigir(original, "La citación a reiterar no existe.");
      exigir(original.estado === "no_asistio", "Solo se reitera una citación a la que el trabajador no asistió.");
      exigir(!original.reiteracion_de, "La reiteración es por única vez: no se puede reiterar una reiteración.");
      exigir(!original.reiterada, "Esa citación ya fue reiterada.");
    }
    await tx.query(
      `insert into citaciones (expediente_id, reiteracion_de, fecha_hora, motivo, lugar, detalle, estado, notificada_en, creada_por)
       values ($1, $2, $3, $4, $5, $6, 'programada', $7, $8)`,
      [exp.id, d.reiteracion_de, fechaHora, d.motivo, d.lugar, nulo(d.detalle), ctx.ahora, ctx.usuario.id],
    );
    const que = MOTIVO_CITACION_INFO[d.motivo].toLowerCase();
    const cuando = formatoFechaHora(fechaHora);
    await notificarTrabajador(
      tx,
      ctx,
      exp,
      d.reiteracion_de ? `Expediente ${exp.numero}: reiteración de citación` : `Expediente ${exp.numero}: citación`,
      d.reiteracion_de
        ? `Se reitera por única vez la citación (${que}) para el ${cuando} en ${d.lugar}, bajo apercibimiento de caducidad del trámite (Anexo II pto. 3.3).`
        : `Se lo cita (${que}) para el ${cuando} en ${d.lugar}.`,
    );
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "citacion",
      detalle: `${d.reiteracion_de ? "Reiteración de la citación" : "Citación"} (${que}) para el ${cuando} en ${d.lugar}. Notificada por e-Servicios SRT y email (simulado).`,
    });
  });
}

export async function registrarAsistencia(ctx: Ctx, entrada: unknown): Promise<{ caducidad: boolean }> {
  const d = validar(esquemaAsistencia, entrada);
  return ctx.db.transaction(async (tx) => {
    const { rows } = await tx.query<Citacion>("select * from citaciones where id = $1", [d.citacion_id]);
    const cit = rows[0];
    exigir(cit, "La citación no existe.");
    const exp = await bloquearExpediente(tx, cit.expediente_id);
    exigirPermiso(ctx, "registrar_asistencia", exp.estado);
    exigir(cit.estado === "programada", "El resultado de esta citación ya está registrado.");
    // La inasistencia (y con la reiteración, la caducidad) recién se puede registrar cuando pasó la fecha y hora.
    exigir(
      d.asistio || new Date(cit.fecha_hora).getTime() <= ctx.ahora.getTime(),
      `La citación es el ${formatoFechaHora(cit.fecha_hora)}: la inasistencia se registra después de esa fecha y hora.`,
    );
    await tx.query("update citaciones set estado = $2, resultado_registrado_en = $3 where id = $1", [
      cit.id,
      d.asistio ? "asistio" : "no_asistio",
      ctx.ahora,
    ]);
    const anticipado = cit.fecha_hora > ctx.ahora;
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "asistencia",
      detalle:
        (d.asistio
          ? `El trabajador asistió a la citación del ${formatoFechaHora(cit.fecha_hora)}.`
          : `El trabajador no asistió a la citación del ${formatoFechaHora(cit.fecha_hora)}.`) +
        (!d.asistio && !cit.reiteracion_de ? " Corresponde reiterarla por única vez, bajo apercibimiento de caducidad." : ""),
      datos: anticipado ? { registrado_antes_de_la_fecha: true } : null,
    });
    if (!d.asistio && cit.reiteracion_de) {
      await desistirInterno(
        tx,
        ctx,
        exp,
        "incomparecencia",
        "Segunda inasistencia: caducidad del trámite (Anexo II pto. 3.3). No constituye rechazo.",
      );
      return { caducidad: true };
    }
    return { caducidad: false };
  });
}

export async function definirBaja(ctx: Ctx, entrada: unknown): Promise<void> {
  const d = validar(esquemaBaja, entrada);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "definir_baja", exp.estado);
    const inicio = d.con_baja ? d.fecha_inicio_inasistencia : null;
    if (inicio) {
      // RF-20: como mínimo el día siguiente a la ocurrencia (Res. SRT 3326/14)
      if (exp.fecha_ocurrencia && exp.tipo !== "EP") {
        const minimo = sumarDias(exp.fecha_ocurrencia, 1);
        exigir(
          inicio >= minimo,
          `El inicio de la inasistencia debe ser, como mínimo, el día siguiente al siniestro (${formatoFecha(minimo)}).`,
        );
      }
      exigir(inicio <= sumarDias(hoyCtx(ctx), 30), "El inicio de la inasistencia es demasiado lejano.");
    }
    await actualizarExpediente(tx, ctx, exp.id, {
      con_baja: d.con_baja,
      fecha_inicio_inasistencia: inicio,
      estres_postraumatico: d.estres_postraumatico,
    });
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "baja",
      detalle:
        (d.con_baja ? `Con baja laboral desde el ${formatoFecha(inicio)}.` : "Sin baja laboral.") +
        (d.estres_postraumatico ? " Se indicó estrés postraumático." : ""),
    });
  });
}

/**
 * Reencuadre de un accidente como enfermedad profesional (Anexo II pto.
 * 1.5): no requiere un nuevo formulario y el plazo corre desde el reencuadre.
 * Es todo o nada: si la SRT rechaza la denuncia FODEP, no se reencuadra (una
 * EP sin N° FODEP no tendría cómo informarse después).
 */
export async function reencuadrarComoEP(ctx: Ctx, entrada: unknown): Promise<{ informado: boolean }> {
  const d = validar(esquemaReencuadre, entrada);
  return ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, d.expediente_id);
    exigirPermiso(ctx, "reencuadrar_ep", exp.estado);
    exigir(exp.tipo === "AT", "Solo se reencuadra un accidente de trabajo.");
    await verificarCodigos(tx, "cat_agente_causante", [d.agente_causante], "Agente de riesgo");
    await verificarLocalidad(tx, d.localidad_laboral_id ?? null, "Domicilio laboral");
    const { rows: dxs } = await tx.query<{ n: number }>(
      "select count(*)::int as n from diagnosticos where expediente_id = $1 and estado <> 'desistido'",
      [exp.id],
    );
    exigir(dxs[0].n > 0, "Agregá al menos un diagnóstico antes de reencuadrar: la denuncia FODEP lo exige.");

    // Datos que la denuncia FODEP exige y que en el accidente pudieron quedar sin cargar
    const telefono = nulo(d.telefono);
    const email = nulo(d.email)?.toLowerCase() ?? null;
    if (telefono || email) {
      await tx.query("update personas set telefono = coalesce($2, telefono), email = coalesce($3, email) where id = $1", [
        exp.persona_id,
        telefono,
        email,
      ]);
    }
    const laborales = Object.fromEntries(
      Object.entries({
        domicilio_laboral: nulo(d.domicilio_laboral),
        localidad_laboral_id: d.localidad_laboral_id ?? null,
        puesto: nulo(d.puesto),
        tareas: nulo(d.tareas),
        antiguedad_empresa: nulo(d.antiguedad_empresa),
        antiguedad_area: nulo(d.antiguedad_area),
      }).filter(([, v]) => v !== null),
    );
    await actualizarExpediente(tx, ctx, exp.id, {
      tipo: "EP",
      reencuadrado_en: ctx.ahora,
      exposicion_desde: d.exposicion_desde,
      pluriempleo: false,
      ...laborales,
    });
    Object.assign(exp, laborales, {
      tipo: "EP",
      reencuadrado_en: ctx.ahora,
      exposicion_desde: d.exposicion_desde,
      pluriempleo: false,
    });
    await tx.query(
      `update diagnosticos set agente_causante = coalesce(agente_causante, $2), codigo_examen = coalesce(codigo_examen, 'F')
        where expediente_id = $1`,
      [exp.id, d.agente_causante],
    );
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "reencuadre",
      detalle: "Se reencuadró la denuncia como enfermedad profesional (Anexo II pto. 1.5)." + (d.observacion ? ` ${d.observacion}` : ""),
    });
    await notificarTrabajador(
      tx,
      ctx,
      exp,
      `Expediente ${exp.numero}: reencuadre como enfermedad profesional`,
      "La denuncia de accidente se reencuadró como enfermedad profesional. No hace falta presentar un nuevo formulario.",
    );
    const r = await informarAltaFODEP(tx, ctx, exp);
    if (!r.ok) {
      // Se deshace todo: el expediente sigue como accidente y se puede volver a intentar.
      throw new ErrorNegocio(
        "La SRT rechazó la denuncia FODEP, así que el expediente sigue como accidente de trabajo. Completá lo que falta y volvé a intentar.",
        r.errores.map((e) => `${e.codigo}${e.campo ? ` (${e.campo})` : ""}: ${e.mensaje}`),
      );
    }
    // Igual que una EP que pasa de Mesa de entrada: configurada y en análisis.
    await cambiarEstadoFODEP(tx, ctx, exp, 3, "Reencuadre de un accidente: la denuncia sigue en evaluación médica");
    return { informado: true };
  });
}

/** Pase al área legal: todos los diagnósticos evaluados y la baja definida. */
export async function pasarALegal(ctx: Ctx, entrada: { expediente_id: number }): Promise<void> {
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, Number(entrada.expediente_id));
    exigirPermiso(ctx, "pasar_a_legal", exp.estado);
    const { rows: dxs } = await tx.query<Diagnostico>(
      "select * from diagnosticos where expediente_id = $1 and estado <> 'desistido' order by orden",
      [exp.id],
    );
    exigir(dxs.length > 0, "Cargá al menos un diagnóstico antes de pasar al área legal.");
    const pendientes = dxs.filter((x) => x.estado !== "evaluado");
    exigir(
      !pendientes.length,
      "Faltan evaluar diagnósticos.",
      pendientes.map((x) => `Diagnóstico ${x.orden}: ${x.cie10}`),
    );
    exigir(exp.con_baja !== null, "Definí si la contingencia es con o sin baja laboral.");
    const { rows: cits } = await tx.query("select 1 from citaciones where expediente_id = $1 and estado = 'programada'", [exp.id]);
    exigir(!cits.length, "Hay una citación pendiente: registrá su resultado antes del pase.");
    const hoy = hoyCtx(ctx);
    const vence = sumarDiasHabiles(hoy, PLAZOS.legalDiasHabiles, await cargarFeriados(tx));
    await cambiarEstado(
      tx,
      ctx,
      exp,
      "dictamen_legal",
      "pase_legal",
      `Pase al Área legal. Plazo para expedirse: ${PLAZOS.legalDiasHabiles} días hábiles (vence el ${formatoFecha(vence)}).`,
      { legal_ingreso: hoy, legal_vence: vence },
    );
  });
}
