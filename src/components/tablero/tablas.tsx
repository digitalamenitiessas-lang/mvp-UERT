import Link from "next/link";
import { CircleCheckIcon, InboxIcon } from "lucide-react";
import { Etiqueta, PlazoBadge, RolBadge, TipoBadge } from "@/components/comun/badges";
import { campoTexto } from "@/components/srt/canales";
import { CanalBadge, ResultadoSrt } from "@/components/srt/piezas";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ComunicacionFila } from "@/lib/datos/srt";
import type { Tablero } from "@/lib/datos/tablero";
import { ESTADO_INFO } from "@/lib/dominio/constantes";
import { formatoFecha, formatoFechaHora } from "@/lib/dominio/fechas";
import { formatoCuil } from "@/lib/dominio/validaciones";

/** Plazos vencidos, que vencen hoy o en los próximos días, con el área que tiene que actuar. */
export function TablaVencimientos({ vencimientos }: { vencimientos: Tablero["vencimientos"] }) {
  if (!vencimientos.length) {
    return (
      <Empty className="rounded-lg border border-dashed bg-background py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon" className="bg-green-50 text-green-700">
            <CircleCheckIcon />
          </EmptyMedia>
          <EmptyTitle>Todo en término</EmptyTitle>
          <EmptyDescription>No hay plazos vencidos ni por vencer en los próximos días.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-44">Expediente</TableHead>
            <TableHead>Trabajador/a</TableHead>
            <TableHead>Plazo</TableHead>
            <TableHead className="hidden md:table-cell">Vence</TableHead>
            <TableHead>Área responsable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vencimientos.map(({ expediente: e, plazo }) => {
            const area = ESTADO_INFO[e.estado].area;
            return (
              <TableRow key={`${e.id}-${plazo.clave}`} className="align-top">
                <TableCell>
                  <Link href={`/expedientes/${e.id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                    {e.numero}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <TipoBadge tipo={e.tipo} />
                    {e.es_reingreso ? <Etiqueta className="bg-zinc-50 text-zinc-700 ring-zinc-500/20">Reingreso</Etiqueta> : null}
                    {e.es_intercurrencia ? (
                      <Etiqueta className="bg-zinc-50 text-zinc-700 ring-zinc-500/20">Intercurrencia</Etiqueta>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {e.apellido}, {e.nombres}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">CUIL {formatoCuil(e.cuil)}</div>
                </TableCell>
                <TableCell>
                  <PlazoBadge plazo={plazo} nombre={plazo.nombre} />
                </TableCell>
                <TableCell className="hidden text-sm tabular-nums md:table-cell">{formatoFecha(plazo.vence)}</TableCell>
                <TableCell>{area ? <RolBadge rol={area} /> : <span className="text-muted-foreground">—</span>}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/** Últimas comunicaciones con la SRT (todas simuladas). */
export function TablaUltimasComunicaciones({ filas }: { filas: ComunicacionFila[] }) {
  if (!filas.length) {
    return (
      <Empty className="rounded-lg border border-dashed bg-background py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <InboxIcon />
          </EmptyMedia>
          <EmptyTitle>Sin comunicaciones</EmptyTitle>
          <EmptyDescription>Todavía no se informó nada a la SRT.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-36">Fecha</TableHead>
            <TableHead>Canal</TableHead>
            <TableHead>Operación</TableHead>
            <TableHead>Expediente</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((c) => {
            const asunto = campoTexto(c.request, "Asunto");
            return (
              <TableRow key={c.id} className="align-top">
                <TableCell className="text-sm text-muted-foreground tabular-nums">{formatoFechaHora(c.fecha)}</TableCell>
                <TableCell>
                  <CanalBadge canal={c.canal} />
                </TableCell>
                <TableCell className="max-w-96 whitespace-normal">
                  <div className="text-sm">{c.operacion}</div>
                  {asunto ? <div className="line-clamp-1 text-xs text-muted-foreground">{asunto}</div> : null}
                </TableCell>
                <TableCell>
                  {c.expediente_id && c.numero ? (
                    <Link
                      href={`/expedientes/${c.expediente_id}`}
                      className="font-mono text-sm font-medium text-primary hover:underline"
                    >
                      {c.numero}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                  {c.apellido ? <div className="text-xs text-muted-foreground">{c.apellido}</div> : null}
                </TableCell>
                <TableCell>
                  <ResultadoSrt ok={c.ok} codigo={c.error_codigo} mensaje={c.error_mensaje} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
