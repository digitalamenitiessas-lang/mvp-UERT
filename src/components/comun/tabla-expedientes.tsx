import Link from "next/link";
import { getDb } from "@/lib/db";
import { plazoMasUrgente, plazosDe, type ExpedienteFila } from "@/lib/datos/expedientes";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { formatoCuil } from "@/lib/dominio/validaciones";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EstadoBadge, Etiqueta, PlazoBadge, TipoBadge } from "./badges";

export interface ColumnaExtra {
  titulo: string;
  celda: (fila: ExpedienteFila) => React.ReactNode;
  className?: string;
}

/**
 * Tabla de expedientes para bandejas y listados (componente de servidor).
 * Calcula el plazo más urgente de cada fila.
 */
export async function TablaExpedientes({
  filas,
  vacio = "No hay expedientes para mostrar.",
  columnas,
  ocultar = [],
}: {
  filas: ExpedienteFila[];
  vacio?: string;
  /** Columnas adicionales, antes de "Última novedad". */
  columnas?: ColumnaExtra[];
  ocultar?: Array<"estado" | "plazo" | "novedad" | "reparticion">;
}) {
  if (!filas.length) {
    return (
      <Empty className="rounded-lg border border-dashed bg-background py-8">
        <EmptyHeader>
          <EmptyTitle className="text-sm">Nada por acá</EmptyTitle>
          <EmptyDescription>{vacio}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const feriados = await cargarFeriados(await getDb());
  const ahora = new Date();
  const ver = (c: string) => !ocultar.includes(c as never);
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-44">Expediente</TableHead>
            <TableHead>Trabajador/a</TableHead>
            {ver("reparticion") ? <TableHead className="hidden lg:table-cell">Repartición</TableHead> : null}
            {ver("estado") ? <TableHead>Estado</TableHead> : null}
            {ver("plazo") ? <TableHead>Plazo</TableHead> : null}
            {columnas?.map((c) => (
              <TableHead key={c.titulo} className={c.className}>
                {c.titulo}
              </TableHead>
            ))}
            {ver("novedad") ? <TableHead className="hidden xl:table-cell">Última novedad</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filas.map((f) => {
            const plazo = plazoMasUrgente(plazosDe(f, ahora, feriados));
            return (
              <TableRow key={f.id} className="align-top">
                <TableCell>
                  <Link href={`/expedientes/${f.id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                    {f.numero}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <TipoBadge tipo={f.tipo} />
                    {f.es_reingreso ? <Etiqueta className="bg-zinc-50 text-zinc-700 ring-zinc-500/20">Reingreso</Etiqueta> : null}
                    {f.es_intercurrencia ? (
                      <Etiqueta className="bg-zinc-50 text-zinc-700 ring-zinc-500/20">Intercurrencia</Etiqueta>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {f.apellido}, {f.nombres}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">CUIL {formatoCuil(f.cuil)}</div>
                </TableCell>
                {ver("reparticion") ? (
                  <TableCell className="hidden max-w-64 text-sm whitespace-normal text-muted-foreground lg:table-cell">
                    {f.reparticion}
                  </TableCell>
                ) : null}
                {ver("estado") ? (
                  <TableCell>
                    <EstadoBadge estado={f.estado} />
                  </TableCell>
                ) : null}
                {ver("plazo") ? (
                  <TableCell>{plazo ? <PlazoBadge plazo={plazo} nombre={plazo.nombre} /> : <span className="text-muted-foreground">—</span>}</TableCell>
                ) : null}
                {columnas?.map((c) => (
                  <TableCell key={c.titulo} className={c.className}>
                    {c.celda(f)}
                  </TableCell>
                ))}
                {ver("novedad") ? (
                  <TableCell className="hidden max-w-80 text-xs whitespace-normal text-muted-foreground xl:table-cell">
                    {f.ultima_novedad ? (
                      <>
                        <span className="block text-foreground/80">{f.ultima_novedad_detalle}</span>
                        <span>{formatoFechaHora(f.ultima_novedad)}</span>
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
