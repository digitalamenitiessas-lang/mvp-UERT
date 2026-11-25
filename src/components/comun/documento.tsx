/**
 * Piezas comunes de los documentos que se imprimen (constancia de recepción,
 * citación y notificación de rechazo): la misma hoja, el mismo membrete, la
 * misma barra de pantalla y la misma leyenda de demostración al pie.
 */
import Link from "next/link";
import { ArrowLeftIcon, ShieldCheckIcon } from "lucide-react";
import { BotonImprimir } from "@/components/comun/boton-imprimir";
import { UERT } from "@/lib/dominio/constantes";
import { cn } from "@/lib/utils";

/** Leyenda fija al pie de cada documento (reemplaza a las etiquetas «Simulado» en papel). */
export const LEYENDA_DEMO =
  "Documento de demostración: los datos son ficticios y los envíos a la SRT, al trabajador y al empleador, simulados.";

/** Hoja A4: en pantalla, centrada y con el ancho de la hoja; al imprimir, la página entera. */
export function Hoja({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="mx-auto max-w-[210mm] px-4 py-6 sm:px-8 print:max-w-none print:p-0">
      <article className={cn("flex flex-col gap-6 text-[13px] leading-relaxed text-zinc-900", className)}>
        {children}
      </article>
    </div>
  );
}

/** Barra de pantalla (no se imprime): volver al expediente e imprimir. */
export function BarraImpresion({
  expedienteId,
  textoBoton = "Imprimir",
  imprimible = true,
  children,
}: {
  expedienteId: number;
  textoBoton?: string;
  /** Sin nada para imprimir, la barra queda solo con «Volver». */
  imprimible?: boolean;
  /** Datos extra a la izquierda del botón (por ejemplo, el resultado de una citación). */
  children?: React.ReactNode;
}) {
  return (
    <div className="no-imprimir mx-auto max-w-[210mm] px-4 pt-6 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5">
        <Link
          href={`/expedientes/${expedienteId}`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-950"
        >
          <ArrowLeftIcon className="size-3.5" />
          Volver al expediente
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          {children}
          {imprimible ? (
            <>
              <span className="hidden text-xs text-zinc-500 md:inline">
                Para obtener el PDF, elegí «Guardar como PDF» al imprimir.
              </span>
              <BotonImprimir texto={textoBoton} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Membrete de la UERT con el área que emite; a la derecha, el título y la referencia del documento. */
export function Membrete({ area, children }: { area: string; children: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-zinc-900 pb-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-zinc-900">
          <ShieldCheckIcon className="size-6" aria-hidden />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] tracking-wide text-zinc-600 uppercase">Provincia de {UERT.provincia}</p>
          <p className="text-base font-semibold">{UERT.nombre}</p>
          <p className="text-xs text-zinc-600">
            {UERT.sigla} · {area}
          </p>
        </div>
      </div>
      <div className="text-right leading-tight">{children}</div>
    </header>
  );
}

/** Pie del documento: lo propio de cada uno y la leyenda de demostración. */
export function PieDocumento({ children }: { children?: React.ReactNode }) {
  return (
    <footer className="space-y-1 border-t border-zinc-300 pt-3 text-[11px] leading-snug text-zinc-500">
      {children ? <p>{children}</p> : null}
      <p>{LEYENDA_DEMO}</p>
    </footer>
  );
}
