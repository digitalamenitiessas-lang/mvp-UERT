import { InboxIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { ComunicacionFila } from "@/lib/datos/srt";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { formatoCuil } from "@/lib/dominio/validaciones";
import { campoTexto, erroresSoap } from "./canales";
import { CanalBadge, DetalleRequestResponse, ExpedienteRef, ResultadoSrt } from "./piezas";

function Vacio({ titulo, descripcion }: { titulo: string; descripcion: string }) {
  return (
    <Empty className="rounded-lg border border-dashed bg-background py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <InboxIcon />
        </EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription>{descripcion}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

const COLUMNAS_WS = "md:grid-cols-[9.5rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]";

/** Llamadas al Web Service FODEP con su resultado y el detalle del request/response. */
export function ListaWebService({
  filas,
  vacio,
}: {
  filas: ComunicacionFila[];
  vacio: { titulo: string; descripcion: string };
}) {
  if (!filas.length) return <Vacio {...vacio} />;
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div
        aria-hidden
        className={`hidden gap-4 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium md:grid ${COLUMNAS_WS}`}
      >
        <span>Fecha</span>
        <span>Expediente</span>
        <span>Operación</span>
        <span>Resultado</span>
      </div>
      <ul className="divide-y">
        {filas.map((c) => {
          const errores = erroresSoap(c.response);
          return (
            <li key={c.id} className={c.ok ? "px-4 py-3" : "bg-red-50/40 px-4 py-3"}>
              <dl className={`grid gap-x-4 gap-y-2 md:items-start ${COLUMNAS_WS}`}>
                <div>
                  <dt className="sr-only">Fecha</dt>
                  <dd className="text-sm text-muted-foreground tabular-nums">{formatoFechaHora(c.fecha)}</dd>
                </div>
                <div>
                  <dt className="sr-only">Expediente</dt>
                  <dd>
                    <ExpedienteRef id={c.expediente_id} numero={c.numero} apellido={c.apellido} nombres={c.nombres} />
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Operación</dt>
                  <dd className="font-mono text-sm">{c.operacion}</dd>
                </div>
                <div>
                  <dt className="sr-only">Resultado</dt>
                  <dd className="flex flex-col items-start gap-1.5">
                    <ResultadoSrt ok={c.ok} codigo={c.error_codigo} mensaje={c.error_mensaje} />
                    {!c.ok ? (
                      errores.length ? (
                        <ul className="flex flex-col gap-0.5 text-xs text-red-800">
                          {errores.map((e, i) => (
                            <li key={i}>
                              <span className="font-mono font-medium">{e.codigo}</span>
                              {e.campo ? <span className="font-mono"> · {e.campo}</span> : null}: {e.mensaje}
                            </li>
                          ))}
                        </ul>
                      ) : c.error_mensaje ? (
                        <span className="text-xs text-red-800">{c.error_mensaje}</span>
                      ) : null
                    ) : null}
                  </dd>
                </div>
              </dl>
              <DetalleRequestResponse request={c.request} response={c.response} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Destinatario legible de una notificación según su canal. */
function destinatario(c: ComunicacionFila): { titulo: string; detalle: string[] } {
  if (c.canal === "ventanilla") {
    const reparticion = campoTexto(c.request, "Reparticion");
    const cuit = campoTexto(c.request, "CuitEmpleador");
    return {
      titulo: reparticion ?? "Empleador",
      detalle: cuit ? [`CUIT ${formatoCuil(cuit)}`] : [],
    };
  }
  const cuil = campoTexto(c.request, "Cuil");
  const email = campoTexto(c.request, "Email");
  const nombre = c.apellido ? `${c.apellido}${c.nombres ? `, ${c.nombres}` : ""}` : "Trabajador/a";
  return {
    titulo: nombre,
    detalle: [cuil ? `CUIL ${formatoCuil(cuil)}` : null, email].filter((d): d is string => !!d),
  };
}

const COLUMNAS_NOTIF = "md:grid-cols-[9.5rem_minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_5rem]";

/** Notificaciones al trabajador (e-Servicios) y al empleador (Ventanilla Electrónica). */
export function ListaNotificaciones({
  filas,
  vacio,
}: {
  filas: ComunicacionFila[];
  vacio: { titulo: string; descripcion: string };
}) {
  if (!filas.length) return <Vacio {...vacio} />;
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div
        aria-hidden
        className={`hidden gap-4 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium md:grid ${COLUMNAS_NOTIF}`}
      >
        <span>Fecha</span>
        <span>Destinatario</span>
        <span>Asunto</span>
        <span>Expediente</span>
        <span>Resultado</span>
      </div>
      <ul className="divide-y">
        {filas.map((c) => {
          const para = destinatario(c);
          const asunto = campoTexto(c.request, "Asunto");
          const cuerpo = campoTexto(c.request, "Cuerpo");
          return (
            <li key={c.id} className="px-4 py-3">
              <dl className={`grid gap-x-4 gap-y-2 md:items-start ${COLUMNAS_NOTIF}`}>
                <div>
                  <dt className="sr-only">Fecha</dt>
                  <dd className="text-sm text-muted-foreground tabular-nums">{formatoFechaHora(c.fecha)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="sr-only">Destinatario</dt>
                  <dd className="flex min-w-0 flex-col items-start gap-1">
                    <CanalBadge canal={c.canal} largo />
                    <span className="text-sm font-medium break-words">{para.titulo}</span>
                    {para.detalle.map((d) => (
                      <span key={d} className="max-w-full text-xs break-words text-muted-foreground">
                        {d}
                      </span>
                    ))}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="sr-only">Asunto</dt>
                  <dd className="text-sm break-words">{asunto ?? c.operacion}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="sr-only">Expediente</dt>
                  <dd>
                    <ExpedienteRef id={c.expediente_id} numero={c.numero} />
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Resultado</dt>
                  <dd>
                    <ResultadoSrt ok={c.ok} codigo={c.error_codigo} mensaje={c.error_mensaje} />
                  </dd>
                </div>
              </dl>
              <DetalleRequestResponse request={c.request} response={c.response} resumen="Ver el mensaje enviado">
                {cuerpo ? (
                  <div className="rounded-md border bg-muted/20 px-3 py-2">
                    <span className="text-xs font-medium text-muted-foreground">Mensaje</span>
                    <p className="mt-1 text-sm whitespace-pre-line">{cuerpo}</p>
                  </div>
                ) : null}
              </DetalleRequestResponse>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
