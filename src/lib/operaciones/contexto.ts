/**
 * Piezas comunes de las operaciones (todo lo que modifica datos).
 *
 * Cada operación recibe un `Ctx`: la base, el usuario que actúa y "ahora".
 * Pasar el reloj explícito permite probar las reglas de plazos y armar los
 * datos de la demo con fechas pasadas usando las mismas operaciones.
 */
import { ZodError } from "zod";
import type { Db } from "@/lib/db";
import { ESTADO_INFO, ROL_INFO, type EstadoExpediente } from "@/lib/dominio/constantes";
import { fechaDe, type FechaISO } from "@/lib/dominio/fechas";
import { puede, type Accion } from "@/lib/dominio/permisos";
import type { Expediente, Usuario } from "@/lib/tipos";

export interface Ctx {
  db: Db;
  usuario: Usuario;
  ahora: Date;
}

/** Error esperable (regla de negocio): su mensaje se muestra tal cual al usuario. */
export class ErrorNegocio extends Error {
  constructor(
    mensaje: string,
    public detalles: string[] = [],
  ) {
    super(mensaje);
    this.name = "ErrorNegocio";
  }
}

export function exigir(condicion: unknown, mensaje: string, detalles: string[] = []): asserts condicion {
  if (!condicion) throw new ErrorNegocio(mensaje, detalles);
}

export function exigirPermiso(ctx: Ctx, accion: Accion, estado?: EstadoExpediente): void {
  if (puede(ctx.usuario.rol, accion, estado)) return;
  const rol = ROL_INFO[ctx.usuario.rol].nombre;
  throw new ErrorNegocio(
    estado
      ? `${rol} no puede hacer esto con un expediente "${ESTADO_INFO[estado].nombre}".`
      : `${rol} no puede hacer esto.`,
  );
}

/** Valida con zod y convierte los errores en un ErrorNegocio legible. */
export function validar<T>(esquema: { parse(v: unknown): T }, entrada: unknown): T {
  try {
    return esquema.parse(entrada);
  } catch (e) {
    if (e instanceof ZodError) {
      const detalles = e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
      throw new ErrorNegocio("Hay datos incompletos o inválidos.", detalles);
    }
    throw e;
  }
}

export function hoyCtx(ctx: Ctx): FechaISO {
  return fechaDe(ctx.ahora);
}

export function nulo(valor: string | null | undefined): string | null {
  const v = valor?.trim();
  return v ? v : null;
}

/** Lee el expediente bloqueándolo hasta el fin de la transacción. */
export async function bloquearExpediente(tx: Db, id: number): Promise<Expediente> {
  const { rows } = await tx.query<Expediente>("select * from expedientes where id = $1 for update", [id]);
  if (!rows[0]) throw new ErrorNegocio("El expediente no existe.");
  return rows[0];
}

/** UPDATE de columnas del expediente. Las claves vienen siempre del código, nunca del usuario. */
export async function actualizarExpediente(
  tx: Db,
  ctx: Ctx,
  id: number,
  campos: Record<string, unknown>,
): Promise<void> {
  const claves = Object.keys(campos);
  if (!claves.length) return;
  const sets = claves.map((c, i) => `${c} = $${i + 2}`);
  sets.push(`actualizado_en = $${claves.length + 2}`);
  await tx.query(`update expedientes set ${sets.join(", ")} where id = $1`, [
    id,
    ...claves.map((c) => campos[c]),
    ctx.ahora,
  ]);
}

export interface NuevoMovimiento {
  expediente_id: number | null;
  accion: string;
  detalle: string;
  estado_anterior?: EstadoExpediente | null;
  estado_nuevo?: EstadoExpediente | null;
  datos?: Record<string, unknown> | null;
}

export async function registrarMovimiento(tx: Db, ctx: Ctx, m: NuevoMovimiento): Promise<void> {
  await tx.query(
    `insert into movimientos (expediente_id, fecha, usuario_id, rol, accion, detalle, estado_anterior, estado_nuevo, datos)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      m.expediente_id,
      ctx.ahora,
      ctx.usuario.id,
      ctx.usuario.rol,
      m.accion,
      m.detalle,
      m.estado_anterior ?? null,
      m.estado_nuevo ?? null,
      m.datos ? JSON.stringify(m.datos) : null,
    ],
  );
}

/** Cambia el estado y deja el movimiento en el historial. Actualiza `exp` en memoria. */
export async function cambiarEstado(
  tx: Db,
  ctx: Ctx,
  exp: Expediente,
  nuevo: EstadoExpediente,
  accion: string,
  detalle: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const cerrado = !ESTADO_INFO[nuevo].abierto;
  await actualizarExpediente(tx, ctx, exp.id, { estado: nuevo, ...(cerrado ? { cerrado_en: ctx.ahora } : {}), ...extra });
  await registrarMovimiento(tx, ctx, {
    expediente_id: exp.id,
    accion,
    detalle,
    estado_anterior: exp.estado,
    estado_nuevo: nuevo,
  });
  exp.estado = nuevo;
}

export async function cargarFeriados(db: Db): Promise<Set<string>> {
  const { rows } = await db.query<{ fecha: string }>("select fecha from feriados");
  return new Set(rows.map((r) => r.fecha));
}

/** Controla que los códigos existan en un catálogo. */
export async function verificarCodigos(
  tx: Db,
  tabla:
    | "cat_cie10"
    | "cat_agente_causante"
    | "cat_lesion"
    | "cat_zona_cuerpo"
    | "cat_forma_accidente"
    | "cat_agente_material"
    | "cat_ciuo88",
  codigos: Array<string | null | undefined>,
  etiqueta: string,
): Promise<void> {
  const unicos = [...new Set(codigos.filter((c): c is string => !!c))];
  if (!unicos.length) return;
  const { rows } = await tx.query<{ codigo: string }>(`select codigo from ${tabla} where codigo = any($1)`, [unicos]);
  const existentes = new Set(rows.map((r) => r.codigo));
  const faltan = unicos.filter((c) => !existentes.has(c));
  exigir(!faltan.length, `${etiqueta}: código inexistente (${faltan.join(", ")}).`);
}

export async function verificarLocalidad(tx: Db, id: number | null, etiqueta: string): Promise<void> {
  if (!id) return;
  const { rows } = await tx.query("select 1 from cat_localidad where id = $1", [id]);
  exigir(rows.length, `${etiqueta}: localidad inexistente.`);
}
