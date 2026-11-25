"use client";

import { useState } from "react";
import { TriangleAlertIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { toast } from "sonner";
import { accionRegistrarAsistencia } from "@/app/acciones";
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

/**
 * Resultado de una citación programada. Si es la reiteración, la inasistencia
 * deja el expediente Desistido por caducidad (Anexo II pto. 3.3): se confirma antes.
 * La inasistencia solo se registra cuando ya pasó la fecha y hora de la citación.
 */
export function BotonesAsistencia({
  citacionId,
  esReiteracion,
  fecha,
  yaPaso,
}: {
  citacionId: number;
  esReiteracion: boolean;
  /** Fecha y hora de la citación, ya formateada. */
  fecha: string;
  /** ¿Ya pasó la fecha y hora de la citación? */
  yaPaso: boolean;
}) {
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const [confirmando, setConfirmando] = useState(false);
  const [elegido, setElegido] = useState<"asistio" | "no_asistio" | null>(null);

  function registrar(asistio: boolean) {
    setElegido(asistio ? "asistio" : "no_asistio");
    ejecutar(() => accionRegistrarAsistencia({ citacion_id: citacionId, asistio }), {
      silencioso: true,
      alTerminar: (datos) => {
        setConfirmando(false);
        if (datos.caducidad) {
          toast.warning("Caducidad del trámite: el expediente quedó Desistido", {
            description: "Segunda inasistencia (Anexo II pto. 3.3). No es un rechazo y no habilita la Comisión Médica.",
          });
        } else if (asistio) {
          toast.success("Asistencia registrada");
        } else {
          toast.success("Inasistencia registrada", {
            description: "Corresponde reiterar la citación por única vez, bajo apercibimiento de caducidad.",
          });
        }
      },
    });
  }

  return (
    <>
      <Button size="sm" variant="outline" disabled={pendiente} onClick={() => registrar(true)}>
        {pendiente && elegido === "asistio" ? <Spinner /> : <UserCheckIcon />}
        Asistió
      </Button>
      {!yaPaso ? null : esReiteracion ? (
        <AlertDialog
          open={confirmando}
          onOpenChange={(a) => {
            if (a) limpiarError();
            setConfirmando(a);
          }}
        >
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={pendiente}>
              <UserXIcon />
              No asistió
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-red-50 text-red-700">
                <TriangleAlertIcon />
              </AlertDialogMedia>
              <AlertDialogTitle>¿No asistió a la reiteración?</AlertDialogTitle>
              <AlertDialogDescription>
                La citación del {fecha} ya era la reiteración. Caducidad del trámite: el expediente queda Desistido. No es un
                rechazo y no habilita la Comisión Médica.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ErrorAccion error={error} />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={pendiente}
                onClick={(e) => {
                  // Queda abierto hasta que la acción termine.
                  e.preventDefault();
                  registrar(false);
                }}
              >
                {pendiente ? <Spinner /> : null}
                Registrar inasistencia
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <Button size="sm" variant="outline" disabled={pendiente} onClick={() => registrar(false)}>
          {pendiente && elegido === "no_asistio" ? <Spinner /> : <UserXIcon />}
          No asistió
        </Button>
      )}
    </>
  );
}
