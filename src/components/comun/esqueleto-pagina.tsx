import { Skeleton } from "@/components/ui/skeleton";

/**
 * Esqueleto genérico de las pantallas de la aplicación (bandejas, tablero,
 * Comunicación SRT, Administración, listados y búsqueda) mientras el servidor
 * arma la página. La barra de arriba queda visible y usable.
 */
export function EsqueletoPagina() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-full max-w-48" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-56" />
        <div className="flex flex-col gap-px overflow-hidden rounded-lg ring-1 ring-foreground/10">
          <Skeleton className="h-10 w-full rounded-none" />
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none opacity-60" />
          ))}
        </div>
      </div>
    </div>
  );
}
