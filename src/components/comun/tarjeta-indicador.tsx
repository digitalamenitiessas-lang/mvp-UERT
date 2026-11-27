import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tono del indicador. Una sola regla en todas las bandejas y el tablero: el
 * color va en el ícono (con su texto al lado), nunca en el número.
 * `apagado` es para los que están en cero y no requieren nada.
 */
export type TonoIndicador = "neutro" | "critico" | "alerta" | "ok" | "apagado";

const TONO: Record<TonoIndicador, string> = {
  neutro: "bg-primary/10 text-primary",
  critico: "bg-red-50 text-red-700 ring-1 ring-red-600/15",
  alerta: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
  ok: "bg-green-50 text-green-700 ring-1 ring-green-600/15",
  apagado: "bg-muted text-muted-foreground",
};

/**
 * Indicador de una bandeja o del tablero: nombre, número y una línea de
 * contexto. Con `href` (otra página o un ancla de la misma), toda la tarjeta
 * es un link.
 */
export function TarjetaIndicador({
  titulo,
  valor,
  detalle,
  icono: Icono,
  tono = "neutro",
  href,
}: {
  titulo: string;
  valor: number;
  detalle: React.ReactNode;
  icono: LucideIcon;
  tono?: TonoIndicador;
  href?: string;
}) {
  const contenido = (
    <>
      <span className="flex min-h-9 items-start justify-between gap-3">
        <span className="text-sm leading-snug text-muted-foreground">{titulo}</span>
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", TONO[tono])}>
          <Icono className="size-4" aria-hidden />
        </span>
      </span>
      <span className="text-2xl leading-tight font-semibold tracking-tight tabular-nums">
        {valor.toLocaleString("es-AR")}
      </span>
      <span className="text-xs leading-snug text-muted-foreground">{detalle}</span>
    </>
  );
  const clase = "flex h-full min-w-0 flex-col gap-1 rounded-xl bg-background p-3.5 ring-1 ring-foreground/10 sm:p-4";
  if (!href) return <div className={clase}>{contenido}</div>;
  return (
    <Link
      href={href}
      className={cn(
        clase,
        "transition-shadow hover:shadow-md hover:ring-primary/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
      )}
    >
      {contenido}
    </Link>
  );
}

const COLUMNAS = {
  4: "sm:grid-cols-2 xl:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  6: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6",
} as const;

/** La grilla de indicadores, igual en todas las pantallas. */
export function GrillaIndicadores({
  columnas = 4,
  etiqueta = "Indicadores",
  children,
}: {
  columnas?: keyof typeof COLUMNAS;
  etiqueta?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={etiqueta} className={cn("grid grid-cols-1 gap-3", COLUMNAS[columnas])} data-recorrido="indicadores">
      {children}
    </section>
  );
}
