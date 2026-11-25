import { ArrowRightIcon, HistoryIcon } from "lucide-react";
import { EstadoBadge, RolBadge } from "@/components/comun/badges";
import { Seccion } from "@/components/comun/pagina";
import { Card, CardContent } from "@/components/ui/card";
import type { ExpedienteFicha } from "@/lib/datos/expedientes";
import { ROL_INFO } from "@/lib/dominio/constantes";
import { fechaDe, formatoFechaLarga, formatoHora } from "@/lib/dominio/fechas";
import type { Movimiento } from "@/lib/tipos";
import { Hito, LineaTiempo } from "./linea-tiempo";
import { Vacio } from "./util";

/** Agrupa los movimientos (ya ordenados del más nuevo al más viejo) por día. */
function porDia(movimientos: Movimiento[]): Array<{ dia: string; items: Movimiento[] }> {
  const grupos: Array<{ dia: string; items: Movimiento[] }> = [];
  for (const m of movimientos) {
    const dia = fechaDe(new Date(m.fecha));
    const ultimo = grupos.at(-1);
    if (ultimo && ultimo.dia === dia) ultimo.items.push(m);
    else grupos.push({ dia, items: [m] });
  }
  return grupos;
}

/** Solapa "Historial": todos los movimientos del expediente, del más reciente al más antiguo. */
export function HistorialFicha({ ficha }: { ficha: ExpedienteFicha }) {
  const movimientos = ficha.movimientos;
  if (!movimientos.length) {
    return <Vacio icono={HistoryIcon} titulo="Sin movimientos" descripcion="Este expediente todavía no tiene historial." />;
  }
  return (
    <Seccion
      titulo={`Historial (${movimientos.length})`}
      descripcion="Quién hizo qué y cuándo: cada acción queda registrada con el usuario, su rol y el cambio de estado."
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          {porDia(movimientos).map(({ dia, items }) => (
            <section key={dia} className="flex flex-col gap-3" aria-label={formatoFechaLarga(dia)}>
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{formatoFechaLarga(dia)}</h3>
              <LineaTiempo>
                {items.map((m) => (
                  <Hito key={m.id} punto={m.rol ? ROL_INFO[m.rol].punto : "bg-zinc-400"}>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <time dateTime={new Date(m.fecha).toISOString()} className="font-mono tabular-nums">
                        {formatoHora(m.fecha)}
                      </time>
                      <span className="font-medium text-foreground">{m.usuario_nombre ?? "Sistema"}</span>
                      {m.rol ? <RolBadge rol={m.rol} /> : null}
                    </div>
                    <p className="mt-1 text-sm">{m.detalle}</p>
                    {m.estado_nuevo ? (
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {m.estado_anterior ? <EstadoBadge estado={m.estado_anterior} /> : <span>Ingreso</span>}
                        <ArrowRightIcon className="size-3.5" aria-label="pasa a" />
                        <EstadoBadge estado={m.estado_nuevo} />
                      </div>
                    ) : null}
                  </Hito>
                ))}
              </LineaTiempo>
            </section>
          ))}
        </CardContent>
      </Card>
    </Seccion>
  );
}
