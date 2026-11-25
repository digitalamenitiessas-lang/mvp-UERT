import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto de la ficha mientras se leen los datos del expediente. */
export default function CargandoExpediente() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el expediente…</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-8 w-52" />
        </div>
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-6 w-72" />
        <Skeleton className="h-4 w-full max-w-xl" />
        <div className="flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 flex-1" />
            ))}
          </div>
          <Skeleton className="h-5 w-80 max-w-full" />
          <div className="grid gap-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex flex-col gap-4 lg:col-start-2 lg:row-start-1">
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-8 w-full max-w-2xl rounded-lg" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
