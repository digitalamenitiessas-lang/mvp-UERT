import { CircleCheckIcon, CircleDashedIcon, CircleXIcon, FileIcon, ListChecksIcon, PaperclipIcon } from "lucide-react";
import { AdjuntarDocumento } from "@/components/comun/adjuntar-documento";
import { Etiqueta, Simulado } from "@/components/comun/badges";
import { Seccion } from "@/components/comun/pagina";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ExpedienteFicha } from "@/lib/datos/expedientes";
import { TIPO_INFO } from "@/lib/dominio/constantes";
import { AVISO_IN_ITINERE, documentosDeRecepcion, nombreDocumento } from "@/lib/dominio/documentos";
import { formatoFechaHora } from "@/lib/dominio/fechas";
import { formatoTamano, plural } from "@/lib/formato";
import { CLASE, ETAPA_DOCUMENTO, Tarjeta, Vacio } from "./util";

/**
 * Solapa "Documentación": checklist de la recepción y todos los documentos
 * cargados. Cada área que puede sumar documentación en el estado del
 * expediente (Mesa, Médica, Legal, Seguimiento) adjunta desde acá.
 */
export function DocumentacionFicha({ ficha, puedeAdjuntar }: { ficha: ExpedienteFicha; puedeAdjuntar: boolean }) {
  const e = ficha.expediente;
  const exigidos = documentosDeRecepcion(e.tipo);
  const presentados = new Set(ficha.documentos.map((d) => d.tipo));
  const obligatorios = exigidos.filter((d) => d.exigencia === "obligatorio");
  const faltan = obligatorios.filter((d) => !presentados.has(d.clave));
  const vinculado = e.es_reingreso || e.es_intercurrencia;

  return (
    <div className="flex flex-col gap-6">
      <Tarjeta
        titulo="Documentación de la recepción"
        icono={ListChecksIcon}
        descripcion={`Lo que se pide al recibir una denuncia de ${TIPO_INFO[e.tipo].nombre.toLowerCase()}. Obligatorios presentados: ${obligatorios.length - faltan.length} de ${obligatorios.length}.`}
        acciones={
          faltan.length ? (
            <Etiqueta className={CLASE.error}>{plural(faltan.length, "faltante", "faltantes")}</Etiqueta>
          ) : (
            <Etiqueta className={CLASE.ok}>Completa</Etiqueta>
          )
        }
      >
        <ul className="divide-y">
          {exigidos.map((d) => {
            const presentado = presentados.has(d.clave);
            const obligatorio = d.exigencia === "obligatorio";
            return (
              <li key={d.clave} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                {presentado ? (
                  <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-green-600" aria-hidden />
                ) : obligatorio ? (
                  <CircleXIcon className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
                ) : (
                  <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{d.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {obligatorio ? "Obligatorio" : "Si corresponde"}
                    {d.aclaracion ? ` · ${d.aclaracion}` : ""}
                  </p>
                </div>
                <Etiqueta className={presentado ? CLASE.ok : obligatorio ? CLASE.error : CLASE.neutro}>
                  {presentado ? "Presentado" : obligatorio ? "Falta" : "No presentado"}
                </Etiqueta>
              </li>
            );
          })}
        </ul>
        {e.tipo === "IT" ? <p className="mt-3 text-xs text-muted-foreground">{AVISO_IN_ITINERE}</p> : null}
        {vinculado ? (
          <p className="mt-3 text-xs text-muted-foreground">
            En reingresos e intercurrencias la documentación de la recepción está pendiente de definir con la UERT: por
            ahora no se exige para el pase al Área médica.
          </p>
        ) : null}
      </Tarjeta>

      <Seccion
        titulo={`Documentos cargados (${ficha.documentos.length})`}
        descripcion="Todo lo que se adjuntó al expediente, en cada etapa del circuito."
        acciones={
          <span className="flex flex-wrap items-center gap-2">
            <Simulado texto="Archivos no almacenados" />
            {puedeAdjuntar ? (
              <AdjuntarDocumento
                expedienteId={e.id}
                tipoExpediente={e.tipo}
                faltantes={faltan.map((d) => d.clave)}
              />
            ) : null}
          </span>
        }
      >
        {ficha.documentos.length ? (
          <div className="overflow-hidden rounded-lg border bg-background">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Documento</TableHead>
                  <TableHead>Archivo</TableHead>
                  <TableHead className="text-right">Tamaño</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Cargado por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ficha.documentos.map((d) => (
                  <TableRow key={d.id} className="[&>td]:align-top">
                    <TableCell className="min-w-56 whitespace-normal">
                      <span className="font-medium">{nombreDocumento(d.tipo)}</span>
                      {d.observacion ? (
                        <span className="block text-xs text-muted-foreground">{d.observacion}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="max-w-72">
                      {d.nombre_archivo ? (
                        <span className="flex items-center gap-1.5 text-xs" title={d.nombre_archivo}>
                          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="truncate">{d.nombre_archivo}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Presentado en papel</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">{formatoTamano(d.tamano_bytes)}</TableCell>
                    <TableCell className="text-xs">{ETAPA_DOCUMENTO[d.etapa]}</TableCell>
                    <TableCell className="text-xs">
                      <span className="block">{d.cargado_por_nombre ?? "—"}</span>
                      <span className="text-muted-foreground">{formatoFechaHora(d.cargado_en)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Vacio
            icono={PaperclipIcon}
            titulo="Sin documentos"
            descripcion="Todavía no se adjuntó documentación a este expediente."
          />
        )}
        <p className="text-xs text-muted-foreground">
          En la demo se registran el nombre y el tamaño de cada archivo; el archivo en sí no se guarda.
        </p>
      </Seccion>
    </div>
  );
}
