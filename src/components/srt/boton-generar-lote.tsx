"use client";

import { useState } from "react";
import { FileOutputIcon } from "lucide-react";
import { toast } from "sonner";
import { accionGenerarLote } from "@/app/acciones";
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
import { plural } from "@/lib/formato";

/**
 * Genera un lote del Sistema de Intercambio (.AD, .AL, .AZ) con los
 * diagnósticos pendientes o modificados. Pide confirmación porque los
 * diagnósticos quedan marcados como informados.
 */
export function BotonGenerarLote({ pendientes }: { pendientes: number }) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  function generar() {
    ejecutar(() => accionGenerarLote(), {
      silencioso: true,
      alTerminar: (lote) => {
        toast.success(`Lote ${lote.id} generado`, {
          description: `${plural(lote.registros, "registro")} en los archivos .AD, .AL y .AZ (envío simulado).`,
        });
        if (lote.omitidos.length) {
          // Quedan pendientes: el resto del lote se generó igual.
          toast.warning(`${plural(lote.omitidos.length, "diagnóstico quedó", "diagnósticos quedaron")} fuera del lote`, {
            description: lote.omitidos.join(" · "),
            duration: 15_000,
          });
        }
        setAbierto(false);
      },
    });
  }

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
        <Button disabled={pendientes === 0}>
          <FileOutputIcon />
          Generar archivos
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="data-[size=default]:sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-primary/10 text-primary">
            <FileOutputIcon />
          </AlertDialogMedia>
          <AlertDialogTitle>¿Generar los archivos de intercambio?</AlertDialogTitle>
          <AlertDialogDescription>
            Se arman los archivos .AD, .AL y .AZ con {plural(pendientes, "diagnóstico pendiente", "diagnósticos pendientes")}{" "}
            de informar y quedan marcados como informados en un lote nuevo. En la demo el envío a la SRT es simulado.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ErrorAccion error={error} />
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
          <Button onClick={generar} disabled={pendiente}>
            {pendiente ? <Spinner /> : <FileOutputIcon />}
            {pendiente ? "Generando…" : "Generar"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
