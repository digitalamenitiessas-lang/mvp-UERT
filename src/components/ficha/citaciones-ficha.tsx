import Link from "next/link";
import { CalendarClockIcon, PrinterIcon } from "lucide-react";
import { EstadoCitacionBadge, Etiqueta, Simulado } from "@/components/comun/badges";
import { Seccion } from "@/components/comun/pagina";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExpedienteFicha } from "@/lib/datos/expedientes";
import { MOTIVO_CITACION_INFO, PLAZOS } from "@/lib/dominio/constantes";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { CLASE, Vacio } from "./util";

/** Solapa "Citaciones": citaciones del Área médica, con reiteraciones y resultados. */
export function CitacionesFicha({ ficha }: { ficha: ExpedienteFicha }) {
  const citaciones = ficha.citaciones;
  const enMedica = ficha.expediente.estado === "evaluacion_medica";
  const porId = new Map(citaciones.map((c) => [c.id, c]));

  return (
    <Seccion
      titulo={`Citaciones (${citaciones.length})`}
      descripcion={`Se notifican con al menos ${PLAZOS.citacionHorasMinimas} h de anticipación. Si el trabajador no asiste, se reitera por única vez; una segunda inasistencia hace caducar el trámite (Anexo II, puntos 1.6 y 3.3).`}
      acciones={<Simulado texto="Notificaciones simuladas" />}
    >
      {citaciones.length ? (
        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Estado</TableHead>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Lugar</TableHead>
                <TableHead>Notificada</TableHead>
                <TableHead>
                  <span className="sr-only">Imprimir</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {citaciones.map((c) => {
                const original = c.reiteracion_de ? porId.get(c.reiteracion_de) : undefined;
                const reiteracion = citaciones.find((r) => r.reiteracion_de === c.id);
                const hayQueReiterar = enMedica && c.estado === "no_asistio" && !c.reiteracion_de && !reiteracion;
                return (
                  <TableRow key={c.id} className="[&>td]:align-top">
                    <TableCell className="min-w-36 whitespace-normal">
                      <div className="flex flex-col items-start gap-1">
                        <EstadoCitacionBadge estado={c.estado} />
                        {hayQueReiterar ? <Etiqueta className={CLASE.aviso}>Hay que reiterarla</Etiqueta> : null}
                        {c.reiteracion_de && c.estado === "programada" ? (
                          <Etiqueta className={CLASE.aviso}>Si no asiste, caduca</Etiqueta>
                        ) : null}
                        {c.reiteracion_de ? (
                          <span className="text-xs text-muted-foreground">
                            Reitera la citación{original ? ` del ${formatoFechaHora(original.fecha_hora)}` : ""}
                          </span>
                        ) : reiteracion ? (
                          <span className="text-xs text-muted-foreground">
                            Reiterada para el {formatoFechaHora(reiteracion.fecha_hora)}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatoFechaHora(c.fecha_hora)}</TableCell>
                    <TableCell className="min-w-36 whitespace-normal">
                      {MOTIVO_CITACION_INFO[c.motivo]}
                      {c.detalle ? <span className="block text-xs text-muted-foreground">{c.detalle}</span> : null}
                    </TableCell>
                    <TableCell className="min-w-36 whitespace-normal text-sm">{c.lugar}</TableCell>
                    <TableCell className="text-xs">
                      {formatoFechaHora(c.notificada_en)}
                      <span className="block text-muted-foreground">e-Servicios SRT y correo</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link
                          href={`/imprimir/citacion/${c.id}`}
                          target="_blank"
                          rel="noopener"
                          aria-label={`Imprimir la citación del ${formatoFechaHora(c.fecha_hora)}`}
                          title="Imprimir la citación"
                        >
                          <PrinterIcon />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Vacio
          icono={CalendarClockIcon}
          titulo="Sin citaciones"
          descripcion="El Área médica cita al trabajador cuando necesita examinarlo, pedirle estudios o documentación."
        />
      )}
    </Seccion>
  );
}
