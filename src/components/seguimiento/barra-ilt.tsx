import { Progress } from "@/components/ui/progress";
import { PLAZOS } from "@/lib/dominio/constantes";
import { formatoFecha, type NivelPlazo } from "@/lib/dominio/fechas";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { CLASE_BARRA_NIVEL, type ResumenIlt } from "./ilt";

/**
 * Días de ILT para una celda de tabla: los días de licencia y una barrita con
 * lo que pasó del año de tope (N/365), coloreada según la urgencia.
 */
export function BarraIlt({
  ilt,
  nivel = "en_termino",
  className,
}: {
  ilt: ResumenIlt;
  nivel?: NivelPlazo;
  className?: string;
}) {
  if (ilt.transcurridos === null || ilt.dias === null) return <span className="text-muted-foreground">—</span>;
  const detalle = `${plural(ilt.dias, "día")} de licencia desde el ${formatoFecha(ilt.inicio)}. Pasaron ${ilt.transcurridos} de los ${PLAZOS.topeIltDias} días del tope, que se cumple el ${formatoFecha(ilt.tope)}.`;
  return (
    <div className={cn("flex w-36 flex-col gap-1.5", className)} title={detalle}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium tabular-nums">{plural(ilt.dias, "día")}</span>
        <span
          className={cn(
            "text-xs tabular-nums",
            nivel === "en_termino" ? "text-muted-foreground" : "font-medium",
            nivel === "vencido" && "text-red-700",
            nivel === "hoy" && "text-orange-700",
            nivel === "proximo" && "text-amber-700",
          )}
        >
          {ilt.transcurridos}/{PLAZOS.topeIltDias}
        </span>
      </div>
      <Progress value={ilt.porcentaje} aria-label={detalle} className={cn("h-1.5", CLASE_BARRA_NIVEL[nivel])} />
    </div>
  );
}
