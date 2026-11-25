/**
 * Alta de denuncias: nueva denuncia (Mesa de entrada) y reingreso de un
 * siniestro dado de alta (RF-24, RF-27).
 */
import type { Db } from "@/lib/db";
import { CANAL_INFO, ESTADO_INFO, TIPO_INFO } from "@/lib/dominio/constantes";
import { formatoFecha } from "@/lib/dominio/fechas";
import { esquemaNuevaDenuncia, esquemaReingreso, type NuevaDenunciaEntrada } from "@/lib/esquemas";
import type { Expediente, Persona } from "@/lib/tipos";
import { soloDigitos } from "@/lib/dominio/validaciones";
import {
  ErrorNegocio,
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
  verificarLocalidad,
  type Ctx,
} from "./contexto";
import { cambiarEstadoFODEP, informarAltaFODEP } from "./srt";

const ESTADOS_ABIERTOS = Object.entries(ESTADO_INFO)
  .filter(([, v]) => v.abierto)
  .map(([k]) => k);

export interface SiniestroAbierto {
  origen: "nuevo" | "actual";
  id: number | null;
  numero: string;
  estado: string;
  tipo: string;
  licencia_activa: boolean;
}

/** Siniestros abiertos de una persona, en este sistema y en el que se usa hoy (RF-25). */
export async function siniestrosAbiertos(db: Db, cuil: string, dni: string): Promise<SiniestroAbierto[]> {
  const nuevos = await db.query<{ id: number; numero: string; estado: string; tipo: string }>(
    `select e.id, e.numero, e.estado, e.tipo
       from expedientes e join personas p on p.id = e.persona_id
      where (p.cuil = $1 or p.dni = $2) and e.estado = any($3)
      order by e.recibido_en desc`,
    [cuil, dni, ESTADOS_ABIERTOS],
  );
  const legado = await db.query<{ numero: string; estado: string; tipo: string }>(
    `select numero, estado, tipo from legado_siniestros where abierto and (cuil = $1 or dni = $2)`,
    [cuil, dni],
  );
  return [
    ...nuevos.rows.map((r) => ({
      origen: "nuevo" as const,
      id: r.id,
      numero: r.numero,
      estado: ESTADO_INFO[r.estado as keyof typeof ESTADO_INFO]?.nombre ?? r.estado,
      tipo: TIPO_INFO[r.tipo as keyof typeof TIPO_INFO]?.nombre ?? r.tipo,
      licencia_activa: r.estado === "licencia_activa",
    })),
    ...legado.rows.map((r) => ({
      origen: "actual" as const,
      id: null,
      numero: r.numero,
      estado: r.estado,
      tipo: r.tipo,
      licencia_activa: false,
    })),
  ];
}

async function siguienteContador(tx: Db, anio: number): Promise<number> {
  const { rows } = await tx.query<{ ultimo: number }>(
    `insert into contadores (anio, ultimo) values ($1, 1)
     on conflict (anio) do update set ultimo = contadores.ultimo + 1
     returning ultimo`,
    [anio],
  );
  return rows[0].ultimo;
}

export interface DenunciaCreada {
  id: number;
  numero: string;
}

export async function crearDenuncia(ctx: Ctx, entrada: NuevaDenunciaEntrada): Promise<DenunciaCreada> {
  exigirPermiso(ctx, "crear_denuncia");
  const d = validar(esquemaNuevaDenuncia, entrada);

  return ctx.db.transaction(async (tx) => {
    const hoy = hoyCtx(ctx);
    exigir(!d.fecha_ocurrencia || d.fecha_ocurrencia <= hoy, "La fecha del hecho no puede ser posterior a hoy.");

    await verificarCodigos(tx, "cat_cie10", d.diagnosticos.map((x) => x.cie10), "Diagnóstico CIE-10");
    await verificarCodigos(tx, "cat_agente_causante", d.diagnosticos.map((x) => x.agente_causante), "Agente causante");
    await verificarCodigos(tx, "cat_forma_accidente", [d.forma_accidente], "Forma del accidente");
    await verificarCodigos(tx, "cat_agente_material", [d.agente_material], "Agente material");
    await verificarCodigos(tx, "cat_ciuo88", [d.ciuo], "Puesto (CIUO)");
    await verificarLocalidad(tx, d.localidad_id, "Domicilio del trabajador");
    await verificarLocalidad(tx, d.localidad_laboral_id, "Domicilio laboral");
    await verificarLocalidad(tx, d.localidad_ocurrencia_id, "Lugar del hecho");

    // Siniestros abiertos de la persona (RF-25 a RF-28)
    const abiertos = await siniestrosAbiertos(tx, d.cuil, d.dni);
    let origen: Expediente | null = null;
    if (d.origen_id) {
      origen = await bloquearExpediente(tx, d.origen_id);
      const { rows } = await tx.query<{ cuil: string }>("select cuil from personas where id = $1", [origen.persona_id]);
      exigir(rows[0]?.cuil === d.cuil, "El siniestro vinculado no corresponde a esta persona.");
      exigir(
        origen.estado === "licencia_activa",
        "Una intercurrencia se vincula a un siniestro con licencia activa.",
      );
    } else if (abiertos.length && !d.confirmo_hecho_distinto) {
      throw new ErrorNegocio(
        "La persona tiene siniestros abiertos. Si el hecho ocurrió durante la licencia, cargalo como intercurrencia; si es un hecho distinto, confirmalo.",
        abiertos.map((a) => `${a.numero} · ${a.tipo} · ${a.estado}${a.origen === "actual" ? " (sistema actual)" : ""}`),
      );
    }

    // Persona: se crea o se actualizan sus datos de contacto
    const { rows: personas } = await tx.query<Persona>(
      `insert into personas (cuil, dni, apellido, nombres, fecha_nacimiento, sexo, telefono, email, domicilio, localidad_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (cuil) do update set
         dni = excluded.dni,
         apellido = excluded.apellido,
         nombres = excluded.nombres,
         fecha_nacimiento = coalesce(excluded.fecha_nacimiento, personas.fecha_nacimiento),
         sexo = coalesce(excluded.sexo, personas.sexo),
         telefono = coalesce(excluded.telefono, personas.telefono),
         email = coalesce(excluded.email, personas.email),
         domicilio = coalesce(excluded.domicilio, personas.domicilio),
         localidad_id = coalesce(excluded.localidad_id, personas.localidad_id)
       returning *`,
      [
        d.cuil,
        d.dni,
        d.apellido.toUpperCase(),
        d.nombres,
        nulo(d.fecha_nacimiento),
        nulo(d.sexo),
        nulo(d.telefono),
        nulo(d.email)?.toLowerCase() ?? null,
        nulo(d.domicilio),
        d.localidad_id,
      ],
    );
    const persona = personas[0];

    // Número de siniestro: año de la denuncia + contador
    const anio = Number(hoy.slice(0, 4));
    const contador = await siguienteContador(tx, anio);

    const esEP = d.tipo === "EP";
    const { rows } = await tx.query<{ id: number; numero: string }>(
      `insert into expedientes (
         anio, contador, sufijo, tipo, estado, persona_id, origen_id, es_intercurrencia,
         canal, denunciante_tipo, denunciante_nombre, denunciante_email, denunciante_telefono,
         recibido_en, recibido_por,
         reparticion, domicilio_laboral, localidad_laboral_id, puesto, ciuo, tareas,
         antiguedad_empresa, antiguedad_area, desvinculado,
         fecha_ocurrencia, hora_ocurrencia, lugar_ocurrencia, localidad_ocurrencia_id, descripcion,
         forma_accidente, agente_material, trayecto,
         pluriempleo, cuits_pluriempleo, obligada_pago, exposicion_desde, exposicion_hasta,
         creado_en, actualizado_en)
       values ($1, $2, 0, $3, 'recepcion', $4, $5, $6,
         $7, $8, $9, $10, $11,
         $12, $13,
         $14, $15, $16, $17, $18, $19,
         $20, $21, $22,
         $23, $24, $25, $26, $27,
         $28, $29, $30,
         $31, $32, $33, $34, $35,
         $12, $12)
       returning id, numero`,
      [
        anio,
        contador,
        d.tipo,
        persona.id,
        origen?.id ?? null,
        d.es_intercurrencia && !!origen,
        d.canal,
        d.denunciante_tipo,
        d.denunciante_tipo === "trabajador" ? `${persona.apellido}, ${persona.nombres}` : nulo(d.denunciante_nombre),
        d.denunciante_tipo === "trabajador" ? persona.email : nulo(d.denunciante_email),
        d.denunciante_tipo === "trabajador" ? persona.telefono : nulo(d.denunciante_telefono),
        ctx.ahora,
        ctx.usuario.id,
        d.reparticion,
        nulo(d.domicilio_laboral),
        d.localidad_laboral_id,
        nulo(d.puesto),
        nulo(d.ciuo),
        nulo(d.tareas),
        nulo(d.antiguedad_empresa),
        nulo(d.antiguedad_area),
        d.desvinculado,
        nulo(d.fecha_ocurrencia),
        nulo(d.hora_ocurrencia),
        nulo(d.lugar_ocurrencia),
        d.localidad_ocurrencia_id,
        nulo(d.descripcion),
        nulo(d.forma_accidente),
        nulo(d.agente_material),
        d.tipo === "IT" ? nulo(d.trayecto) : null,
        esEP ? d.pluriempleo : null,
        esEP && d.pluriempleo ? d.cuits_pluriempleo.map(soloDigitos).filter(Boolean) : null,
        esEP && d.pluriempleo ? d.obligada_pago : null,
        esEP ? nulo(d.exposicion_desde) : null,
        esEP ? nulo(d.exposicion_hasta) : null,
      ],
    );
    const { id, numero } = rows[0];

    for (const [i, dx] of d.diagnosticos.entries()) {
      await tx.query(
        `insert into diagnosticos (expediente_id, orden, cie10, agente_causante, codigo_examen, origen)
         values ($1, $2, $3, $4, $5, 'denuncia')`,
        [id, i + 1, dx.cie10, nulo(dx.agente_causante), esEP ? "F" : null],
      );
    }

    for (const doc of d.documentos) {
      await tx.query(
        `insert into documentos (expediente_id, tipo, nombre_archivo, tamano_bytes, etapa, cargado_por, cargado_en)
         values ($1, $2, $3, $4, 'recepcion', $5, $6)`,
        [id, doc.tipo, nulo(doc.nombre_archivo), doc.tamano_bytes, ctx.usuario.id, ctx.ahora],
      );
    }

    const destinatarios = [d.denunciante_tipo === "trabajador" ? persona.email : nulo(d.denunciante_email)];
    if (d.denunciante_tipo !== "trabajador") destinatarios.push(persona.email);
    await registrarMovimiento(tx, ctx, {
      expediente_id: id,
      accion: "recepcion",
      detalle:
        `Denuncia de ${TIPO_INFO[d.tipo].nombre.toLowerCase()} recibida (${CANAL_INFO[d.canal].toLowerCase()}). ` +
        `Se emitió la constancia de recepción N° ${numero}` +
        (destinatarios.some(Boolean) ? ` y se envió a ${destinatarios.filter(Boolean).join(" y ")} (simulado).` : "."),
      estado_nuevo: "recepcion",
      datos: { diagnosticos: d.diagnosticos.length, documentos: d.documentos.length },
    });

    if (origen) {
      await registrarMovimiento(tx, ctx, {
        expediente_id: origen.id,
        accion: "intercurrencia",
        detalle: `Se registró la intercurrencia ${numero} vinculada a este siniestro.`,
        datos: { intercurrencia_id: id },
      });
      // Igual que cuando la registra Seguimiento: pasa directo al Área médica, con la
      // relación laboral del siniestro de origen (que tiene la licencia activa).
      await actualizarExpediente(tx, ctx, id, { relacion_laboral_verificada: true, verificado_en: ctx.ahora });
      const nuevo = await bloquearExpediente(tx, id);
      // En EP antes se informa la denuncia FODEP; si la SRT la rechaza, queda en Mesa para corregirla.
      const fodep = esEP ? await informarAltaFODEP(tx, ctx, nuevo) : null;
      if (fodep?.ok) await cambiarEstadoFODEP(tx, ctx, nuevo, 3, "Intercurrencia: pasa directo a evaluación médica");
      if (!fodep || fodep.ok) {
        await cambiarEstado(
          tx,
          ctx,
          nuevo,
          "evaluacion_medica",
          "pase_medica",
          `Intercurrencia del siniestro ${origen.numero}: pasa directo al Área médica.`,
        );
      }
    }

    return { id, numero };
  });
}

/**
 * Edición de la denuncia mientras está en Mesa de entrada (RNF-01: volver
 * atrás y corregir). No cambia la persona ni el tipo; reemplaza los
 * diagnósticos invocados. La documentación se maneja aparte.
 */
export async function editarDenuncia(
  ctx: Ctx,
  entrada: { expediente_id: number; datos: NuevaDenunciaEntrada },
): Promise<void> {
  const d = validar(esquemaNuevaDenuncia, entrada.datos);
  await ctx.db.transaction(async (tx) => {
    const exp = await bloquearExpediente(tx, Number(entrada.expediente_id));
    exigirPermiso(ctx, "editar_denuncia", exp.estado);
    exigir(d.tipo === exp.tipo, "No se puede cambiar el tipo de denuncia: desistila y cargá una nueva.");
    const { rows: pers } = await tx.query<Persona>("select * from personas where id = $1", [exp.persona_id]);
    exigir(pers[0].cuil === d.cuil, "No se puede cambiar la persona de la denuncia: desistila y cargá una nueva.");
    exigir(!d.fecha_ocurrencia || d.fecha_ocurrencia <= hoyCtx(ctx), "La fecha del hecho no puede ser posterior a hoy.");
    await verificarCodigos(tx, "cat_cie10", d.diagnosticos.map((x) => x.cie10), "Diagnóstico CIE-10");
    await verificarCodigos(tx, "cat_agente_causante", d.diagnosticos.map((x) => x.agente_causante), "Agente causante");
    await verificarCodigos(tx, "cat_forma_accidente", [d.forma_accidente], "Forma del accidente");
    await verificarCodigos(tx, "cat_agente_material", [d.agente_material], "Agente material");
    await verificarCodigos(tx, "cat_ciuo88", [d.ciuo], "Puesto (CIUO)");
    await verificarLocalidad(tx, d.localidad_id, "Domicilio del trabajador");
    await verificarLocalidad(tx, d.localidad_laboral_id, "Domicilio laboral");
    await verificarLocalidad(tx, d.localidad_ocurrencia_id, "Lugar del hecho");

    await tx.query(
      `update personas set dni = $2, apellido = $3, nombres = $4, fecha_nacimiento = $5, sexo = $6,
         telefono = $7, email = $8, domicilio = $9, localidad_id = $10 where id = $1`,
      [
        exp.persona_id,
        d.dni,
        d.apellido.toUpperCase(),
        d.nombres,
        nulo(d.fecha_nacimiento),
        nulo(d.sexo),
        nulo(d.telefono),
        nulo(d.email)?.toLowerCase() ?? null,
        nulo(d.domicilio),
        d.localidad_id,
      ],
    );
    const esEP = d.tipo === "EP";
    await tx.query(
      `update expedientes set
         canal = $2, denunciante_tipo = $3, denunciante_nombre = $4, denunciante_email = $5, denunciante_telefono = $6,
         reparticion = $7, domicilio_laboral = $8, localidad_laboral_id = $9, puesto = $10, ciuo = $11, tareas = $12,
         antiguedad_empresa = $13, antiguedad_area = $14, desvinculado = $15,
         fecha_ocurrencia = $16, hora_ocurrencia = $17, lugar_ocurrencia = $18, localidad_ocurrencia_id = $19,
         descripcion = $20, forma_accidente = $21, agente_material = $22, trayecto = $23,
         pluriempleo = $24, cuits_pluriempleo = $25, obligada_pago = $26, exposicion_desde = $27, exposicion_hasta = $28,
         actualizado_en = $29
       where id = $1`,
      [
        exp.id,
        d.canal,
        d.denunciante_tipo,
        d.denunciante_tipo === "trabajador" ? `${d.apellido.toUpperCase()}, ${d.nombres}` : nulo(d.denunciante_nombre),
        d.denunciante_tipo === "trabajador" ? nulo(d.email) : nulo(d.denunciante_email),
        d.denunciante_tipo === "trabajador" ? nulo(d.telefono) : nulo(d.denunciante_telefono),
        d.reparticion,
        nulo(d.domicilio_laboral),
        d.localidad_laboral_id,
        nulo(d.puesto),
        nulo(d.ciuo),
        nulo(d.tareas),
        nulo(d.antiguedad_empresa),
        nulo(d.antiguedad_area),
        d.desvinculado,
        nulo(d.fecha_ocurrencia),
        nulo(d.hora_ocurrencia),
        nulo(d.lugar_ocurrencia),
        d.localidad_ocurrencia_id,
        nulo(d.descripcion),
        nulo(d.forma_accidente),
        nulo(d.agente_material),
        d.tipo === "IT" ? nulo(d.trayecto) : null,
        esEP ? d.pluriempleo : null,
        esEP && d.pluriempleo ? d.cuits_pluriempleo.map(soloDigitos).filter(Boolean) : null,
        esEP && d.pluriempleo ? d.obligada_pago : null,
        esEP ? nulo(d.exposicion_desde) : null,
        esEP ? nulo(d.exposicion_hasta) : null,
        ctx.ahora,
      ],
    );
    await tx.query("delete from diagnosticos where expediente_id = $1 and estado = 'invocado'", [exp.id]);
    for (const [i, dx] of d.diagnosticos.entries()) {
      await tx.query(
        `insert into diagnosticos (expediente_id, orden, cie10, agente_causante, codigo_examen, origen)
         values ($1, $2, $3, $4, $5, 'denuncia')`,
        [exp.id, i + 1, dx.cie10, nulo(dx.agente_causante), esEP ? "F" : null],
      );
    }
    await registrarMovimiento(tx, ctx, {
      expediente_id: exp.id,
      accion: "edicion",
      detalle: "Se corrigieron los datos de la denuncia en Mesa de entrada.",
    });
  });
}

/**
 * Reingreso de un siniestro dado de alta: mismo número, sufijo siguiente
 * (RF-24). Vuelve a pasar por Mesa de entrada y por el área médica.
 */
export async function crearReingreso(ctx: Ctx, entrada: unknown): Promise<DenunciaCreada> {
  const d = validar(esquemaReingreso, entrada);
  return ctx.db.transaction(async (tx) => {
    const origen = await bloquearExpediente(tx, d.origen_id);
    exigirPermiso(ctx, "crear_reingreso", origen.estado);
    const hoy = hoyCtx(ctx);
    exigir(d.fecha_ocurrencia <= hoy, "La fecha no puede ser posterior a hoy.");
    exigir(
      !origen.fecha_fin_ilt || d.fecha_ocurrencia >= origen.fecha_fin_ilt,
      `El reingreso es posterior al alta (${formatoFecha(origen.fecha_fin_ilt)}).`,
    );
    const { rows: suf } = await tx.query<{ siguiente: number }>(
      "select coalesce(max(sufijo), 0) + 1 as siguiente from expedientes where anio = $1 and contador = $2",
      [origen.anio, origen.contador],
    );
    const sufijo = suf[0].siguiente;
    exigir(sufijo <= 99, "Se alcanzó el máximo de reingresos para este siniestro.");

    const { rows } = await tx.query<{ id: number; numero: string }>(
      `insert into expedientes (
         anio, contador, sufijo, tipo, estado, persona_id, origen_id, es_reingreso,
         canal, denunciante_tipo, denunciante_nombre, denunciante_email, denunciante_telefono,
         recibido_en, recibido_por,
         reparticion, cuit_empleador, codigo_establecimiento, domicilio_laboral, localidad_laboral_id,
         puesto, ciuo, tareas, antiguedad_empresa, antiguedad_area, desvinculado,
         fecha_ocurrencia, descripcion, forma_accidente, agente_material,
         pluriempleo, cuits_pluriempleo, obligada_pago, exposicion_desde, exposicion_hasta,
         creado_en, actualizado_en)
       select anio, contador, $2, tipo, 'recepcion', persona_id, id, true,
         'presencial', 'trabajador', denunciante_nombre, denunciante_email, denunciante_telefono,
         $3, $4,
         reparticion, cuit_empleador, codigo_establecimiento, domicilio_laboral, localidad_laboral_id,
         puesto, ciuo, tareas, antiguedad_empresa, antiguedad_area, desvinculado,
         $5, $6, forma_accidente, agente_material,
         pluriempleo, cuits_pluriempleo, obligada_pago, exposicion_desde, exposicion_hasta,
         $3, $3
       from expedientes where id = $1
       returning id, numero`,
      [origen.id, sufijo, ctx.ahora, ctx.usuario.id, d.fecha_ocurrencia, d.descripcion],
    );
    const nuevo = rows[0];

    // Los diagnósticos aceptados del siniestro original se vuelven a evaluar
    await tx.query(
      `insert into diagnosticos (expediente_id, orden, cie10, agente_causante, codigo_examen, origen)
       select $2, row_number() over (order by orden), coalesce(cie10_adecuado, cie10), agente_causante, codigo_examen, 'denuncia'
         from diagnosticos where expediente_id = $1 and estado = 'aceptado'`,
      [origen.id, nuevo.id],
    );

    await registrarMovimiento(tx, ctx, {
      expediente_id: nuevo.id,
      accion: "reingreso",
      detalle: `Reingreso del siniestro ${origen.numero} (sufijo ${String(sufijo).padStart(2, "0")}). Fecha de la recaída: ${formatoFecha(d.fecha_ocurrencia)}.`,
      estado_nuevo: "recepcion",
    });
    await registrarMovimiento(tx, ctx, {
      expediente_id: origen.id,
      accion: "reingreso",
      detalle: `Se registró el reingreso ${nuevo.numero}.`,
      datos: { reingreso_id: nuevo.id },
    });
    return nuevo;
  });
}
