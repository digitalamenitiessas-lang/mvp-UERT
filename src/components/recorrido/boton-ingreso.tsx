"use client";

/**
 * «Ver el recorrido guiado» en /ingresar: entra como Mesa de entrada y arranca
 * el recorrido del circuito (lo retoma el proveedor al llegar a /mesa).
 */
import { useTransition } from "react";
import { RouteIcon } from "lucide-react";
import { ingresar } from "@/app/acciones";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { prepararCircuito } from "./recorrido";

export function BotonRecorridoIngreso({ usuarioMesa }: { usuarioMesa: number }) {
  const [pendiente, iniciar] = useTransition();
  return (
    <Button
      size="lg"
      disabled={pendiente}
      onClick={() => {
        prepararCircuito();
        iniciar(() => ingresar(usuarioMesa));
      }}
      className="w-fit"
    >
      {pendiente ? <Spinner /> : <RouteIcon />}
      {pendiente ? "Preparando el recorrido…" : "Ver el recorrido guiado"}
    </Button>
  );
}
