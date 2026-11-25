"use client";

import { useState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { accionReiniciarDemo } from "@/app/acciones";
import { ErrorAccion } from "@/components/comun/error-accion";
import { useAccion } from "@/components/comun/use-accion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/**
 * Vuelve a armar los datos de la demo. Pide confirmación porque se pierde
 * todo lo que se cargó durante la presentación.
 */
export function ReiniciarDemo({ expedientes }: { expedientes: number }) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  return (
    <AlertDialog
      open={abierto}
      onOpenChange={(a) => {
        if (pendiente) return;
        setAbierto(a);
        if (!a) limpiarError();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          <RotateCcwIcon />
          Reiniciar la demo
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <RotateCcwIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Reiniciar los datos de la demo?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borra todo lo que se cargó o se cambió (hoy hay {expedientes}{" "}
            {expedientes === 1 ? "expediente" : "expedientes"}) y se vuelven a armar los 20 expedientes de ejemplo con
            fechas relativas a hoy: plazos por vencer, citaciones, licencias, rechazos y desistidos. También se regeneran
            las comunicaciones con la SRT, los lotes de intercambio y los siniestros del sistema actual. No se puede
            deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ErrorAccion error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={pendiente}
            onClick={() => ejecutar(() => accionReiniciarDemo(), { alTerminar: () => setAbierto(false) })}
          >
            {pendiente ? <Spinner /> : <RotateCcwIcon />}
            {pendiente ? "Reiniciando…" : "Reiniciar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
