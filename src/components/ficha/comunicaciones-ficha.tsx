import { Fragment } from "react";
import { FileCodeIcon, InfoIcon, SendIcon, TriangleAlertIcon } from "lucide-react";
import { Etiqueta, Simulado } from "@/components/comun/badges";
import { Seccion } from "@/components/comun/pagina";
import { CanalBadge, ResultadoSrt } from "@/components/srt/piezas";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExpedienteFicha } from "@/lib/datos/expedientes";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { jsonLegible, plural } from "@/lib/formato";
import type { VistaIntercambio } from "@/lib/operaciones";
import {
  desarmarLinea,
  LARGO,
  LAYOUT_AD,
  LAYOUT_AL,
  LAYOUT_AZ,
  type ArchivoIntercambio,
  type CampoLayout,
  type ExtensionNueva,
} from "@/lib/srt/intercambio";
import { cn } from "@/lib/utils";
import { CLASE, Vacio } from "./util";

const ARCHIVOS: Record<ExtensionNueva, { layout: CampoLayout[]; contenido: string; vacio: string }> = {
  AD: {
    layout: LAYOUT_AD,
    contenido: "Diagnósticos",
    vacio: "Sin diagnósticos para informar.",
  },
  AL: {
    layout: LAYOUT_AL,
    contenido: "Lesiones de cada diagnóstico",
    vacio: "Sin registros: ningún diagnóstico tiene lesiones cargadas (en EP la lesión no es obligatoria).",
  },
  AZ: {
    layout: LAYOUT_AZ,
    contenido: "Zonas del cuerpo de cada diagnóstico",
    vacio: "Sin registros: ningún diagnóstico tiene zonas del cuerpo cargadas.",
  },
};

/** Colores alternados para ubicar cada campo dentro de la línea de ancho fijo. */
const COLOR_CAMPO = ["bg-sky-100 text-sky-950", "bg-amber-100 text-amber-950"];

function Mensaje({ titulo, valor }: { titulo: string; valor: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      {valor === null || valor === undefined ? (
        <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">Sin contenido</p>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
          {jsonLegible(valor)}
        </pre>
      )}
    </div>
  );
}

function LineaArchivo({ numero, linea, layout }: { numero: number; linea: string; layout: CampoLayout[] }) {
  const campos = desarmarLinea(linea, layout);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">
        Línea {numero} · {linea.length} posiciones
      </p>
      <div className="overflow-x-auto rounded-md border bg-muted/30 px-3 py-2">
        <code className="font-mono text-xs whitespace-pre" aria-label={`Contenido de la línea ${numero}`}>
          {campos.map((c, j) => (
            <span
              key={j}
              title={`${layout[j].pos}. ${c.campo} (posiciones ${layout[j].desde} a ${layout[j].hasta})`}
              className={COLOR_CAMPO[j % 2]}
            >
              {c.valor}
            </span>
          ))}
        </code>
      </div>
      <div className="overflow-hidden rounded-md border bg-background">
        <Table className="text-xs">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="h-8 w-10">#</TableHead>
              <TableHead className="h-8">Campo</TableHead>
              <TableHead className="h-8">Posiciones</TableHead>
              <TableHead className="h-8">Valor</TableHead>
              <TableHead className="h-8">Obligatorio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campos.map((c, j) => {
              const def = layout[j];
              const vacio = c.valor.trim() === "";
              return (
                <TableRow key={j}>
                  <TableCell className="py-1.5">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span aria-hidden className={cn("size-2.5 rounded-sm", COLOR_CAMPO[j % 2])} />
                      {def.pos}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-44 py-1.5 whitespace-normal">
                    {c.campo}
                    {def.observacion ? (
                      <span className="block text-[11px] text-muted-foreground">{def.observacion}</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="py-1.5 tabular-nums text-muted-foreground">
                    {def.desde === def.hasta ? def.desde : `${def.desde} a ${def.hasta}`}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <code className="rounded bg-muted px-1 py-0.5 font-mono whitespace-pre">{c.valor}</code>
                    {vacio ? <span className="ml-1.5 text-muted-foreground">(vacío)</span> : null}
                  </TableCell>
                  <TableCell className="py-1.5">{def.obligatorio === "SI" ? "Sí" : "Condicional"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function VistaArchivo({ archivo }: { archivo: ArchivoIntercambio }) {
  const def = ARCHIVOS[archivo.extension];
  const lineas = archivo.contenido.split(/\r?\n/).filter((l) => l.length > 0);
  return (
    <Card size="sm">
      <CardHeader className="border-b">
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FileCodeIcon className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-mono">{archivo.nombre}</span>
          <Etiqueta className={CLASE.neutro}>.{archivo.extension}</Etiqueta>
        </CardTitle>
        <CardDescription>
          {def.contenido} · {LARGO[archivo.extension]} posiciones por línea · {plural(archivo.registros, "registro", "registros")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {lineas.length ? (
          lineas.map((linea, i) => <LineaArchivo key={i} numero={i + 1} linea={linea} layout={def.layout} />)
        ) : (
          <p className="text-sm text-muted-foreground">{def.vacio}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Solapa "Comunicaciones SRT": mensajes simulados con la SRT y archivos del Sistema de Intercambio. */
export function ComunicacionesFicha({ ficha, intercambio }: { ficha: ExpedienteFicha; intercambio: VistaIntercambio }) {
  const comunicaciones = ficha.comunicaciones;
  const errores = comunicaciones.filter((c) => !c.ok).length;

  return (
    <div className="flex flex-col gap-8">
      <Seccion
        titulo={`Comunicaciones con la SRT (${comunicaciones.length})`}
        descripcion="Web Service FODEP, notificaciones al trabajador (e-Servicios) y al empleador (Ventanilla Electrónica). Se arma el mismo mensaje que se enviaría y se valida con las reglas publicadas por la SRT."
        acciones={
          <span className="flex items-center gap-2">
            {errores ? <Etiqueta className={CLASE.error}>{plural(errores, "error", "errores")}</Etiqueta> : null}
            <Simulado />
          </span>
        }
      >
        {comunicaciones.length ? (
          <div className="overflow-hidden rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Operación</TableHead>
                  <TableHead>Resultado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comunicaciones.map((c) => (
                  <Fragment key={c.id}>
                    <TableRow className="border-b-0 hover:bg-transparent [&>td]:align-top">
                      <TableCell className="text-xs tabular-nums">{formatoFechaHora(c.fecha)}</TableCell>
                      <TableCell>
                        <CanalBadge canal={c.canal} />
                      </TableCell>
                      <TableCell className="min-w-48 font-medium whitespace-normal">{c.operacion}</TableCell>
                      <TableCell className="min-w-40 whitespace-normal">
                        <div className="flex flex-col items-start gap-1">
                          <ResultadoSrt ok={c.ok} codigo={c.error_codigo} mensaje={c.error_mensaje} />
                          {!c.ok && c.error_mensaje ? <span className="text-xs text-red-800">{c.error_mensaje}</span> : null}
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={4} className="pt-0 whitespace-normal">
                        {/* w-0 + min-w-full: el JSON no ensancha la tabla, se desplaza dentro de su caja */}
                        <div className="w-0 min-w-full">
                          <details className="group">
                            <summary className="w-fit cursor-pointer text-xs text-primary select-none hover:underline">
                              Ver el mensaje enviado y la respuesta
                            </summary>
                            <div className="mt-2 grid gap-3 lg:grid-cols-2">
                              <Mensaje titulo="Enviado (request)" valor={c.request} />
                              <Mensaje titulo="Respuesta (response)" valor={c.response} />
                            </div>
                          </details>
                        </div>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Vacio
            icono={SendIcon}
            titulo="Sin comunicaciones"
            descripcion="Todavía no hubo comunicaciones con la SRT ni notificaciones por este expediente."
          />
        )}
      </Seccion>

      <Seccion
        titulo="Archivos de intercambio (.AD, .AL, .AZ)"
        descripcion="Vista previa de lo que se informa a la SRT por este expediente, con el estado actual de sus diagnósticos."
        acciones={<Simulado />}
      >
        <Alert>
          <InfoIcon />
          <AlertTitle>Con FODEP cambian los archivos del Sistema de Intercambio</AlertTitle>
          <AlertDescription>
            Los campos de diagnóstico, lesión y zona del cuerpo de los archivos .AT y .EF van vacíos: esa información viaja
            en tres archivos nuevos de ancho fijo (.AD, .AL y .AZ), vinculados por el número único de diagnóstico. Tipo de
            operación: A = alta, B = baja, M = modificación.
          </AlertDescription>
        </Alert>
        {intercambio.error ? (
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>Hay diagnósticos que el archivo no admite</AlertTitle>
            <AlertDescription>
              <p>{intercambio.error}</p>
              <p>Quedan fuera de los lotes hasta que se corrijan; el resto se informa igual.</p>
            </AlertDescription>
          </Alert>
        ) : null}
        {intercambio.registros.length ? (
          intercambio.archivos.map((a) => <VistaArchivo key={a.extension} archivo={a} />)
        ) : (
          <Vacio
            icono={FileCodeIcon}
            titulo="Sin diagnósticos para informar"
            descripcion="Los archivos se arman con los diagnósticos que el Área médica ya evaluó, con sus zonas del cuerpo (y, en accidentes, sus lesiones)."
          />
        )}
      </Seccion>
    </div>
  );
}
