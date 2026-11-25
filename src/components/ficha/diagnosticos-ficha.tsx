import Link from "next/link";
import { CornerDownRightIcon, PrinterIcon, StethoscopeIcon } from "lucide-react";
import { EstadoDiagnosticoBadge, Etiqueta } from "@/components/comun/badges";
import { Seccion } from "@/components/comun/pagina";
import { Button } from "@/components/ui/button";
import type { ExpedienteFicha } from "@/lib/datos/expedientes";
import {
  CODIGO_EXAMEN_INFO,
  MAX_DIAGNOSTICOS_EP,
  MOTIVO_RECHAZO_INFO,
} from "@/lib/dominio/constantes";
import { fechaDe, formatoFecha } from "@/lib/dominio/fechas";
import type { DiagnosticoDetalle } from "@/lib/tipos";
import { CLASE, Codigo, Vacio } from "./util";

/** Situación del diagnóstico en el Sistema de Intercambio (.AD/.AL/.AZ). */
function estadoIntercambio(d: DiagnosticoDetalle): string {
  const lote = d.intercambio_lote_id ? ` (lote ${d.intercambio_lote_id})` : "";
  if (d.estado === "desistido") {
    if (!d.intercambio_lote_id) return "No se informa";
    return d.intercambio_estado === "informado" ? `Baja informada a la SRT${lote}` : `Baja pendiente de informar${lote}`;
  }
  if (d.intercambio_estado === "informado") return `Informado a la SRT${lote}`;
  if (d.intercambio_estado === "modificado") return `Modificado: se vuelve a informar${lote}`;
  return "Sin informar";
}

/** Bloque con título chico dentro de la tarjeta de un diagnóstico. */
function Bloque({ titulo, children, className }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{titulo}</p>
      {children}
    </div>
  );
}

function ListaCodigos({ items }: { items: Array<{ codigo: string; descripcion: string }> }) {
  if (!items.length) return <p className="text-xs text-muted-foreground">—</p>;
  return (
    <ul className="flex flex-col gap-0.5">
      {items.map((it, i) => (
        <li key={`${it.codigo}-${i}`} className="text-xs">
          <Codigo codigo={it.codigo} descripcion={it.descripcion} />
        </li>
      ))}
    </ul>
  );
}

/** Evaluación del Área médica. */
function Evaluacion({ d, esEP }: { d: DiagnosticoDetalle; esEP: boolean }) {
  if (d.estado === "invocado" || !d.evaluado_en) {
    return <p className="text-xs text-muted-foreground">Pendiente de evaluación.</p>;
  }
  return (
    <div className="flex flex-col items-start gap-1.5 text-xs">
      <span className="text-muted-foreground">
        Evaluado el {formatoFecha(fechaDe(d.evaluado_en))}
        {d.fecha_diagnostico ? ` · fecha del diagnóstico: ${formatoFecha(d.fecha_diagnostico)}` : ""}
      </span>
      {(esEP && d.en_listado !== null) || d.patologia_constatada === false ? (
        <span className="flex flex-wrap gap-1.5">
          {esEP && d.en_listado !== null ? (
            <Etiqueta className={d.en_listado ? CLASE.ok : CLASE.aviso}>
              {d.en_listado ? "En el Listado de EP" : "Fuera del Listado (Dto. 658/96)"}
            </Etiqueta>
          ) : null}
          {d.patologia_constatada === false ? <Etiqueta className={CLASE.aviso}>Patología no constatada</Etiqueta> : null}
        </span>
      ) : null}
      {d.observacion_medica ? <p className="whitespace-pre-line">{d.observacion_medica}</p> : null}
    </div>
  );
}

/** Decisión del Área legal (el estado ya lo dice la etiqueta del encabezado). */
function Decision({ d }: { d: DiagnosticoDetalle }) {
  const fecha = d.decidido_en ? `Decidido el ${formatoFecha(fechaDe(d.decidido_en))}.` : null;
  if (d.estado === "aceptado") return <p className="text-xs text-muted-foreground">{fecha ?? "Aceptado."}</p>;
  if (d.estado === "rechazado") {
    const motivo = d.motivo_rechazo ? MOTIVO_RECHAZO_INFO[d.motivo_rechazo] : null;
    return (
      <div className="flex flex-col items-start gap-1.5 text-xs">
        {motivo ? (
          <span className="flex flex-wrap items-center gap-1.5">
            <Etiqueta className={CLASE.error} title={motivo.detalle}>
              Motivo {d.motivo_rechazo}
            </Etiqueta>
            {motivo.nombre}
          </span>
        ) : null}
        {d.fundamento ? <p className="whitespace-pre-line">{d.fundamento}</p> : null}
        {d.estudios ? (
          <p>
            <span className="font-medium">Estudios:</span> {d.estudios}
          </p>
        ) : null}
        {d.cymat_adjunto ? <Etiqueta className={CLASE.neutro}>Relevamiento CYMAT adjunto</Etiqueta> : null}
        {fecha ? <span className="text-muted-foreground">{fecha}</span> : null}
      </div>
    );
  }
  if (d.estado === "desistido") return <p className="text-xs text-muted-foreground">No corresponde: el trámite se desistió.</p>;
  return <p className="text-xs text-muted-foreground">Sin decisión todavía.</p>;
}

function TarjetaDiagnostico({ d, esEP }: { d: DiagnosticoDetalle; esEP: boolean }) {
  const adecuado = d.cie10_adecuado && d.cie10_adecuado !== d.cie10;
  return (
    <li className="overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/30 px-3 py-2.5">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs text-muted-foreground">
            Diagnóstico {d.orden} · {d.origen === "denuncia" ? "invocado en la denuncia" : "agregado en la evaluación"}
          </p>
          <p className="text-sm font-medium">
            <Codigo codigo={d.cie10} descripcion={d.cie10_descripcion} />
          </p>
          {adecuado ? (
            <span className="flex items-start gap-1 text-xs">
              <CornerDownRightIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>
                <span className="text-muted-foreground">Adecuado a </span>
                <Codigo codigo={d.cie10_adecuado} descripcion={d.cie10_adecuado_descripcion} />
              </span>
            </span>
          ) : null}
        </div>
        <EstadoDiagnosticoBadge estado={d.estado} />
      </div>

      <div className="grid gap-x-6 gap-y-4 p-3 sm:grid-cols-2">
        {esEP ? (
          <Bloque titulo="Agente causante" className="sm:col-span-2">
            <Codigo codigo={d.agente_causante} descripcion={d.agente_descripcion} className="text-xs" />
          </Bloque>
        ) : null}
        <Bloque titulo="Lesiones">
          <ListaCodigos items={d.lesiones} />
        </Bloque>
        <Bloque titulo="Zonas del cuerpo">
          <ListaCodigos items={d.zonas} />
        </Bloque>
        <Bloque titulo="Evaluación del Área médica">
          <Evaluacion d={d} esEP={esEP} />
        </Bloque>
        <Bloque titulo="Decisión del Área legal">
          <Decision d={d} />
        </Bloque>
      </div>

      <details className="group border-t px-3 py-2">
        <summary className="w-fit cursor-pointer text-xs font-medium text-primary select-none hover:underline">
          Datos para la SRT
        </summary>
        <dl className="mt-2 grid gap-x-6 gap-y-1.5 pb-1 text-xs sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">N° único de diagnóstico</dt>
            <dd className="font-mono text-sm">{d.numero_unico}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Código de examen</dt>
            <dd>{d.codigo_examen ? `${d.codigo_examen} · ${CODIGO_EXAMEN_INFO[d.codigo_examen]}` : "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Sistema de Intercambio</dt>
            <dd>{estadoIntercambio(d)}</dd>
          </div>
        </dl>
      </details>
    </li>
  );
}

/** Solapa "Diagnósticos": cada diagnóstico con su evaluación y su decisión. */
export function DiagnosticosFicha({ ficha }: { ficha: ExpedienteFicha }) {
  const esEP = ficha.expediente.tipo === "EP";
  const dxs = ficha.diagnosticos;

  if (!dxs.length) {
    return (
      <Vacio
        icono={StethoscopeIcon}
        titulo="Todavía no hay diagnósticos"
        descripcion="El Área médica los agrega y los evalúa (CIE-10, lesiones y zonas del cuerpo) cuando recibe el expediente."
      />
    );
  }

  // La notificación de rechazo se emite al cerrar el dictamen (queda en el historial)
  const hayRechazos =
    dxs.some((d) => d.estado === "rechazado") && ficha.movimientos.some((m) => m.accion === "notificacion_rechazo");

  return (
    <Seccion
      titulo={`Diagnósticos (${dxs.length})`}
      descripcion="Cada diagnóstico tiene estado propio: lo evalúa el Área médica y lo acepta o rechaza el Área legal."
      acciones={
        hayRechazos ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/imprimir/rechazo/${ficha.expediente.id}`} target="_blank" rel="noopener">
              <PrinterIcon />
              Notificación de rechazo
            </Link>
          </Button>
        ) : null
      }
    >
      <ul className="flex flex-col gap-3" aria-label="Diagnósticos del expediente">
        {dxs.map((d) => (
          <TarjetaDiagnostico key={d.id} d={d} esEP={esEP} />
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {esEP
          ? `Hasta ${MAX_DIAGNOSTICOS_EP} diagnósticos por denuncia de EP, cada uno con su agente causante (WS FODEP). `
          : ""}
        El número único de diagnóstico vincula los archivos .AD, .AL y .AZ del Sistema de Intercambio.
      </p>
    </Seccion>
  );
}
