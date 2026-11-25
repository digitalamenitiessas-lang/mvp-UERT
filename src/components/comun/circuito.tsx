import { CheckIcon, MinusIcon } from "lucide-react";
import { ETAPAS_CIRCUITO, ESTADO_INFO, ROL_INFO, type EstadoExpediente } from "@/lib/dominio/constantes";
import { cn } from "@/lib/utils";

type Paso = "hecho" | "actual" | "pendiente" | "salteado";

/**
 * Estado de cada etapa (Recepción, Área médica, Área legal, Licencia, Cierre).
 * `llegoAMedica` sirve para los desistidos: indica si el trámite pasó por el
 * área médica antes de caducar.
 */
function pasos(estado: EstadoExpediente, llegoAMedica: boolean): Paso[] {
  switch (estado) {
    case "recepcion":
      return ["actual", "pendiente", "pendiente", "pendiente", "pendiente"];
    case "evaluacion_medica":
      return ["hecho", "actual", "pendiente", "pendiente", "pendiente"];
    case "dictamen_legal":
      return ["hecho", "hecho", "actual", "pendiente", "pendiente"];
    case "licencia_activa":
    case "sin_baja":
      return ["hecho", "hecho", "hecho", "actual", "pendiente"];
    case "alta":
    case "cerrado":
      return ["hecho", "hecho", "hecho", "hecho", "hecho"];
    case "rechazado":
      return ["hecho", "hecho", "hecho", "salteado", "hecho"];
    case "desistido":
      return llegoAMedica
        ? ["hecho", "hecho", "salteado", "salteado", "hecho"]
        : ["hecho", "salteado", "salteado", "salteado", "hecho"];
  }
}

/** Indicador visual del circuito del expediente. */
export function Circuito({ estado, llegoAMedica = false }: { estado: EstadoExpediente; llegoAMedica?: boolean }) {
  const estados = pasos(estado, llegoAMedica);
  return (
    <ol className="flex w-full items-center gap-1 overflow-x-auto text-xs" aria-label="Etapa del circuito">
      {ETAPAS_CIRCUITO.map((etapa, i) => {
        const paso = estados[i];
        const nombre = i === 4 && !ESTADO_INFO[estado].abierto ? ESTADO_INFO[estado].nombre : etapa.nombre;
        return (
          <li key={etapa.clave} className="flex min-w-24 flex-1">
            <span
              aria-current={paso === "actual" ? "step" : undefined}
              className={cn(
                "flex w-full min-w-0 items-center gap-1.5 rounded-md border px-2 py-1.5",
                paso === "hecho" && "border-transparent bg-primary/10 text-primary",
                paso === "actual" && "border-primary bg-background font-medium text-foreground shadow-sm",
                paso === "pendiente" && "border-dashed text-muted-foreground",
                paso === "salteado" && "border-dashed text-muted-foreground/50 line-through",
              )}
            >
              {paso === "hecho" ? <CheckIcon className="size-3.5 shrink-0" /> : null}
              {paso === "salteado" ? <MinusIcon className="size-3.5 shrink-0" /> : null}
              {paso === "actual" && etapa.rol ? (
                <span className={cn("size-2 shrink-0 rounded-full", ROL_INFO[etapa.rol].punto)} />
              ) : null}
              <span className="truncate">{nombre}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
