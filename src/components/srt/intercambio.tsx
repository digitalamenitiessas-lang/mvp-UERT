import { DownloadIcon, FileTextIcon, PackageIcon } from "lucide-react";
import { Etiqueta } from "@/components/comun/badges";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { plural } from "@/lib/formato";
import { conBase } from "@/lib/rutas";
import { desarmarLinea, type CampoLayout } from "@/lib/srt/intercambio";
import type { LoteIntercambio } from "@/lib/tipos";

/** Qué contiene cada archivo nuevo del Sistema de Intercambio. */
export const ARCHIVO_INFO: Record<string, { nombre: string; contenido: string }> = {
  AD: { nombre: "Diagnósticos", contenido: "Un registro por diagnóstico" },
  AL: { nombre: "Lesiones", contenido: "Un registro por lesión de cada diagnóstico" },
  AZ: { nombre: "Zonas del cuerpo", contenido: "Un registro por zona del cuerpo de cada diagnóstico" },
};

/** Diseño de registro de un archivo de ancho fijo. */
export function TablaLayout({ layout }: { layout: CampoLayout[] }) {
  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-10 text-right">N°</TableHead>
            <TableHead>Campo</TableHead>
            <TableHead className="text-right">Posiciones</TableHead>
            <TableHead className="text-right">Largo</TableHead>
            <TableHead>Obligatorio</TableHead>
            <TableHead>Observación</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {layout.map((c) => (
            <TableRow key={c.pos}>
              <TableCell className="text-right text-muted-foreground tabular-nums">{c.pos}</TableCell>
              <TableCell className="font-medium whitespace-normal">{c.campo}</TableCell>
              <TableCell className="text-right font-mono text-xs tabular-nums">
                {c.desde === c.hasta ? c.desde : `${c.desde}–${c.hasta}`}
              </TableCell>
              <TableCell className="text-right tabular-nums">{c.hasta - c.desde + 1}</TableCell>
              <TableCell>
                {c.obligatorio === "SI" ? (
                  <span className="text-sm">Sí</span>
                ) : (
                  <Etiqueta className="bg-amber-50 text-amber-800 ring-amber-600/20">Condicional</Etiqueta>
                )}
              </TableCell>
              <TableCell className="min-w-48 text-sm whitespace-normal text-muted-foreground">
                {c.observacion ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Un registro real de un lote, separado campo por campo según el layout. */
export function EjemploRegistro({ linea, layout, origen }: { linea: string; layout: CampoLayout[]; origen: string }) {
  const campos = desarmarLinea(linea, layout);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{origen}</p>
      <pre className="overflow-x-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">{linea}</pre>
      <div className="max-w-2xl overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead>Campo</TableHead>
              <TableHead>Valor en el archivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campos.map((c, i) => (
              <TableRow key={i}>
                <TableCell className="text-sm whitespace-normal">{c.campo}</TableCell>
                <TableCell>
                  {c.valor.trim() ? (
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs whitespace-pre">{c.valor}</code>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {c.valor.length} {c.valor.length === 1 ? "espacio" : "espacios"} (vacío)
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/** Un lote generado: sus tres archivos, con descarga y vista del contenido. */
export function TarjetaLote({ lote }: { lote: LoteIntercambio & { generado_por_nombre: string | null } }) {
  return (
    <Card className="bg-background">
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <PackageIcon className="size-4 text-muted-foreground" aria-hidden />
          Lote {lote.id}
        </CardTitle>
        <CardDescription>
          {formatoFechaHora(lote.generado_en)}
          {lote.generado_por_nombre ? ` · ${lote.generado_por_nombre}` : ""}
        </CardDescription>
        <CardAction>
          <Etiqueta className="bg-zinc-50 text-zinc-700 ring-zinc-500/20">{plural(lote.registros, "registro")}</Etiqueta>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {lote.archivos.map((a) => {
          const info = ARCHIVO_INFO[a.extension];
          return (
            <div key={a.extension} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <FileTextIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="font-mono text-sm font-medium">{a.nombre}</span>
                <span className="text-sm text-muted-foreground">
                  {info?.nombre ?? a.extension} · {plural(a.registros, "registro")}
                </span>
                <a
                  href={conBase(`/api/intercambio/${lote.id}/${a.extension}`)}
                  download={a.nombre}
                  className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-medium text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  aria-label={`Descargar ${a.nombre}`}
                >
                  <DownloadIcon className="size-3.5" aria-hidden />
                  Descargar
                </a>
              </div>
              {a.registros > 0 ? (
                <details className="pl-6">
                  <summary className="w-fit cursor-pointer text-xs font-medium text-primary select-none hover:underline">
                    Ver contenido
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed">
                    {a.contenido.replace(/\r\n$/, "")}
                  </pre>
                </details>
              ) : (
                <p className="pl-6 text-xs text-muted-foreground">Archivo vacío: no hubo registros de este tipo.</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
