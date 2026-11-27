import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Encabezado de página: título, descripción y acciones a la derecha. */
export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  volver,
  children,
  recorrido = "encabezado",
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  volver?: { href: string; texto: string };
  children?: React.ReactNode;
  /** Marca para el recorrido guiado (data-recorrido). */
  recorrido?: string;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3" data-recorrido={recorrido}>
      {volver ? (
        <Link
          href={volver.href}
          className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          {volver.texto}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h1>
          {descripcion ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{descripcion}</p> : null}
        </div>
        {acciones ? (
          <div className="flex flex-wrap items-center gap-2" data-recorrido="acciones-pagina">
            {acciones}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Sección con título dentro de una página. */
export function Seccion({
  titulo,
  descripcion,
  acciones,
  children,
  className,
  recorrido,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  acciones?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Marca para el recorrido guiado (data-recorrido). */
  recorrido?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)} data-recorrido={recorrido}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{titulo}</h2>
          {descripcion ? <p className="text-sm text-muted-foreground">{descripcion}</p> : null}
        </div>
        {acciones}
      </div>
      {children}
    </section>
  );
}

/** Par etiqueta/valor para fichas. */
export function Dato({ etiqueta, children, className }: { etiqueta: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5", className)}>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="text-sm break-words">{children ?? "—"}</dd>
    </div>
  );
}

export function Datos({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3", className)}>{children}</dl>;
}
