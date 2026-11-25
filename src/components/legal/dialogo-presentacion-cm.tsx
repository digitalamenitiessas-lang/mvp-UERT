"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { LandmarkIcon, MapPinIcon } from "lucide-react";
import { accionPresentacionCM } from "@/app/acciones";
import { ErrorAccion } from "@/components/comun/error-accion";
import { useAccion } from "@/components/comun/use-accion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ESTADO_INFO, UERT } from "@/lib/dominio/constantes";
import { formatoFecha, type FechaISO } from "@/lib/dominio/fechas";
import { esquemaPresentacionCM } from "@/lib/esquemas";

type Entrada = z.input<typeof esquemaPresentacionCM>;
type Salida = z.output<typeof esquemaPresentacionCM>;

/**
 * Registrar que el trámite se presentó ante la Comisión Médica (contingencia
 * aceptada sin baja, Res. EP art. 9). El expediente queda cerrado.
 */
export function DialogoPresentacionCM({
  expedienteId,
  hoy,
  vence,
}: {
  expedienteId: number;
  /** Fecha de hoy en Argentina (la calcula el servidor). */
  hoy: FechaISO;
  vence: FechaISO | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const form = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(esquemaPresentacionCM),
    defaultValues: { expediente_id: expedienteId, fecha: hoy },
  });
  const { errors } = form.formState;
  const id = `presentacion-cm-${expedienteId}`;

  const enviar = form.handleSubmit((v) => {
    if (v.fecha > hoy) {
      form.setError("fecha", { message: "No puede ser posterior a hoy" });
      return;
    }
    ejecutar(() => accionPresentacionCM({ expediente_id: v.expediente_id, fecha: v.fecha }), {
      alTerminar: () => setAbierto(false),
    });
  });

  return (
    <Dialog
      open={abierto}
      onOpenChange={(a) => {
        if (pendiente) return;
        if (a) {
          form.reset({ expediente_id: expedienteId, fecha: hoy });
          limpiarError();
        }
        setAbierto(a);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="h-auto min-h-7 max-w-full py-1.5 text-left whitespace-normal">
          <LandmarkIcon />
          Registrar presentación ante la Comisión Médica
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Presentación ante la Comisión Médica</DialogTitle>
            <DialogDescription>
              Registrá cuándo se presentó el trámite para determinar u homologar la incapacidad. El expediente pasa a
              “{ESTADO_INFO.cerrado.nombre}”.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2.5 rounded-lg border bg-muted/40 px-3 py-2.5 text-sm">
            <MapPinIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <div>
              <div className="font-medium">{UERT.comisionMedica.nombre}</div>
              <div className="text-muted-foreground">{UERT.comisionMedica.direccion}</div>
              {vence ? (
                <div className="mt-1 text-xs text-muted-foreground">Plazo para presentarlo: hasta el {formatoFecha(vence)}.</div>
              ) : null}
            </div>
          </div>

          <FieldGroup>
            <Field data-invalid={!!errors.fecha || undefined}>
              <FieldLabel htmlFor={`${id}-fecha`}>Fecha de presentación</FieldLabel>
              <Input
                id={`${id}-fecha`}
                type="date"
                max={hoy}
                className="w-full sm:w-48"
                aria-invalid={!!errors.fecha || undefined}
                {...form.register("fecha")}
              />
              <FieldDescription className="text-xs">Podés escribirla o elegirla en el calendario.</FieldDescription>
              <FieldError errors={[errors.fecha]} />
            </Field>
          </FieldGroup>

          <ErrorAccion error={error} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pendiente}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Spinner /> : <LandmarkIcon />}
              Registrar presentación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
