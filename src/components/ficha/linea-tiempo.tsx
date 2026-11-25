import { cn } from "@/lib/utils";

/** Línea de tiempo vertical (presentaciones de la licencia, historial). */
export function LineaTiempo({ children, className }: { children: React.ReactNode; className?: string }) {
  return <ol className={cn("flex flex-col", className)}>{children}</ol>;
}

/**
 * Un hito de la línea de tiempo. `punto` es la clase de color del punto;
 * `hueco` lo dibuja vacío (para lo que todavía no pasó).
 */
export function Hito({
  punto = "bg-primary",
  hueco = false,
  children,
  className,
}: {
  punto?: string;
  hueco?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "relative flex gap-3 pb-6 last:pb-0",
        "before:absolute before:top-4 before:bottom-0 before:left-[5px] before:w-px before:bg-border last:before:hidden",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative mt-1 size-[11px] shrink-0 rounded-full ring-4 ring-card",
          hueco ? "border-2 border-dashed border-muted-foreground/60 bg-card" : punto,
        )}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
