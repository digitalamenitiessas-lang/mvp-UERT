"use client";

import { useId, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { LandmarkIcon, SendIcon } from "lucide-react";
import { accionPresentacionCM } from "@/app/acciones";
import { PlazoBadge } from "@/components/comun/badges";
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
import { PLAZOS, UERT } from "@/lib/dominio/constantes";
import { esFechaISO, formatoFecha, type EstadoPlazo, type FechaISO } from "@/lib/dominio/fechas";
import { esquemaPresentacionCM } from "@/lib/esquemas";

type Entrada = z.input<typeof esquemaPresentacionCM>;
type Salida = z.output<typeof esquemaPresentacionCM>;

/**
 * Presentación ante la Comisión Médica de una contingencia aceptada sin baja
 * (Res. EP, art. 9; RF-51). Al registrarla el expediente queda cerrado.
 */
export function DialogoComisionMedica({
  expedienteId,
  numero,
  trabajador,
  hoy,
  vence,
  plazo,
}: {
  expedienteId: number;
  numero: string;
  trabajador: string;
  hoy: FechaISO;
  vence: FechaISO | null;
  plazo: EstadoPlazo | null;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  const esquema = useMemo(
    () =>
      esquemaPresentacionCM.superRefine((d, ctx) => {
        if (d.fecha > hoy) ctx.addIssue({ code: "custom", path: ["fecha"], message: "No puede ser posterior a hoy" });
      }),
    [hoy],
  );
  const iniciales = (): Entrada => ({ expediente_id: expedienteId, fecha: hoy });
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Entrada, unknown, Salida>({ resolver: zodResolver(esquema), defaultValues: iniciales() });
  const fecha = useWatch({ control, name: "fecha" });
  const fueraDePlazo = vence !== null && esFechaISO(fecha) && fecha > vence;

  function cambiarAbierto(valor: boolean) {
    if (valor) {
      reset(iniciales());
      limpiarError();
    }
    setAbierto(valor);
  }

  const enviar = handleSubmit((d) => ejecutar(() => accionPresentacionCM(d), { alTerminar: () => setAbierto(false) }));

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger asChild>
        <Button className="h-auto min-h-8 py-1.5 text-left whitespace-normal">
          <SendIcon />
          Registrar presentación ante la Comisión Médica
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Presentación ante la Comisión Médica</DialogTitle>
          <DialogDescription>
            Expediente <span className="font-mono">{numero}</span> · {trabajador}. Registrá cuándo se presentó el trámite
            para que la Comisión Médica determine u homologue la incapacidad (Res. EP, art. 9).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <div className="flex gap-3 rounded-lg border bg-muted/30 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-50 text-teal-700">
              <LandmarkIcon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium">{UERT.comisionMedica.nombre}</span>
              <span className="text-xs text-muted-foreground">{UERT.comisionMedica.direccion}</span>
              {vence ? (
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  Plazo de {PLAZOS.sinBajaDiasHabiles} días hábiles: vence el {formatoFecha(vence)}
                  {plazo ? <PlazoBadge plazo={plazo} /> : null}
                </span>
              ) : null}
            </div>
          </div>
          <FieldGroup>
            <Field data-invalid={errors.fecha ? true : undefined}>
              <FieldLabel htmlFor={`${id}-fecha`}>Fecha de la presentación</FieldLabel>
              <Input
                id={`${id}-fecha`}
                type="date"
                max={hoy}
                className="sm:max-w-56"
                aria-invalid={errors.fecha ? true : undefined}
                {...register("fecha")}
              />
              <FieldDescription>
                {fueraDePlazo ? (
                  <span className="text-amber-800">Queda fuera del plazo, que venció el {formatoFecha(vence)}. </span>
                ) : null}
                Al registrarla, el expediente queda «Cerrado».
              </FieldDescription>
              <FieldError errors={[errors.fecha]} />
            </Field>
          </FieldGroup>
          <ErrorAccion error={error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Spinner /> : <SendIcon />}
              Registrar presentación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
