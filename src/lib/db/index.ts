/**
 * Acceso a la base.
 *
 * - Con DATABASE_URL: PostgreSQL real (así corre en la VPS) vía `pg`.
 * - Sin DATABASE_URL: PGlite, un Postgres embebido que guarda los datos en
 *   ~/.mvp-uert/pglite (o PGLITE_DIR). Sirve para desarrollar sin instalar
 *   nada: la primera vez crea el esquema y carga los datos de la demo solo.
 *
 * Las dos variantes exponen la misma interfaz `Db`. Las fechas sin hora llegan
 * como 'YYYY-MM-DD' y los bigint como number.
 */
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import type { Pool, PoolClient } from "pg";

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Varias sentencias sin parámetros (migraciones). */
  exec(sql: string): Promise<void>;
  /** Ejecuta `fn` en una transacción. Dentro de una transacción, se reutiliza la misma. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

const SEARCH_PATH = "uert, public";
const ZONA = "America/Argentina/Buenos_Aires";
const OID_DATE = 1082;
const OID_INT8 = 20;

declare global {
  var __uertDb: Promise<Db> | undefined;
}

/** Conexión compartida del proceso. */
export function getDb(): Promise<Db> {
  if (!globalThis.__uertDb) {
    globalThis.__uertDb = crearDb().catch((e) => {
      globalThis.__uertDb = undefined;
      throw e;
    });
  }
  return globalThis.__uertDb;
}

/**
 * Carpeta de PGlite en desarrollo. Va fuera del proyecto a propósito: si
 * estuviera adentro, el servidor de desarrollo vería cambios todo el tiempo.
 */
export function dirPglite(): string {
  return process.env.PGLITE_DIR || path.join(os.homedir(), ".mvp-uert", "pglite");
}

async function crearDb(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  if (url) return crearPg(url);
  const db = await crearPglite(dirPglite());
  // Desarrollo sin configuración: esquema y datos de la demo la primera vez.
  const { prepararBaseDesarrollo } = await import("./preparar");
  await prepararBaseDesarrollo(db);
  return db;
}

// ---------------------------------------------------------------------------
// PostgreSQL (pg)
// ---------------------------------------------------------------------------
export async function crearPg(url: string): Promise<Db> {
  const { default: pg } = await import("pg");
  pg.types.setTypeParser(OID_DATE, (v: string) => v);
  pg.types.setTypeParser(OID_INT8, (v: string) => Number(v));
  const pool: Pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX || 5),
    options: `-c search_path=${SEARCH_PATH.replace(/\s/g, "")} -c timezone=${ZONA}`,
  });

  const desdeCliente = (cliente: PoolClient): Db => {
    const tx: Db = {
      query: async (sql, params) => {
        const r = await cliente.query(sql, params as unknown[]);
        return { rows: r.rows };
      },
      exec: async (sql) => {
        await cliente.query(sql);
      },
      transaction: (fn) => fn(tx),
    };
    return tx;
  };

  return {
    query: async (sql, params) => {
      const r = await pool.query(sql, params as unknown[]);
      return { rows: r.rows };
    },
    exec: async (sql) => {
      await pool.query(sql);
    },
    transaction: async (fn) => {
      const cliente = await pool.connect();
      try {
        await cliente.query("begin");
        const resultado = await fn(desdeCliente(cliente));
        await cliente.query("commit");
        return resultado;
      } catch (e) {
        await cliente.query("rollback").catch(() => undefined);
        throw e;
      } finally {
        cliente.release();
      }
    },
  };
}

// ---------------------------------------------------------------------------
// PGlite (desarrollo y tests)
// ---------------------------------------------------------------------------
export async function crearPglite(dir: string): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const opciones = {
    parsers: {
      [OID_DATE]: (v: string) => v,
      [OID_INT8]: (v: string) => Number(v),
    },
  };
  if (dir !== ":memory:") await mkdir(path.dirname(path.resolve(dir)), { recursive: true });
  const pgl: PGlite = dir === ":memory:" ? await PGlite.create(opciones) : await PGlite.create(dir, opciones);
  await pgl.exec(`create schema if not exists uert; set search_path to ${SEARCH_PATH}; set timezone to '${ZONA}';`);

  const desdeTx = (t: Transaction): Db => {
    const tx: Db = {
      query: async (sql, params) => {
        const r = await t.query(sql, params as unknown[]);
        return { rows: r.rows as never[] };
      },
      exec: async (sql) => {
        await t.exec(sql);
      },
      transaction: (fn) => fn(tx),
    };
    return tx;
  };

  return {
    query: async (sql, params) => {
      const r = await pgl.query(sql, params as unknown[]);
      return { rows: r.rows as never[] };
    },
    exec: async (sql) => {
      await pgl.exec(sql);
    },
    transaction: (fn) => pgl.transaction((t) => fn(desdeTx(t))),
  };
}

/** Primera fila o null. */
export async function una<T>(db: Db, sql: string, params?: unknown[]): Promise<T | null> {
  const { rows } = await db.query<T>(sql, params);
  return rows[0] ?? null;
}
