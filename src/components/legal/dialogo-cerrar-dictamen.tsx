"use client";

import { useState } from "react";
import { StampIcon } from "lucide-react";
import { accionCerrarDictamen } from "@/app/acciones";
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
 * Confirmación del cierre del dictamen. `children` describe qué va a pasar
 * (lo arma el servidor con las decisiones tomadas).
 */
export function DialogoCerrarDictamen({
  expedienteId,
  numero,
  habilitado,
  children,
}: {
  expedienteId: number;
  numero: string;
  /** false mientras falte decidir algún diagnóstico. */
  habilitado: boolean;
  children: React.ReactNode;
}) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  return (
    <AlertDialog
      open={abierto}
      onOpenChange={(a) => {
        if (pendiente) return;
        setAbierto(a);
        if (a) limpiarError();
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" disabled={!habilitado}>
          <StampIcon />
          Cerrar dictamen
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-violet-50 text-violet-700">
            <StampIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Cerrar el dictamen?</AlertDialogTitle>
          <AlertDialogDescription>
            Expediente <span className="font-mono">{numero}</span>. Las decisiones quedan firmes y se envían las
            notificaciones: no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-lg border bg-muted/30 p-3">{children}</div>

        <ErrorAccion error={error} />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Volver</AlertDialogCancel>
          <Button
            type="button"
            disabled={pendiente}
            onClick={() => ejecutar(() => accionCerrarDictamen(expedienteId), { alTerminar: () => setAbierto(false) })}
          >
            {pendiente ? <Spinner /> : <StampIcon />}
            Cerrar dictamen
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
