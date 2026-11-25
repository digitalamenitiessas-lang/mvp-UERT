/**
 * Lecturas de expedientes para bandejas, listados y la ficha.
 */
import type { Db } from "@/lib/db";
import { PLAZOS, type EstadoExpediente, type TipoDenuncia } from "@/lib/dominio/constantes";
import { estadoPlazo, fechaDe, sumarDias, type EstadoPlazo, type FechaISO } from "@/lib/dominio/fechas";
import type {
  Citacion,
  ComunicacionSRT,
  DiagnosticoDetalle,
  Documento,
  Expediente,
  Movimiento,
  Persona,
  Presentacion,
} from "@/lib/tipos";

export interface ExpedienteFila {
  id: number;
  numero: string;
  tipo: TipoDenuncia;
  estado: EstadoExpediente;
  es_reingreso: boolean;
  es_intercurrencia: boolean;
  persona_id: number;
  apellido: string;
  nombres: string;
  cuil: string;
  dni: string;
  reparticion: string;
  recibido_en: Date;
  fecha_ocurrencia: FechaISO | null;
  relacion_laboral_verificada: boolean | null;
  con_baja: boolean | null;
  legal_vence: FechaISO | null;
  legal_prorroga_usada: boolean;
  proxima_presentacion: FechaISO | null;
  cm_vence: FechaISO | null;
  fecha_fin_ilt: FechaISO | null;
  fodep_numero: number | null;
  desistido_motivo: string | null;
  diagnosticos_total: number;
  diagnosticos_pendientes: number;
  diagnosticos_evaluados: number;
  diagnosticos_decididos: number;
  documentos_total: number;
  citacion_proxima: Date | null;
  citacion_sin_reiterar: boolean;
  ultima_novedad: Date | null;
  ultima_novedad_detalle: string | null;
}

const SELECT_FILA = `
  select e.id, e.numero, e.tipo, e.estado, e.es_reingreso, e.es_intercurrencia, e.persona_id,
         p.apellido, p.nombres, p.cuil, p.dni, e.reparticion, e.recibido_en, e.fecha_ocurrencia,
         e.relacion_laboral_verificada, e.con_baja, e.legal_vence, e.legal_prorroga_usada,
         e.proxima_presentacion, e.cm_vence, e.fecha_fin_ilt, e.fodep_numero, e.desistido_motivo,
         (select count(*)::int from diagnosticos d where d.expediente_id = e.id and d.estado <> 'desistido') as diagnosticos_total,
         (select count(*)::int from diagnosticos d where d.expediente_id = e.id and d.estado = 'invocado') as diagnosticos_pendientes,
         (select count(*)::int from diagnosticos d where d.expediente_id = e.id and d.estado = 'evaluado') as diagnosticos_evaluados,
         (select count(*)::int from diagnosticos d where d.expediente_id = e.id and d.estado in ('aceptado','rechazado')) as diagnosticos_decididos,
         (select count(*)::int from documentos x where x.expediente_id = e.id) as documentos_total,
         (select min(c.fecha_hora) from citaciones c where c.expediente_id = e.id and c.estado = 'programada') as citacion_proxima,
         exists (select 1 from citaciones c where c.expediente_id = e.id and c.estado = 'no_asistio' and c.reiteracion_de is null
                   and not exists (select 1 from citaciones r where r.reiteracion_de = c.id)) as citacion_sin_reiterar,
         m.fecha as ultima_novedad, m.detalle as ultima_novedad_detalle
    from expedientes e
    join personas p on p.id = e.persona_id
    left join lateral (
      -- El último hecho del trámite: sin los envíos automáticos del lote de intercambio
      select fecha, detalle from movimientos mv
       where mv.expediente_id = e.id and mv.accion <> 'intercambio'
       order by fecha desc, id desc limit 1
    ) m on true`;

export interface FiltrosExpedientes {
  estados?: EstadoExpediente[];
  tipo?: TipoDenuncia;
  texto?: string;
  limite?: number;
  orden?: "recientes" | "legal_vence" | "proxima_presentacion" | "cm_vence" | "numero";
}

export async function listarExpedientes(db: Db, f: FiltrosExpedientes = {}): Promise<ExpedienteFila[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.estados?.length) {
    params.push(f.estados);
    where.push(`e.estado = any($${params.length})`);
  }
  if (f.tipo) {
    params.push(f.tipo);
    where.push(`e.tipo = $${params.length}`);
  }
  if (f.texto?.trim()) {
    const t = f.texto.trim();
    const digitos = t.replace(/\D/g, "");
    params.push(`%${normalizar(t)}%`);
    const i = params.length;
    const conds = [
      `translate(lower(p.apellido || ' ' || p.nombres), 'áéíóúüñ', 'aeiouun') like $${i}`,
      `e.numero like $${i}`,
      `translate(lower(e.reparticion), 'áéíóúüñ', 'aeiouun') like $${i}`,
    ];
    if (digitos.length >= 4) {
      params.push(`%${digitos}%`);
      conds.push(`p.dni like $${params.length}`, `p.cuil like $${params.length}`);
    }
    where.push(`(${conds.join(" or ")})`);
  }
  const orden = {
    recientes: "e.recibido_en desc",
    legal_vence: "e.legal_vence asc nulls last, e.recibido_en",
    proxima_presentacion: "e.proxima_presentacion asc nulls last, e.recibido_en",
    cm_vence: "e.cm_vence asc nulls last",
    numero: "e.anio desc, e.contador desc, e.sufijo desc",
  }[f.orden ?? "recientes"];
  params.push(f.limite ?? 200);
  const sql = `${SELECT_FILA} ${where.length ? `where ${where.join(" and ")}` : ""} order by ${orden} limit $${params.length}`;
  const { rows } = await db.query<ExpedienteFila>(sql, params);
  return rows;
}

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ---------------------------------------------------------------------------
// Plazos de un expediente
// ---------------------------------------------------------------------------
export interface PlazoExpediente extends EstadoPlazo {
  clave: "configuracion" | "legal" | "presentacion" | "tope_ilt" | "comision_medica";
  nombre: string;
}

type DatosPlazo = Pick<
  Expediente,
  | "tipo"
  | "estado"
  | "recibido_en"
  | "relacion_laboral_verificada"
  | "legal_vence"
  | "proxima_presentacion"
  | "cm_vence"
  | "fecha_ocurrencia"
>;

/** Plazos vigentes según el estado. `ahora` define "hoy". */
export function plazosDe(exp: DatosPlazo, ahora: Date, feriados: ReadonlySet<string>): PlazoExpediente[] {
  const hoy = fechaDe(ahora);
  const plazos: PlazoExpediente[] = [];
  if (exp.estado === "recepcion" && exp.tipo === "EP" && exp.relacion_laboral_verificada === null) {
    const limite = new Date(new Date(exp.recibido_en).getTime() + PLAZOS.configuracionHoras * 3_600_000);
    plazos.push({
      clave: "configuracion",
      nombre: "Control de cobertura (48 h)",
      ...estadoPlazo(hoy, fechaDe(limite), { habiles: false, aviso: 1 }),
    });
  }
  if (exp.estado === "dictamen_legal" && exp.legal_vence) {
    plazos.push({
      clave: "legal",
      nombre: "Dictamen legal",
      ...estadoPlazo(hoy, exp.legal_vence, { habiles: true, feriados, aviso: 2 }),
    });
  }
  if (exp.estado === "licencia_activa" && exp.proxima_presentacion) {
    plazos.push({
      clave: "presentacion",
      nombre: "Próxima presentación",
      ...estadoPlazo(hoy, exp.proxima_presentacion, { habiles: false, aviso: PLAZOS.avisoPresentacionDias }),
    });
  }
  if (exp.estado === "licencia_activa" && exp.fecha_ocurrencia) {
    plazos.push({
      clave: "tope_ilt",
      nombre: "Tope de la ILT (365 días)",
      ...estadoPlazo(hoy, sumarDias(exp.fecha_ocurrencia, PLAZOS.topeIltDias), {
        habiles: false,
        aviso: PLAZOS.avisoTopeIltDias,
      }),
    });
  }
  if (exp.estado === "sin_baja" && exp.cm_vence) {
    plazos.push({
      clave: "comision_medica",
      nombre: "Presentación ante la Comisión Médica",
      ...estadoPlazo(hoy, exp.cm_vence, { habiles: true, feriados, aviso: 3 }),
    });
  }
  return plazos;
}

/** El plazo más urgente (para ordenar y mostrar en una bandeja). */
export function plazoMasUrgente(plazos: PlazoExpediente[]): PlazoExpediente | null {
  const orden = { vencido: 0, hoy: 1, proximo: 2, en_termino: 3 } as const;
  return (
    [...plazos].sort((a, b) => orden[a.nivel] - orden[b.nivel] || a.vence.localeCompare(b.vence))[0] ?? null
  );
}

// ---------------------------------------------------------------------------
// Ficha completa
// ---------------------------------------------------------------------------
export interface ExpedienteVinculado {
  id: number;
  numero: string;
  estado: EstadoExpediente;
  tipo: TipoDenuncia;
  es_reingreso: boolean;
  es_intercurrencia: boolean;
}

export interface ExpedienteFicha {
  expediente: Expediente;
  persona: Persona & { localidad: string | null };
  recibido_por_nombre: string | null;
  localidad_laboral: string | null;
  localidad_ocurrencia: string | null;
  ciuo_descripcion: string | null;
  forma_accidente_descripcion: string | null;
  agente_material_descripcion: string | null;
  diagnosticos: DiagnosticoDetalle[];
  documentos: Documento[];
  citaciones: Citacion[];
  presentaciones: Presentacion[];
  movimientos: Movimiento[];
  comunicaciones: ComunicacionSRT[];
  origen: ExpedienteVinculado | null;
  vinculados: ExpedienteVinculado[];
}

export async function obtenerFicha(db: Db, id: number): Promise<ExpedienteFicha | null> {
  const { rows } = await db.query<Expediente>("select * from expedientes where id = $1", [id]);
  const expediente = rows[0];
  if (!expediente) return null;

  const [persona, extras, diagnosticos, documentos, citaciones, presentaciones, movimientos, comunicaciones, origen, vinculados] =
    await Promise.all([
      db.query<Persona & { localidad: string | null }>(
        `select p.*, l.nombre as localidad from personas p left join cat_localidad l on l.id = p.localidad_id where p.id = $1`,
        [expediente.persona_id],
      ),
      db.query<{
        recibido_por_nombre: string | null;
        localidad_laboral: string | null;
        localidad_ocurrencia: string | null;
        ciuo_descripcion: string | null;
        forma_accidente_descripcion: string | null;
        agente_material_descripcion: string | null;
      }>(
        `select
           (select nombre from usuarios where id = $1) as recibido_por_nombre,
           (select nombre from cat_localidad where id = $2) as localidad_laboral,
           (select nombre from cat_localidad where id = $3) as localidad_ocurrencia,
           (select descripcion from cat_ciuo88 where codigo = $4) as ciuo_descripcion,
           (select descripcion from cat_forma_accidente where codigo = $5) as forma_accidente_descripcion,
           (select descripcion from cat_agente_material where codigo = $6) as agente_material_descripcion`,
        [
          expediente.recibido_por,
          expediente.localidad_laboral_id,
          expediente.localidad_ocurrencia_id,
          expediente.ciuo,
          expediente.forma_accidente,
          expediente.agente_material,
        ],
      ),
      db.query<DiagnosticoDetalle>(
        `select d.*,
           c.descripcion as cie10_descripcion,
           ca.descripcion as cie10_adecuado_descripcion,
           ag.descripcion as agente_descripcion,
           coalesce((select json_agg(json_build_object('orden', l.orden, 'codigo', l.codigo, 'descripcion', cl.descripcion) order by l.orden)
                       from diagnostico_lesiones l join cat_lesion cl on cl.codigo = l.codigo where l.diagnostico_id = d.id), '[]'::json) as lesiones,
           coalesce((select json_agg(json_build_object('orden', z.orden, 'codigo', z.codigo, 'descripcion', cz.descripcion) order by z.orden)
                       from diagnostico_zonas z join cat_zona_cuerpo cz on cz.codigo = z.codigo where z.diagnostico_id = d.id), '[]'::json) as zonas
         from diagnosticos d
         join cat_cie10 c on c.codigo = d.cie10
         left join cat_cie10 ca on ca.codigo = d.cie10_adecuado
         left join cat_agente_causante ag on ag.codigo = d.agente_causante
         where d.expediente_id = $1 order by d.orden`,
        [id],
      ),
      db.query<Documento>(
        `select d.*, u.nombre as cargado_por_nombre from documentos d left join usuarios u on u.id = d.cargado_por
          where d.expediente_id = $1 order by d.cargado_en, d.id`,
        [id],
      ),
      db.query<Citacion>("select * from citaciones where expediente_id = $1 order by fecha_hora", [id]),
      db.query<Presentacion>(
        `select pr.*, u.nombre as registrada_por_nombre from presentaciones pr left join usuarios u on u.id = pr.registrada_por
          where pr.expediente_id = $1 order by pr.fecha desc, pr.id desc`,
        [id],
      ),
      db.query<Movimiento>(
        `select m.*, u.nombre as usuario_nombre from movimientos m left join usuarios u on u.id = m.usuario_id
          where m.expediente_id = $1 order by m.fecha desc, m.id desc`,
        [id],
      ),
      db.query<ComunicacionSRT>("select * from srt_comunicaciones where expediente_id = $1 order by fecha desc, id desc", [id]),
      expediente.origen_id
        ? db.query<ExpedienteVinculado>(
            "select id, numero, estado, tipo, es_reingreso, es_intercurrencia from expedientes where id = $1",
            [expediente.origen_id],
          )
        : Promise.resolve({ rows: [] as ExpedienteVinculado[] }),
      db.query<ExpedienteVinculado>(
        `select id, numero, estado, tipo, es_reingreso, es_intercurrencia from expedientes
          where origen_id = $1 order by sufijo, recibido_en`,
        [id],
      ),
    ]);

  return {
    expediente,
    persona: persona.rows[0],
    ...extras.rows[0],
    diagnosticos: diagnosticos.rows,
    documentos: documentos.rows,
    citaciones: citaciones.rows,
    presentaciones: presentaciones.rows,
    movimientos: movimientos.rows,
    comunicaciones: comunicaciones.rows,
    origen: origen.rows[0] ?? null,
    vinculados: vinculados.rows,
  };
}

// ---------------------------------------------------------------------------
// Citaciones (bandeja del área médica)
// ---------------------------------------------------------------------------
export interface CitacionFila extends Citacion {
  numero: string;
  tipo: TipoDenuncia;
  apellido: string;
  nombres: string;
  reiterada: boolean;
}

export async function listarCitaciones(
  db: Db,
  f: { estado?: "programada" | "no_asistio"; sinReiterar?: boolean } = {},
): Promise<CitacionFila[]> {
  const where = ["e.estado = 'evaluacion_medica'"];
  const params: unknown[] = [];
  if (f.estado) {
    params.push(f.estado);
    where.push(`c.estado = $${params.length}`);
  }
  if (f.sinReiterar) where.push("c.reiteracion_de is null and not exists (select 1 from citaciones r where r.reiteracion_de = c.id)");
  const { rows } = await db.query<CitacionFila>(
    `select c.*, e.numero, e.tipo, p.apellido, p.nombres,
            exists (select 1 from citaciones r where r.reiteracion_de = c.id) as reiterada
       from citaciones c join expedientes e on e.id = c.expediente_id join personas p on p.id = e.persona_id
      where ${where.join(" and ")}
      order by c.fecha_hora`,
    params,
  );
  return rows;
}
