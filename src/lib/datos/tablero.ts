/**
 * Indicadores para el tablero de Dirección y la bandeja de cada rol.
 */
import type { Db } from "@/lib/db";
import { ESTADOS, type EstadoExpediente, type TipoDenuncia } from "@/lib/dominio/constantes";
import { listarExpedientes, plazosDe, type ExpedienteFila, type PlazoExpediente } from "./expedientes";

export interface Tablero {
  porEstado: Record<EstadoExpediente, number>;
  porTipo: Record<TipoDenuncia, number>;
  abiertos: number;
  recibidosUltimos30: number;
  srtErrores: number;
  pendientesIntercambio: number;
  vencimientos: Array<{ expediente: ExpedienteFila; plazo: PlazoExpediente }>;
}

export async function obtenerTablero(db: Db, ahora: Date, feriados: ReadonlySet<string>): Promise<Tablero> {
  const [estados, tipos, recientes, errores, abiertos] = await Promise.all([
    db.query<{ estado: EstadoExpediente; n: number }>("select estado, count(*)::int as n from expedientes group by estado"),
    db.query<{ tipo: TipoDenuncia; n: number }>("select tipo, count(*)::int as n from expedientes group by tipo"),
    db.query<{ n: number }>("select count(*)::int as n from expedientes where recibido_en >= $1", [
      new Date(ahora.getTime() - 30 * 86_400_000),
    ]),
    db.query<{ n: number }>("select count(*)::int as n from srt_comunicaciones where not ok"),
    listarExpedientes(db, {
      estados: ["recepcion", "evaluacion_medica", "dictamen_legal", "licencia_activa", "sin_baja"],
      limite: 500,
    }),
  ]);
  const porEstado = Object.fromEntries(ESTADOS.map((e) => [e, 0])) as Record<EstadoExpediente, number>;
  estados.rows.forEach((r) => (porEstado[r.estado] = r.n));
  const porTipo = { EP: 0, AT: 0, IT: 0 } as Record<TipoDenuncia, number>;
  tipos.rows.forEach((r) => (porTipo[r.tipo] = r.n));

  const vencimientos = abiertos
    .flatMap((e) =>
      plazosDe(
        {
          tipo: e.tipo,
          estado: e.estado,
          recibido_en: e.recibido_en,
          relacion_laboral_verificada: e.relacion_laboral_verificada,
          legal_vence: e.legal_vence,
          proxima_presentacion: e.proxima_presentacion,
          cm_vence: e.cm_vence,
          fecha_ocurrencia: e.fecha_ocurrencia,
        },
        ahora,
        feriados,
      ).map((plazo) => ({ expediente: e, plazo })),
    )
    .filter((v) => v.plazo.nivel !== "en_termino")
    .sort((a, b) => a.plazo.vence.localeCompare(b.plazo.vence));

  const { pendientesDeIntercambio } = await import("@/lib/operaciones/intercambio");
  return {
    porEstado,
    porTipo,
    abiertos: abiertos.length,
    recibidosUltimos30: recientes.rows[0].n,
    srtErrores: errores.rows[0].n,
    pendientesIntercambio: await pendientesDeIntercambio(db),
    vencimientos,
  };
}
