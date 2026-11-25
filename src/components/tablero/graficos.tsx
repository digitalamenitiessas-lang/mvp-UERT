/**
 * Gráficos del tablero hechos con divs y Tailwind (sin librerías).
 * Cada valor está escrito al lado de su barra: el color nunca es la única
 * forma de leer el dato.
 */
import Link from "next/link";
import {
  ESTADOS,
  ESTADO_INFO,
  ROL_INFO,
  TIPOS,
  TIPO_INFO,
  type EstadoExpediente,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

function porcentaje(n: number, total: number): number {
  return total ? Math.round((n / total) * 100) : 0;
}

/**
 * Expedientes por etapa, en el orden del circuito. Las etapas en trámite van
 * en el color principal y las finalizadas en gris; el punto indica el área.
 */
export function BarrasPorEtapa({ porEstado }: { porEstado: Record<EstadoExpediente, number> }) {
  const total = ESTADOS.reduce((n, e) => n + porEstado[e], 0);
  const maximo = Math.max(1, ...ESTADOS.map((e) => porEstado[e]));
  const grupos = [
    { titulo: "En trámite", filtro: "abiertos", estados: ESTADOS.filter((e) => ESTADO_INFO[e].abierto) },
    { titulo: "Finalizados", filtro: "cerrados", estados: ESTADOS.filter((e) => !ESTADO_INFO[e].abierto) },
  ];
  return (
    <div className="flex flex-col gap-5">
      {grupos.map((g) => {
        const subtotal = g.estados.reduce((n, e) => n + porEstado[e], 0);
        return (
          <div key={g.titulo} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2 border-b pb-1.5 text-xs font-medium text-muted-foreground">
              <span>{g.titulo}</span>
              {subtotal ? (
                <Link href={`/expedientes?estado=${g.filtro}`} className="tabular-nums hover:text-foreground hover:underline">
                  {plural(subtotal, "expediente")}
                </Link>
              ) : (
                <span className="tabular-nums">{plural(subtotal, "expediente")}</span>
              )}
            </div>
            <ul className="flex flex-col gap-0.5">
              {g.estados.map((e) => {
                const n = porEstado[e];
                const info = ESTADO_INFO[e];
                const area = info.area ? ROL_INFO[info.area] : null;
                const fila = (
                  <>
                    <span className="flex min-w-0 items-center gap-2 text-sm">
                      <span
                        aria-hidden
                        className={cn("size-2 shrink-0 rounded-full", area ? area.punto : "bg-zinc-300")}
                      />
                      <span className="truncate">{info.nombre}</span>
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      {n > 0 ? (
                        <span
                          aria-hidden
                          className={cn("block h-3 shrink-0 rounded-r-[4px]", info.abierto ? "bg-primary" : "bg-zinc-300")}
                          style={{ width: `calc((100% - 2.75rem) * ${n / maximo})` }}
                        />
                      ) : null}
                      <span className={cn("text-sm tabular-nums", n > 0 ? "font-medium" : "text-muted-foreground")}>
                        {n}
                      </span>
                    </span>
                  </>
                );
                const clase =
                  "-mx-1.5 grid grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1.5 py-1 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]";
                const titulo = `${info.nombre}: ${plural(n, "expediente")} (${porcentaje(n, total)} % del total)${area ? ` · ${area.nombre}` : ""}`;
                return (
                  <li key={e}>
                    {n > 0 ? (
                      <Link
                        href={`/expedientes?estado=${e}`}
                        title={`${titulo}. Ver la lista.`}
                        className={cn(
                          clase,
                          "transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        )}
                      >
                        {fila}
                      </Link>
                    ) : (
                      <div className={clase} title={titulo}>
                        {fila}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/**
 * El mismo tono que la etiqueta de cada tipo en el resto de la aplicación
 * (TIPO_INFO.badge: EP rosa, AT azul, in itinere índigo), con distinta
 * luminosidad para que AT e in itinere no se confundan. Siempre acompañados
 * del nombre y el número.
 */
const COLOR_TIPO: Record<TipoDenuncia, string> = {
  AT: "#2563eb", // blue-600
  EP: "#f43f5e", // rose-500
  IT: "#818cf8", // indigo-400
};

/**
 * Reparto por tipo de denuncia: barra segmentada fina y la lista con los
 * números. `abiertos` (opcional) agrega cuántos de cada tipo siguen en trámite.
 */
export function DistribucionPorTipo({
  porTipo,
  abiertos,
}: {
  porTipo: Record<TipoDenuncia, number>;
  abiertos?: Record<TipoDenuncia, number>;
}) {
  const total = TIPOS.reduce((n, t) => n + porTipo[t], 0);
  const resumen = TIPOS.map((t) => `${TIPO_INFO[t].nombre}: ${porTipo[t]}`).join(", ");
  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={`Expedientes por tipo de denuncia. ${resumen}.`}
        className={cn("flex h-2 w-full gap-0.5 overflow-hidden rounded-full", total === 0 && "bg-muted")}
      >
        {TIPOS.filter((t) => porTipo[t] > 0).map((t) => (
          <span
            key={t}
            className="block h-full basis-0"
            style={{ flexGrow: porTipo[t], backgroundColor: COLOR_TIPO[t] }}
            title={`${TIPO_INFO[t].nombre}: ${porTipo[t]} (${porcentaje(porTipo[t], total)} %)`}
          />
        ))}
      </div>
      <ul className="flex flex-col divide-y">
        {TIPOS.map((t) => {
          const fila = (
            <>
              <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: COLOR_TIPO[t] }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">{TIPO_INFO[t].nombre}</span>
                {abiertos ? (
                  <span className="text-xs text-muted-foreground">
                    {abiertos[t] === 1 ? "1 en trámite" : `${abiertos[t]} en trámite`}
                  </span>
                ) : null}
              </span>
              <span className="text-sm font-medium tabular-nums">{porTipo[t]}</span>
              <span className="w-11 text-right text-xs text-muted-foreground tabular-nums">
                {porcentaje(porTipo[t], total)} %
              </span>
            </>
          );
          const clase = "-mx-1.5 flex items-center gap-3 rounded-md px-1.5 py-2";
          return (
            <li key={t} className="py-0.5">
              {porTipo[t] > 0 ? (
                <Link
                  href={`/expedientes?tipo=${t}`}
                  title={`Ver los expedientes de ${TIPO_INFO[t].nombre.toLowerCase()}`}
                  className={cn(
                    clase,
                    "transition-colors hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  )}
                >
                  {fila}
                </Link>
              ) : (
                <div className={clase}>{fila}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
