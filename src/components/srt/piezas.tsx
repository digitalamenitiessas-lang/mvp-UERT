import Link from "next/link";
import { CheckIcon, XIcon } from "lucide-react";
import { Etiqueta } from "@/components/comun/badges";
import { jsonLegible } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { CANAL_SRT, type CanalSrt } from "./canales";

/** Canal de la comunicación (WS FODEP, e-Servicios, Ventanilla, Intercambio). */
export function CanalBadge({ canal, largo = false }: { canal: CanalSrt; largo?: boolean }) {
  const info = CANAL_SRT[canal];
  return (
    <Etiqueta className={info.badge} title={info.descripcion}>
      {largo ? info.nombre : info.corto}
    </Etiqueta>
  );
}

/** Resultado de una comunicación: OK o el código de error que devolvió la SRT. */
export function ResultadoSrt({
  ok,
  codigo,
  mensaje,
}: {
  ok: boolean;
  codigo?: string | null;
  mensaje?: string | null;
}) {
  if (ok) {
    return (
      <Etiqueta className="bg-green-50 text-green-800 ring-green-600/20">
        <CheckIcon className="size-3" aria-hidden />
        OK
      </Etiqueta>
    );
  }
  return (
    <Etiqueta className="bg-red-50 text-red-800 ring-red-600/20" title={mensaje ?? undefined}>
      <XIcon className="size-3" aria-hidden />
      {codigo ? `Error ${codigo}` : "Error"}
    </Etiqueta>
  );
}

/** Número de expediente con link a la ficha y nombre del trabajador. */
export function ExpedienteRef({
  id,
  numero,
  apellido,
  nombres,
  className,
}: {
  id: number | null;
  numero: string | null;
  apellido?: string | null;
  nombres?: string | null;
  className?: string;
}) {
  if (!id || !numero) return <span className={cn("text-sm text-muted-foreground", className)}>Sin expediente</span>;
  return (
    <span className={cn("flex min-w-0 flex-col", className)}>
      <Link href={`/expedientes/${id}`} className="w-fit font-mono text-sm font-medium text-primary hover:underline">
        {numero}
      </Link>
      {apellido ? (
        <span className="truncate text-xs text-muted-foreground">
          {apellido}
          {nombres ? `, ${nombres}` : ""}
        </span>
      ) : null}
    </span>
  );
}

/** Bloque de JSON (request o response simulados) legible y con scroll propio. */
export function BloqueJson({ titulo, valor }: { titulo: string; valor: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
      {valor === null || valor === undefined ? (
        <span className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">Sin contenido</span>
      ) : (
        <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap">
          {jsonLegible(valor)}
        </pre>
      )}
    </div>
  );
}

/** Desplegable nativo con el request y el response de una comunicación. */
export function DetalleRequestResponse({
  request,
  response,
  resumen = "Ver request y response",
  children,
}: {
  request: unknown;
  response: unknown;
  resumen?: string;
  children?: React.ReactNode;
}) {
  return (
    <details className="group/detalle mt-2">
      <summary className="inline-flex cursor-pointer items-center gap-1 rounded-sm text-xs font-medium text-primary select-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
        {resumen}
      </summary>
      <div className="mt-2 flex flex-col gap-3">
        {children}
        <div className="grid gap-3 lg:grid-cols-2">
          <BloqueJson titulo="Request" valor={request} />
          <BloqueJson titulo="Response" valor={response} />
        </div>
      </div>
    </details>
  );
}
