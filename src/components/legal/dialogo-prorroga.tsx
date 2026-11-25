"use client";

import { useState } from "react";
import { ArrowRightIcon, CalendarClockIcon, CalendarPlusIcon } from "lucide-react";
import { accionSolicitarProrroga } from "@/app/acciones";
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
import { PLAZOS } from "@/lib/dominio/constantes";
import { formatoFecha, type FechaISO } from "@/lib/dominio/fechas";

/** Confirmación de la prórroga del plazo legal (se puede pedir una sola vez). */
export function DialogoProrroga({
  expedienteId,
  venceActual,
  venceConProrroga,
}: {
  expedienteId: number;
  venceActual: FechaISO;
  venceConProrroga: FechaISO;
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
        <Button type="button" variant="outline" size="sm">
          <CalendarPlusIcon />
          Solicitar prórroga
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-violet-50 text-violet-700">
            <CalendarClockIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Solicitar la prórroga del plazo legal?</AlertDialogTitle>
          <AlertDialogDescription>
            El plazo para expedirse se extiende {PLAZOS.prorrogaDiasHabiles} días hábiles. La prórroga se puede pedir una
            sola vez por expediente.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center justify-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Vencimiento actual</div>
            <div className="font-medium tabular-nums line-through decoration-muted-foreground/60">
              {formatoFecha(venceActual)}
            </div>
          </div>
          <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
          <div className="text-center">
            <div className="text-xs text-muted-foreground">Con la prórroga</div>
            <div className="font-semibold text-violet-800 tabular-nums">{formatoFecha(venceConProrroga)}</div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Plazo de la prórroga tomado del relevamiento: a confirmar con la UERT.
        </p>

        <ErrorAccion error={error} />

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button
            type="button"
            disabled={pendiente}
            onClick={() =>
              ejecutar(() => accionSolicitarProrroga(expedienteId), { alTerminar: () => setAbierto(false) })
            }
          >
            {pendiente ? <Spinner /> : <CalendarPlusIcon />}
            Solicitar prórroga
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
