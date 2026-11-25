"use client";

import { useState } from "react";
import { ArrowRightIcon, GavelIcon } from "lucide-react";
import { accionPasarALegal } from "@/app/acciones";
import { ErrorAccion } from "@/components/comun/error-accion";
import { useAccion } from "@/components/comun/use-accion";
import {
  AlertDialog,
  AlertDialogAction,
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

/** Pase al Área legal, con confirmación: empieza a correr su plazo. */
export function BotonPasarALegal({
  expedienteId,
  habilitado,
  dias,
  vence,
  className,
}: {
  expedienteId: number;
  habilitado: boolean;
  /** Días hábiles del plazo legal. */
  dias: number;
  /** Vencimiento estimado si el pase es hoy, ya formateado. */
  vence: string;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  return (
    <AlertDialog
      open={abierto}
      onOpenChange={(a) => {
        if (a) limpiarError();
        setAbierto(a);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button disabled={!habilitado} className={className}>
          <GavelIcon />
          Pasar al Área legal
          <ArrowRightIcon />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-violet-50 text-violet-700">
            <GavelIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Pasar el expediente al Área legal?</AlertDialogTitle>
          <AlertDialogDescription>
            Empieza a correr el plazo de {dias} días hábiles para aceptar o rechazar cada diagnóstico (vence el {vence}).
            Después del pase, la evaluación médica ya no se puede modificar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ErrorAccion error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pendiente}
            onClick={(e) => {
              // Queda abierto hasta que la acción termine.
              e.preventDefault();
              ejecutar(() => accionPasarALegal(expedienteId), { alTerminar: () => setAbierto(false) });
            }}
          >
            {pendiente ? <Spinner /> : null}
            Pasar al Área legal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
