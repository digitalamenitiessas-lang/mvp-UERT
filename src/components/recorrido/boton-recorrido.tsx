"use client";

/** Botón «Recorrido» de la barra: el de esta pantalla o el del circuito completo. */
import { CompassIcon, MonitorIcon, RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRecorrido } from "./recorrido";

export function BotonRecorrido() {
  const recorrido = useRecorrido();
  if (!recorrido) return null;
  const { pantalla, iniciarPantalla, iniciarCircuito } = recorrido;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1.5 text-primary hover:bg-primary/10 hover:text-primary"
          data-recorrido="boton-recorrido"
        >
          <CompassIcon />
          Recorrido
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Te muestro el sistema paso a paso
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="items-start gap-2.5 py-2" disabled={!pantalla} onSelect={iniciarPantalla}>
          <MonitorIcon className="mt-0.5" />
          <span className="flex flex-col">
            <span className="font-medium">Esta pantalla</span>
            <span className="text-xs text-muted-foreground">
              {pantalla ? pantalla.nombre : "Esta pantalla no tiene recorrido"}
            </span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem className="items-start gap-2.5 py-2" onSelect={iniciarCircuito}>
          <RouteIcon className="mt-0.5" />
          <span className="flex flex-col">
            <span className="font-medium">El circuito completo</span>
            <span className="text-xs text-muted-foreground">
              De Mesa de entrada a Dirección, cambiando de rol solo
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
