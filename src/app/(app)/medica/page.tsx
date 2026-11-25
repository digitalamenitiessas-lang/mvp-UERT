import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClockIcon,
  ClipboardListIcon,
  InfoIcon,
  PrinterIcon,
  RepeatIcon,
  StethoscopeIcon,
} from "lucide-react";
import { Etiqueta, Simulado, TipoBadge } from "@/components/comun/badges";
import { EncabezadoPagina, Seccion } from "@/components/comun/pagina";
import { TablaExpedientes, type ColumnaExtra } from "@/components/comun/tabla-expedientes";
import { GrillaIndicadores, TarjetaIndicador } from "@/components/comun/tarjeta-indicador";
import { TONO, cuandoRelativo, yaPaso } from "@/components/medica/utilidades";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getDb } from "@/lib/db";
import { listarCitaciones, listarExpedientes, type CitacionFila, type ExpedienteFila } from "@/lib/datos/expedientes";
import { MOTIVO_CITACION_INFO, PLAZOS, ROL_INFO } from "@/lib/dominio/constantes";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { plural } from "@/lib/formato";
import { requerirUsuario } from "@/lib/sesion";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Área médica" };

/** Bandeja del Área médica: expedientes en evaluación, citaciones e inasistencias. */
export default async function BandejaMedica() {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const [expedientes, programadas, porReiterar] = await Promise.all([
    listarExpedientes(db, { estados: ["evaluacion_medica"], limite: 500 }),
    listarCitaciones(db, { estado: "programada" }),
    listarCitaciones(db, { estado: "no_asistio", sinReiterar: true }),
  ]);
  const ahora = new Date();

  // Los que esperan hace más tiempo, primero
  const filas = [...expedientes].sort((a, b) => new Date(a.recibido_en).getTime() - new Date(b.recibido_en).getTime());
  const listos = filas.filter(listoParaLegal).length;
  const dxPendientes = filas.reduce((n, f) => n + f.diagnosticos_pendientes, 0);
  const dxTotal = filas.reduce((n, f) => n + f.diagnosticos_total, 0);
  const esperanResultado = programadas.filter((c) => yaPaso(c.fecha_hora, ahora)).length;

  const columnas: ColumnaExtra[] = [
    { titulo: "Diagnósticos", celda: (f) => <Diagnosticos fila={f} /> },
    { titulo: "Baja", celda: (f) => <Baja conBaja={f.con_baja} /> },
    { titulo: "Próxima citación", celda: (f) => <ProximaCitacion fila={f} ahora={ahora} /> },
    {
      titulo: "Próximo paso",
      celda: (f) => {
        const paso = proximoPaso(f, ahora);
        return <Etiqueta className={paso.tono}>{paso.texto}</Etiqueta>;
      },
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Área médica"
        descripcion="Evaluá cada diagnóstico, citá al trabajador cuando haga falta, definí la baja laboral y pasá los expedientes al Área legal."
      >
        {usuario.rol !== "medico" ? (
          <Alert>
            <InfoIcon />
            <AlertTitle>Estás viendo la bandeja como {ROL_INFO[usuario.rol].nombre}</AlertTitle>
            <AlertDescription>
              Para evaluar, citar o pasar expedientes al Área legal, cambiá al rol Área médica desde “Viendo como”, arriba a
              la derecha.
            </AlertDescription>
          </Alert>
        ) : null}
      </EncabezadoPagina>

      <div className="flex flex-col gap-8">
        <GrillaIndicadores>
          <TarjetaIndicador
            href="#para-evaluar"
            icono={ClipboardListIcon}
            tono={filas.length ? "neutro" : "apagado"}
            titulo="Para evaluar"
            valor={filas.length}
            detalle={
              listos
                ? `${plural(listos, "listo", "listos")} para pasar al Área legal`
                : "Ninguno listo todavía para el pase al Área legal"
            }
          />
          <TarjetaIndicador
            href="#para-evaluar"
            icono={StethoscopeIcon}
            tono={dxPendientes ? "alerta" : "apagado"}
            titulo="Diagnósticos sin evaluar"
            valor={dxPendientes}
            detalle={dxTotal ? `De ${plural(dxTotal, "diagnóstico", "diagnósticos")} en el área` : "No hay diagnósticos en el área"}
          />
          <TarjetaIndicador
            href="#citaciones"
            icono={CalendarClockIcon}
            tono={esperanResultado ? "alerta" : programadas.length ? "neutro" : "apagado"}
            titulo="Citaciones programadas"
            valor={programadas.length}
            detalle={
              esperanResultado
                ? `${plural(esperanResultado, "ya pasó y espera", "ya pasaron y esperan")} el resultado`
                : "Ninguna con el resultado pendiente"
            }
          />
          <TarjetaIndicador
            href="#reiterar"
            icono={RepeatIcon}
            tono={porReiterar.length ? "alerta" : "apagado"}
            titulo="Citaciones por reiterar"
            valor={porReiterar.length}
            detalle="No asistieron: se reitera por única vez"
          />
        </GrillaIndicadores>

        <div id="para-evaluar" className="scroll-mt-32">
          <Seccion
            titulo="Para evaluar"
            descripcion="Expedientes en evaluación médica. Cuando todos los diagnósticos estén evaluados, la baja definida y no queden citaciones pendientes, pasalos al Área legal."
          >
            <TablaExpedientes
              filas={filas}
              columnas={columnas}
              ocultar={["estado", "plazo"]}
              vacio="No hay expedientes en evaluación médica."
            />
          </Seccion>
        </div>

        <div id="citaciones" className="scroll-mt-32">
          <Seccion
            titulo="Citaciones programadas"
            descripcion={
              <span className="inline-flex flex-wrap items-center gap-1.5">
                Se notifican por e-Servicios SRT y por email con al menos {PLAZOS.citacionHorasMinimas} h de anticipación
                (Anexo II pto. 1.6). <Simulado />
              </span>
            }
          >
            <TablaProgramadas filas={programadas} ahora={ahora} />
          </Seccion>
        </div>

        <div id="reiterar" className="scroll-mt-32">
          <Seccion
            titulo="No asistieron: reiterar la citación"
            descripcion="Se reitera por única vez, bajo apercibimiento de caducidad (Anexo II pto. 3.3). Si tampoco asiste, el expediente queda Desistido."
          >
            <TablaPorReiterar filas={porReiterar} />
          </Seccion>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Estado de cada expediente
// ---------------------------------------------------------------------------

/** Los mismos controles que exige el pase al Área legal. */
function listoParaLegal(f: ExpedienteFila): boolean {
  return f.diagnosticos_total > 0 && f.diagnosticos_pendientes === 0 && f.con_baja !== null && f.citacion_proxima === null;
}

function proximoPaso(f: ExpedienteFila, ahora: Date): { texto: string; tono: string } {
  if (f.citacion_proxima && yaPaso(f.citacion_proxima, ahora)) return { texto: "Registrar la asistencia", tono: TONO.naranja };
  if (f.citacion_sin_reiterar && !f.citacion_proxima) return { texto: "Reiterar la citación", tono: TONO.rojo };
  if (f.diagnosticos_total === 0) return { texto: "Agregar un diagnóstico", tono: TONO.ambar };
  if (f.diagnosticos_pendientes > 0) {
    return f.citacion_proxima
      ? { texto: "Evaluar en la citación", tono: TONO.azul }
      : { texto: "Evaluar diagnósticos", tono: TONO.azul };
  }
  if (f.con_baja === null) return { texto: "Definir la baja", tono: TONO.ambar };
  if (f.citacion_proxima) return { texto: "Esperar la citación", tono: TONO.gris };
  return { texto: "Pasar al Área legal", tono: TONO.verde };
}

function Diagnosticos({ fila: f }: { fila: ExpedienteFila }) {
  if (!f.diagnosticos_total) return <span className="text-sm text-muted-foreground">Sin diagnóstico</span>;
  const porcentaje = Math.round((f.diagnosticos_evaluados / f.diagnosticos_total) * 100);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm">
        <span className="font-medium tabular-nums">
          {f.diagnosticos_evaluados}/{f.diagnosticos_total}
        </span>{" "}
        <span className="text-muted-foreground">evaluados</span>
      </span>
      <span
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Diagnósticos evaluados"
        aria-valuemin={0}
        aria-valuemax={f.diagnosticos_total}
        aria-valuenow={f.diagnosticos_evaluados}
      >
        <span
          className={cn("block h-full rounded-full", porcentaje === 100 ? "bg-emerald-500" : "bg-sky-500")}
          style={{ width: `${porcentaje}%` }}
        />
      </span>
    </div>
  );
}

function Baja({ conBaja }: { conBaja: boolean | null }) {
  if (conBaja === null) return <span className="text-sm text-muted-foreground">A definir</span>;
  return conBaja ? (
    <Etiqueta className={TONO.ambar}>Con baja</Etiqueta>
  ) : (
    <Etiqueta className={TONO.turquesa}>Sin baja</Etiqueta>
  );
}

function ProximaCitacion({ fila: f, ahora }: { fila: ExpedienteFila; ahora: Date }) {
  if (f.citacion_proxima) {
    const pasada = yaPaso(f.citacion_proxima, ahora);
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm tabular-nums">{formatoFechaHora(f.citacion_proxima)}</span>
        {pasada ? (
          <Etiqueta className={TONO.naranja}>Esperando resultado</Etiqueta>
        ) : (
          <span className="text-xs text-muted-foreground">{cuandoRelativo(f.citacion_proxima, ahora)}</span>
        )}
      </div>
    );
  }
  if (f.citacion_sin_reiterar) return <Etiqueta className={TONO.rojo}>No asistió</Etiqueta>;
  return <span className="text-muted-foreground">—</span>;
}

// ---------------------------------------------------------------------------
// Piezas de la página
// ---------------------------------------------------------------------------

function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Empty className="rounded-lg border border-dashed bg-background py-8">
      <EmptyHeader>
        <EmptyTitle className="text-sm">{titulo}</EmptyTitle>
        <EmptyDescription>{texto}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function CeldaExpediente({ c }: { c: CitacionFila }) {
  return (
    <>
      <Link href={`/expedientes/${c.expediente_id}`} className="font-mono text-sm font-medium text-primary hover:underline">
        {c.numero}
      </Link>
      <div className="mt-1">
        <TipoBadge tipo={c.tipo} />
      </div>
    </>
  );
}

function TablaProgramadas({ filas, ahora }: { filas: CitacionFila[]; ahora: Date }) {
  if (!filas.length) {
    return <Vacio titulo="Sin citaciones programadas" texto="Cuando el Área médica cite a un trabajador, aparece acá." />;
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Trabajador/a</TableHead>
            <TableHead className="w-44">Expediente</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="hidden lg:table-cell">Lugar</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((c) => {
            const pasada = yaPaso(c.fecha_hora, ahora);
            return (
              <TableRow key={c.id} className={cn("align-top", pasada && "bg-amber-50/70 hover:bg-amber-50")}>
                <TableCell>
                  <div className="font-medium tabular-nums">{formatoFechaHora(c.fecha_hora)}</div>
                  {pasada ? (
                    <Etiqueta className={cn("mt-1", TONO.naranja)}>Pasó la fecha: falta el resultado</Etiqueta>
                  ) : (
                    <div className="text-xs text-muted-foreground">{cuandoRelativo(c.fecha_hora, ahora)}</div>
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {c.apellido}, {c.nombres}
                </TableCell>
                <TableCell>
                  <CeldaExpediente c={c} />
                </TableCell>
                <TableCell>
                  <div>{MOTIVO_CITACION_INFO[c.motivo]}</div>
                  {c.reiteracion_de ? (
                    <Etiqueta className={cn("mt-1", TONO.ambar)} title="Bajo apercibimiento de caducidad (Anexo II pto. 3.3)">
                      Reiteración
                    </Etiqueta>
                  ) : null}
                </TableCell>
                <TableCell className="hidden max-w-64 text-sm whitespace-normal text-muted-foreground lg:table-cell">
                  {c.lugar}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/imprimir/citacion/${c.id}`} target="_blank" rel="noopener" aria-label="Imprimir citación">
                        <PrinterIcon />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant={pasada ? "default" : "outline"}>
                      <Link href={`/expedientes/${c.expediente_id}`}>{pasada ? "Registrar asistencia" : "Abrir"}</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function TablaPorReiterar({ filas }: { filas: CitacionFila[] }) {
  if (!filas.length) {
    return <Vacio titulo="Nada para reiterar" texto="No hay inasistencias pendientes de reiteración." />;
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Citación del</TableHead>
            <TableHead>Trabajador/a</TableHead>
            <TableHead className="w-44">Expediente</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead className="hidden md:table-cell">Inasistencia registrada</TableHead>
            <TableHead className="text-right">
              <span className="sr-only">Acciones</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((c) => (
            <TableRow key={c.id} className="align-top">
              <TableCell>
                <div className="font-medium tabular-nums">{formatoFechaHora(c.fecha_hora)}</div>
                <Etiqueta className={cn("mt-1", TONO.rojo)}>No asistió</Etiqueta>
              </TableCell>
              <TableCell className="font-medium">
                {c.apellido}, {c.nombres}
              </TableCell>
              <TableCell>
                <CeldaExpediente c={c} />
              </TableCell>
              <TableCell>{MOTIVO_CITACION_INFO[c.motivo]}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                {formatoFechaHora(c.resultado_registrado_en)}
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <Button asChild size="sm">
                    <Link href={`/expedientes/${c.expediente_id}`}>
                      <RepeatIcon />
                      Reiterar
                    </Link>
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
