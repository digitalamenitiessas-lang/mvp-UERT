/**
 * Respuestas de Yanapa que necesitan datos de la demo: qué tiene pendiente
 * cada rol, qué vence, el resumen del día, las citaciones, cómo está el
 * expediente abierto y la búsqueda por número, CUIL, DNI o apellido.
 * Solo lee: nunca modifica la base.
 */
import type { Db } from "@/lib/db";
import { listarCitaciones, listarExpedientes, obtenerFicha, plazoMasUrgente, plazosDe, type ExpedienteFila } from "@/lib/datos/expedientes";
import { obtenerTablero } from "@/lib/datos/tablero";
import {
  ESTADO_DIAGNOSTICO_INFO,
  ESTADO_INFO,
  ESTADOS,
  MOTIVO_CITACION_INFO,
  ROL_INFO,
  TIPO_INFO,
  type EstadoExpediente,
  type Rol,
} from "@/lib/dominio/constantes";
import { formatoFecha, formatoFechaHora } from "@/lib/dominio/fechas";
import { puede, type Accion } from "@/lib/dominio/permisos";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import type { Usuario } from "@/lib/tipos";
import {
  detectarBusqueda,
  detectarIntencion,
  expedienteDeRuta,
  intencion,
  nombreDePila,
  pareceNombre,
  respuestaFija,
  respuestaNoEntendida,
  sugerencias,
  sugerenciasPara,
  type PedidoBusqueda,
} from "./conocimiento";
import type { Bloque, ConsultaAsistente, ContextoAsistente, ExpedienteResumen, Respuesta } from "./tipos";

interface Datos {
  db: Db;
  ctx: ContextoAsistente;
  rol: Rol;
  ahora: Date;
  feriados: ReadonlySet<string>;
}

const texto = (t: string): Bloque => ({ tipo: "texto", texto: t });
const nota = (t: string): Bloque => ({ tipo: "nota", texto: t });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const NIVEL = { vencido: 0, hoy: 1, proximo: 2, en_termino: 3 } as const;

/** Tarjeta de un expediente, con su plazo más urgente. */
function resumen(f: ExpedienteFila, d: Datos, detalle?: string): ExpedienteResumen {
  const plazo = plazoMasUrgente(plazosDe(f, d.ahora, d.feriados));
  return {
    id: f.id,
    numero: f.numero,
    persona: `${f.apellido}, ${f.nombres}`,
    tipo: f.tipo,
    estado: f.estado,
    ...(plazo ? { plazo } : {}),
    ...(detalle ? { detalle } : {}),
  };
}

/** Primero lo vencido y lo que vence antes; después, lo más antiguo. */
function porUrgencia(filas: ExpedienteFila[], d: Datos): ExpedienteFila[] {
  const clave = (f: ExpedienteFila) => {
    const p = plazoMasUrgente(plazosDe(f, d.ahora, d.feriados));
    return { nivel: p ? NIVEL[p.nivel] : 9, vence: p?.vence ?? "9999", recibido: new Date(f.recibido_en).getTime() };
  };
  return [...filas]
    .map((f) => ({ f, k: clave(f) }))
    .sort((a, b) => a.k.nivel - b.k.nivel || a.k.vence.localeCompare(b.k.vence) || a.k.recibido - b.k.recibido)
    .map((x) => x.f);
}

function contarPlazos(filas: ExpedienteFila[], d: Datos) {
  let vencidos = 0;
  let pronto = 0;
  for (const f of filas) {
    const p = plazoMasUrgente(plazosDe(f, d.ahora, d.feriados));
    if (p?.nivel === "vencido") vencidos++;
    else if (p?.nivel === "hoy" || p?.nivel === "proximo") pronto++;
  }
  return { vencidos, pronto };
}

const enlaceBandeja = (rol: Rol): Bloque => ({
  tipo: "enlaces",
  enlaces: [{ texto: `Ir a ${rol === "direccion" ? "el tablero" : "la bandeja"}`, href: ROL_INFO[rol].inicio }],
});

// ---------------------------------------------------------------------------
// ¿Qué tengo pendiente?
// ---------------------------------------------------------------------------
async function pendientes(d: Datos): Promise<Bloque[]> {
  const { db, rol } = d;
  if (rol === "direccion" || rol === "admin") return resumenDelDia(d);

  if (rol === "mesa_entrada") {
    const filas = await listarExpedientes(db, { estados: ["recepcion"], limite: 200 });
    if (!filas.length) return [texto("No tenés denuncias en Mesa de entrada. ¡Bandeja al día!"), enlaceBandeja(rol)];
    const sinVerificar = filas.filter((f) => f.relacion_laboral_verificada === null).length;
    const verificadas = filas.filter((f) => f.relacion_laboral_verificada === true).length;
    return [
      texto(`Tenés **${plural(filas.length, "denuncia", "denuncias")}** en Mesa de entrada.`),
      {
        tipo: "indicadores",
        items: [
          { etiqueta: "En recepción", valor: filas.length },
          { etiqueta: "Sin verificar la relación laboral", valor: sinVerificar, tono: sinVerificar ? "alerta" : "normal" },
          { etiqueta: "Verificadas, para pasar a Médica", valor: verificadas },
        ],
      },
      {
        tipo: "expedientes",
        items: porUrgencia(filas, d)
          .slice(0, 4)
          .map((f) =>
            resumen(
              f,
              d,
              f.relacion_laboral_verificada === null
                ? "Falta verificar la relación laboral"
                : f.relacion_laboral_verificada
                  ? "Revisá la documentación y pasala a Médica"
                  : "Relación laboral no corroborada",
            ),
          ),
      },
      enlaceBandeja(rol),
    ];
  }

  if (rol === "medico") {
    const [filas, programadas] = await Promise.all([
      listarExpedientes(db, { estados: ["evaluacion_medica"], limite: 200 }),
      listarCitaciones(db, { estado: "programada" }),
    ]);
    if (!filas.length) return [texto("No hay expedientes en evaluación médica."), enlaceBandeja(rol)];
    const porEvaluar = filas.reduce((s, f) => s + f.diagnosticos_pendientes, 0);
    const sinReiterar = filas.filter((f) => f.citacion_sin_reiterar).length;
    const detalle = (f: ExpedienteFila) => {
      const base = f.citacion_sin_reiterar
        ? "No asistió a la citación: reiterala o dejala Desistida"
        : f.diagnosticos_pendientes
          ? `${plural(f.diagnosticos_pendientes, "diagnóstico", "diagnósticos")} por evaluar`
          : f.con_baja === null
            ? "Falta definir la baja laboral"
            : "Lista para pasar al Área legal";
      return f.citacion_proxima ? `${base} · Citación: ${formatoFechaHora(f.citacion_proxima)}` : base;
    };
    const orden = [...filas].sort(
      (a, b) =>
        Number(b.citacion_sin_reiterar) - Number(a.citacion_sin_reiterar) ||
        b.diagnosticos_pendientes - a.diagnosticos_pendientes ||
        new Date(a.recibido_en).getTime() - new Date(b.recibido_en).getTime(),
    );
    return [
      texto(`Tenés **${plural(filas.length, "expediente", "expedientes")}** en evaluación médica.`),
      {
        tipo: "indicadores",
        items: [
          { etiqueta: "En evaluación", valor: filas.length },
          { etiqueta: "Diagnósticos por evaluar", valor: porEvaluar, tono: porEvaluar ? "alerta" : "normal" },
          { etiqueta: "Citaciones programadas", valor: programadas.length },
          { etiqueta: "Inasistencias sin resolver", valor: sinReiterar, tono: sinReiterar ? "peligro" : "normal" },
        ],
      },
      { tipo: "expedientes", items: orden.slice(0, 4).map((f) => resumen(f, d, detalle(f))) },
      enlaceBandeja(rol),
    ];
  }

  if (rol === "legal") {
    const filas = await listarExpedientes(db, { estados: ["dictamen_legal"], orden: "legal_vence", limite: 200 });
    if (!filas.length) return [texto("No hay expedientes esperando dictamen legal."), enlaceBandeja(rol)];
    const { vencidos, pronto } = contarPlazos(filas, d);
    return [
      texto(`Tenés **${plural(filas.length, "expediente", "expedientes")}** para dictaminar.`),
      {
        tipo: "indicadores",
        items: [
          { etiqueta: "En dictamen", valor: filas.length },
          { etiqueta: "Plazos vencidos", valor: vencidos, tono: vencidos ? "peligro" : "normal" },
          { etiqueta: "Vencen hoy o pronto", valor: pronto, tono: pronto ? "alerta" : "normal" },
        ],
      },
      {
        tipo: "expedientes",
        items: porUrgencia(filas, d)
          .slice(0, 4)
          .map((f) =>
            resumen(
              f,
              d,
              `${f.diagnosticos_decididos} de ${plural(f.diagnosticos_total, "diagnóstico decidido", "diagnósticos decididos")}${
                f.legal_prorroga_usada ? " · Prórroga usada" : ""
              }`,
            ),
          ),
      },
      enlaceBandeja(rol),
    ];
  }

  // Seguimiento
  const filas = await listarExpedientes(db, { estados: ["licencia_activa", "sin_baja"], limite: 300 });
  if (!filas.length) return [texto("No hay licencias activas ni casos sin baja."), enlaceBandeja(rol)];
  const activas = filas.filter((f) => f.estado === "licencia_activa").length;
  const { vencidos, pronto } = contarPlazos(filas, d);
  return [
    texto(`Seguís **${plural(activas, "licencia activa", "licencias activas")}** y **${plural(filas.length - activas, "caso", "casos")} sin baja**.`),
    {
      tipo: "indicadores",
      items: [
        { etiqueta: "Licencias activas", valor: activas },
        { etiqueta: "Sin baja (Comisión Médica)", valor: filas.length - activas },
        { etiqueta: "Plazos vencidos", valor: vencidos, tono: vencidos ? "peligro" : "normal" },
        { etiqueta: "Vencen hoy o pronto", valor: pronto, tono: pronto ? "alerta" : "normal" },
      ],
    },
    {
      tipo: "expedientes",
      items: porUrgencia(filas, d)
        .slice(0, 4)
        .map((f) =>
          resumen(
            f,
            d,
            f.estado === "sin_baja"
              ? "Presentar ante la Comisión Médica"
              : f.proxima_presentacion
                ? `Próxima presentación: ${formatoFecha(f.proxima_presentacion)}`
                : "Sin próxima presentación fijada",
          ),
        ),
    },
    enlaceBandeja(rol),
  ];
}

// ---------------------------------------------------------------------------
// ¿Qué vence pronto?
// ---------------------------------------------------------------------------
const ABIERTOS = ESTADOS.filter((e) => ESTADO_INFO[e].abierto);

async function vencimientos(d: Datos): Promise<Bloque[]> {
  const { db, rol } = d;
  if (rol === "medico") {
    return [
      texto(
        "En el Área médica el sistema no lleva vencimientos: lo que hay que mirar son las citaciones y las inasistencias.",
      ),
      ...(await citacionesProximas(d)),
    ];
  }
  const delArea: EstadoExpediente[] =
    rol === "mesa_entrada" || rol === "legal" || rol === "seguimiento"
      ? ABIERTOS.filter((e) => ESTADO_INFO[e].area === rol)
      : ABIERTOS;
  const enArea = rol === "direccion" || rol === "admin" ? "" : " en tu área";
  const filas = await listarExpedientes(db, { estados: delArea, limite: 500 });
  const conPlazo = filas
    .flatMap((f) => {
      const p = plazoMasUrgente(plazosDe(f, d.ahora, d.feriados));
      return p ? [{ f, p }] : [];
    })
    .sort((a, b) => NIVEL[a.p.nivel] - NIVEL[b.p.nivel] || a.p.vence.localeCompare(b.p.vence));
  const urgentes = conPlazo.filter((x) => x.p.nivel !== "en_termino");
  const vencidos = urgentes.filter((x) => x.p.nivel === "vencido").length;

  if (!urgentes.length) {
    const proximos = conPlazo.slice(0, 3);
    return [
      texto(`No hay plazos vencidos ni por vencer${enArea}.`),
      ...(proximos.length
        ? [texto("Los próximos vencimientos:"), { tipo: "expedientes" as const, items: proximos.map((x) => resumen(x.f, d)) }]
        : []),
    ];
  }
  return [
    texto(
      `${vencidos ? `Hay **${plural(vencidos, "plazo vencido", "plazos vencidos")}**` : "No hay plazos vencidos"}${enArea} y **${plural(
        urgentes.length - vencidos,
        "expediente vence",
        "expedientes vencen",
      )}** hoy o en los próximos días.`,
    ),
    { tipo: "expedientes", items: urgentes.slice(0, 6).map((x) => resumen(x.f, d)) },
    ...(urgentes.length > 6 ? [nota(`Te muestro los 6 más urgentes de ${urgentes.length}.`)] : []),
  ];
}

// ---------------------------------------------------------------------------
// Resumen del día (Dirección)
// ---------------------------------------------------------------------------
async function resumenDelDia(d: Datos): Promise<Bloque[]> {
  const t = await obtenerTablero(d.db, d.ahora, d.feriados);
  const vencidos = t.vencimientos.filter((v) => v.plazo.nivel === "vencido").length;
  const pronto = t.vencimientos.filter((v) => v.plazo.nivel === "hoy" || v.plazo.nivel === "proximo").length;
  const urgentes = t.vencimientos
    .filter((v) => v.plazo.nivel !== "en_termino")
    .slice(0, 3)
    .map((v) => resumen(v.expediente, d));
  return [
    texto(`Hoy hay **${plural(t.abiertos, "expediente abierto", "expedientes abiertos")}**. Así viene el día:`),
    {
      tipo: "indicadores",
      items: [
        { etiqueta: "Abiertos", valor: t.abiertos },
        { etiqueta: "Recibidos en 30 días", valor: t.recibidosUltimos30 },
        { etiqueta: "Plazos vencidos", valor: vencidos, tono: vencidos ? "peligro" : "normal" },
        { etiqueta: "Vencen hoy o pronto", valor: pronto, tono: pronto ? "alerta" : "normal" },
        { etiqueta: "Errores con la SRT", valor: t.srtErrores, tono: t.srtErrores ? "peligro" : "normal" },
        { etiqueta: "Diagnósticos por informar", valor: t.pendientesIntercambio },
      ],
    },
    {
      tipo: "lista",
      titulo: "Expedientes en trámite, por etapa:",
      items: ABIERTOS.map((e) => ({ titulo: `${ESTADO_INFO[e].nombre}: ${t.porEstado[e]}` })),
    },
    ...(urgentes.length ? [texto("Lo más urgente:"), { tipo: "expedientes" as const, items: urgentes }] : []),
    { tipo: "enlaces", enlaces: [{ texto: "Ver el tablero", href: "/direccion" }] },
  ];
}

// ---------------------------------------------------------------------------
// Citaciones
// ---------------------------------------------------------------------------
async function citacionesProximas(d: Datos): Promise<Bloque[]> {
  const [programadas, sinReiterar] = await Promise.all([
    listarCitaciones(d.db, { estado: "programada" }),
    listarCitaciones(d.db, { estado: "no_asistio", sinReiterar: true }),
  ]);
  const bloques: Bloque[] = [];
  if (!programadas.length) bloques.push(texto("No hay citaciones programadas."));
  else {
    // Una citación «programada» con fecha pasada es una asistencia sin registrar.
    const pasada = (c: (typeof programadas)[number]) => new Date(c.fecha_hora).getTime() < d.ahora.getTime();
    const sinRegistrar = programadas.filter(pasada).length;
    bloques.push(
      texto(
        `Hay **${plural(programadas.length, "citación programada", "citaciones programadas")}**${
          sinRegistrar
            ? `: ${sinRegistrar === 1 ? "una ya pasó" : `${sinRegistrar} ya pasaron`} y falta registrar si el trabajador asistió`
            : ""
        }.`,
      ),
    );
    bloques.push({
      tipo: "expedientes",
      items: programadas.slice(0, 5).map((c) => ({
        id: c.expediente_id,
        numero: c.numero,
        persona: `${c.apellido}, ${c.nombres}`,
        tipo: c.tipo,
        estado: "evaluacion_medica",
        detalle: `${pasada(c) ? "Ya pasó: registrá la asistencia · " : ""}${formatoFechaHora(c.fecha_hora)} · ${MOTIVO_CITACION_INFO[c.motivo]} · ${c.lugar}`,
      })),
    });
  }
  if (sinReiterar.length) {
    bloques.push(
      nota(
        `${plural(sinReiterar.length, "trabajador no asistió", "trabajadores no asistieron")} y todavía no se ${
          sinReiterar.length === 1 ? "reiteró la citación" : "reiteraron las citaciones"
        }: se puede reiterar una sola vez.`,
      ),
    );
  }
  return bloques;
}

// ---------------------------------------------------------------------------
// El expediente que se está viendo
// ---------------------------------------------------------------------------
const ACCION_TEXTO: Partial<Record<Accion, string>> = {
  editar_denuncia: "Editar la denuncia",
  verificar_relacion_laboral: "Verificar la relación laboral",
  pasar_a_medica: "Pasarla al Área médica",
  desistir: "Dejarla como Desistida",
  agregar_diagnostico: "Agregar un diagnóstico",
  evaluar_diagnostico: "Evaluar los diagnósticos",
  programar_citacion: "Programar una citación",
  registrar_asistencia: "Registrar la asistencia a una citación",
  definir_baja: "Definir la baja laboral",
  reencuadrar_ep: "Reencuadrarla como Enfermedad Profesional",
  pasar_a_legal: "Pasarla al Área legal",
  decidir_diagnostico: "Aceptar o rechazar cada diagnóstico",
  solicitar_prorroga: "Pedir la prórroga",
  cerrar_dictamen: "Cerrar el dictamen",
  registrar_presentacion: "Registrar una presentación",
  registrar_intercurrencia: "Registrar una intercurrencia",
  dar_alta: "Dar el alta",
  registrar_presentacion_cm: "Registrar la presentación ante la Comisión Médica",
  crear_reingreso: "Cargar un reingreso",
  adjuntar_documento: "Adjuntar documentos",
};

const DIAGNOSTICOS_EN_PLURAL = {
  invocado: ["pendiente de evaluación", "pendientes de evaluación"],
  evaluado: ["evaluado", "evaluados"],
  aceptado: ["aceptado", "aceptados"],
  rechazado: ["rechazado", "rechazados"],
} as const satisfies Record<Exclude<keyof typeof ESTADO_DIAGNOSTICO_INFO, "desistido">, readonly [string, string]>;

async function expedienteActual(d: Datos): Promise<Bloque[]> {
  const id = expedienteDeRuta(d.ctx.ruta);
  if (!id) {
    return [
      texto("Para eso abrí la ficha de un expediente y preguntame de nuevo."),
      texto("O escribime el **número**, el **DNI** o el **CUIL** y lo busco."),
    ];
  }
  const ficha = await obtenerFicha(d.db, id);
  if (!ficha) return [texto("No encontré ese expediente. Puede que se hayan reiniciado los datos de la demo.")];
  const e = ficha.expediente;
  const info = ESTADO_INFO[e.estado];
  const bloques: Bloque[] = [
    texto(`**${e.numero}** · ${TIPO_INFO[e.tipo].nombre} de **${ficha.persona.apellido}, ${ficha.persona.nombres}**.`),
    texto(`Estado: **${info.nombre}**. ${info.descripcion}`),
    texto(
      info.area
        ? `Le toca actuar a **${ROL_INFO[info.area].nombre}**.`
        : "Ninguna área tiene que actuar: el trámite está terminado.",
    ),
  ];

  const plazos = plazosDe(e, d.ahora, d.feriados);
  if (plazos.length) {
    bloques.push({
      tipo: "lista",
      titulo: "Plazos en curso:",
      items: plazos.map((p) => ({ titulo: p.nombre, detalle: `${p.texto} · vence el ${formatoFecha(p.vence)}` })),
    });
  }

  const diag = ficha.diagnosticos.filter((x) => x.estado !== "desistido");
  if (diag.length) {
    const conteo = new Map<keyof typeof DIAGNOSTICOS_EN_PLURAL, number>();
    diag.forEach((x) => {
      if (x.estado !== "desistido") conteo.set(x.estado, (conteo.get(x.estado) ?? 0) + 1);
    });
    const partes = [...conteo].map(([estado, n]) => {
      const [uno, varios] = DIAGNOSTICOS_EN_PLURAL[estado];
      return plural(n, uno, varios);
    });
    bloques.push(
      texto(
        `${plural(diag.length, "diagnóstico", "diagnósticos")}: ${partes.join(", ")}. ${plural(ficha.documentos.length, "documento adjunto", "documentos adjuntos")}.`,
      ),
    );
  }

  const acciones = (Object.keys(ACCION_TEXTO) as Accion[]).filter((a) => {
    if (!puede(d.rol, a, e.estado)) return false;
    if (a === "reencuadrar_ep" && e.tipo === "EP") return false;
    if (a === "solicitar_prorroga" && e.legal_prorroga_usada) return false;
    if (a === "verificar_relacion_laboral" && e.relacion_laboral_verificada !== null) return false;
    return true;
  });
  if (acciones.length) {
    bloques.push({
      tipo: "lista",
      titulo: `Como ${ROL_INFO[d.rol].nombre} podés:`,
      items: acciones.map((a) => ({ titulo: ACCION_TEXTO[a]! })),
    });
  }
  if (info.area && info.area !== d.rol) {
    const area = ROL_INFO[info.area].nombre;
    bloques.push(
      nota(
        acciones.length
          ? `El trámite lo avanza ${area}. Para seguirlo, cambiá de rol desde «Viendo como».`
          : `Con tu rol no tenés acciones en este estado. Para seguir, cambiá a ${area} desde «Viendo como».`,
      ),
    );
  }
  return bloques;
}

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------
async function buscar(d: Datos, pedido: PedidoBusqueda): Promise<Bloque[]> {
  const filas = await listarExpedientes(d.db, { texto: pedido.termino, limite: 6 });
  const unificada = {
    tipo: "enlaces" as const,
    enlaces: [{ texto: "Buscar también en el sistema actual", href: `/buscar?q=${encodeURIComponent(pedido.termino)}` }],
  };
  if (!filas.length) {
    return [texto(`No encontré expedientes con **${pedido.etiqueta}** en el sistema nuevo.`), unificada];
  }
  return [
    texto(
      filas.length === 1
        ? `Encontré **1 expediente** con ${pedido.etiqueta}:`
        : `Encontré **${filas.length} expedientes** con ${pedido.etiqueta}${filas.length === 6 ? " (los 6 más recientes)" : ""}:`,
    ),
    { tipo: "expedientes", items: filas.map((f) => resumen(f, d)) },
    unificada,
  ];
}

// ---------------------------------------------------------------------------
// Adjuntos y audios
// ---------------------------------------------------------------------------
function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024).toLocaleString("es-AR")} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-AR", { maximumFractionDigits: 1 })} MB`;
}

async function respuestaAdjunto(
  db: Db,
  ctx: ContextoAsistente,
  adjunto: NonNullable<ConsultaAsistente["adjunto"]>,
): Promise<Respuesta> {
  const bloques: Bloque[] = [texto(`Recibí **${adjunto.nombre}** (${tamanoLegible(adjunto.tamano)}).`)];
  const id = expedienteDeRuta(ctx.ruta);
  const exp = id
    ? (await db.query<{ numero: string; estado: EstadoExpediente }>("select numero, estado from expedientes where id = $1", [id]))
        .rows[0]
    : undefined;
  if (exp && ctx.rol && puede(ctx.rol, "adjuntar_documento", exp.estado)) {
    bloques.push(
      texto(
        `Para sumarlo al expediente **${exp.numero}**, usá **«Adjuntar documento»** en esta ficha: elegís el tipo de documento y queda registrado en el historial.`,
      ),
    );
  } else if (exp) {
    bloques.push(texto(`Con tu rol no se pueden adjuntar documentos al expediente **${exp.numero}** en su estado actual.`));
  } else {
    bloques.push(
      texto(
        "Para sumarlo a un expediente, abrí su ficha y usá **«Adjuntar documento»**. Si es para una denuncia nueva, va en la solapa de documentación.",
      ),
    );
  }
  bloques.push(nota("En la demo no guardo archivos: se registran el nombre y el tamaño, igual que en las fichas."));
  return { intencion: "adjunto", bloques, sugerencias: sugerencias(["documentacion", "adjuntar"]) };
}

function respuestaAudioSinTexto(ctx: ContextoAsistente, segundos: number): Respuesta {
  const s = Math.max(1, Math.round(segundos));
  const duracion = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return {
    intencion: "audio_sin_texto",
    bloques: [
      texto(`Recibí tu audio de **${duracion}**, pero no pude pasarlo a texto.`),
      texto("La transcripción funciona en Chrome y Edge, y necesita que se te escuche bien. Mientras tanto, ¿me lo escribís o elegís una pregunta?"),
    ],
    sugerencias: sugerenciasPara(ctx),
  };
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
const INTENCIONES_DE_DATOS: Record<string, (d: Datos) => Promise<Bloque[]>> = {
  pendientes,
  vencimientos,
  resumen: resumenDelDia,
  citaciones_proximas: citacionesProximas,
  expediente_actual: expedienteActual,
};

/** Limpia lo que manda el navegador (no se confía en su forma). */
export function limpiarConsulta(entrada: unknown): ConsultaAsistente {
  const e = (entrada ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const consulta: ConsultaAsistente = {
    texto: str(e.texto, 500).trim(),
    ruta: str(e.ruta, 200) || "/",
  };
  if (typeof e.intencion === "string" && intencion(e.intencion)) consulta.intencion = e.intencion;
  const a = e.adjunto as Record<string, unknown> | undefined;
  if (a && typeof a === "object") {
    consulta.adjunto = {
      nombre: str(a.nombre, 160) || "archivo",
      tipo: str(a.tipo, 100),
      tamano: typeof a.tamano === "number" && a.tamano >= 0 ? Math.round(a.tamano) : 0,
    };
  }
  const audio = e.audioSinTexto as Record<string, unknown> | undefined;
  if (audio && typeof audio === "object" && typeof audio.segundos === "number") {
    consulta.audioSinTexto = { segundos: Math.min(Math.max(audio.segundos, 0), 600) };
  }
  return consulta;
}

export async function responderConsulta(
  db: Db,
  usuario: Usuario | null,
  consulta: ConsultaAsistente,
  ahora: Date = new Date(),
): Promise<Respuesta> {
  const ctx: ContextoAsistente = { rol: usuario?.rol ?? null, nombre: nombreDePila(usuario?.nombre), ruta: consulta.ruta };

  if (consulta.adjunto) return respuestaAdjunto(db, ctx, consulta.adjunto);
  if (consulta.audioSinTexto) return respuestaAudioSinTexto(ctx, consulta.audioSinTexto.segundos);

  const id = consulta.intencion ?? detectarIntencion(consulta.texto);
  const pedido = consulta.intencion ? null : detectarBusqueda(consulta.texto);
  const necesitaDatos = Boolean(pedido) || Boolean(id && INTENCIONES_DE_DATOS[id]);

  if (necesitaDatos && !usuario) {
    return {
      intencion: id ?? "buscar",
      bloques: [texto("Primero elegí con qué rol entrar y te cuento con los datos de la demo.")],
      sugerencias: sugerencias(["que_rol", "circuito"]),
    };
  }

  if (usuario) {
    const d: Datos = { db, ctx, rol: usuario.rol, ahora, feriados: await cargarFeriados(db) };
    if (pedido) {
      return { intencion: "buscar", bloques: await buscar(d, pedido), sugerencias: sugerencias(["busqueda", "pendientes"]) };
    }
    if (id && INTENCIONES_DE_DATOS[id]) {
      return {
        intencion: id,
        bloques: await INTENCIONES_DE_DATOS[id](d),
        sugerencias: sugerencias(intencion(id)?.siguientes ?? []),
      };
    }
    if (!id) {
      // ¿Escribió un apellido? Se prueba en la búsqueda antes de decir que no se entendió.
      const nombre = pareceNombre(consulta.texto);
      if (nombre) {
        const filas = await listarExpedientes(db, { texto: nombre, limite: 1 });
        if (filas.length) {
          return {
            intencion: "buscar",
            bloques: await buscar(d, { termino: nombre, etiqueta: `«${nombre}»`, por: "texto" }),
            sugerencias: sugerencias(["busqueda", "pendientes"]),
          };
        }
      }
    }
  }

  return (id && respuestaFija(id, ctx)) || respuestaNoEntendida(ctx);
}
