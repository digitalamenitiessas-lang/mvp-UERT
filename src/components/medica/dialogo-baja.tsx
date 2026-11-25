"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { SquarePenIcon } from "lucide-react";
import { accionDefinirBaja } from "@/app/acciones";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { formatoFecha, type FechaISO } from "@/lib/dominio/fechas";
import { esquemaBaja } from "@/lib/esquemas";

export interface BajaActual {
  con_baja: boolean | null;
  fecha_inicio_inasistencia: FechaISO | null;
  estres_postraumatico: boolean;
}

type Valores = z.input<typeof esquemaBaja>;

/**
 * Baja laboral: con o sin baja, desde cuándo no concurre (RF-20) y estrés
 * postraumático, que solo indica el Área médica (RF-29/30).
 */
export function DialogoBaja({
  expedienteId,
  actual,
  minimoInicio,
  maximoInicio,
  fechaOcurrencia,
}: {
  expedienteId: number;
  actual: BajaActual;
  /** AT e in itinere: como mínimo el día siguiente al siniestro (RF-20). */
  minimoInicio: FechaISO | null;
  /** Hasta 30 días desde hoy. */
  maximoInicio: FechaISO;
  /** Fecha del siniestro o de la primera manifestación (EP). */
  fechaOcurrencia: FechaISO | null;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  // Además del esquema común: los límites de la fecha que controla el servidor.
  const esquema = useMemo(
    () =>
      esquemaBaja.superRefine((d, ctx) => {
        if (!d.con_baja || !d.fecha_inicio_inasistencia) return;
        if (minimoInicio && d.fecha_inicio_inasistencia < minimoInicio) {
          ctx.addIssue({
            code: "custom",
            path: ["fecha_inicio_inasistencia"],
            message: `Como mínimo, el día siguiente al siniestro (${formatoFecha(minimoInicio)})`,
          });
        }
        if (d.fecha_inicio_inasistencia > maximoInicio) {
          ctx.addIssue({
            code: "custom",
            path: ["fecha_inicio_inasistencia"],
            message: `No puede ser posterior al ${formatoFecha(maximoInicio)}`,
          });
        }
      }),
    [minimoInicio, maximoInicio],
  );

  const iniciales = (): DefaultValues<Valores> => ({
    expediente_id: expedienteId,
    // Sin definir: ninguna opción elegida.
    con_baja: actual.con_baja ?? undefined,
    fecha_inicio_inasistencia: actual.fecha_inicio_inasistencia ?? minimoInicio ?? "",
    estres_postraumatico: actual.estres_postraumatico,
  });
  const form = useForm<Valores, unknown, z.output<typeof esquemaBaja>>({
    resolver: zodResolver(esquema),
    defaultValues: iniciales(),
  });
  const conBaja = useWatch({ control: form.control, name: "con_baja" });
  const errores = form.formState.errors;

  function cambiar(a: boolean) {
    if (a) {
      form.reset(iniciales());
      limpiarError();
    }
    setAbierto(a);
  }

  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionDefinirBaja(datos), { alTerminar: () => setAbierto(false) }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogTrigger asChild>
        {actual.con_baja === null ? (
          <Button size="sm">Definir baja</Button>
        ) : (
          <Button size="sm" variant="outline">
            <SquarePenIcon />
            Modificar
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Baja laboral</DialogTitle>
          <DialogDescription>Definí si la contingencia es con o sin baja laboral antes del pase al Área legal.</DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={enviar} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <FieldGroup>
            <Controller
              control={form.control}
              name="con_baja"
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid || undefined} className="gap-3">
                  <FieldLegend variant="label">¿Puede trabajar?</FieldLegend>
                  <RadioGroup
                    value={field.value === undefined ? "" : field.value ? "con" : "sin"}
                    onValueChange={(v) => field.onChange(v === "con")}
                    aria-invalid={fieldState.invalid || undefined}
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <FieldLabel htmlFor={`${id}-con`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>Con baja laboral</FieldTitle>
                          <FieldDescription>No puede trabajar. Si se acepta, se controla la licencia hasta el alta.</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value="con" id={`${id}-con`} />
                      </Field>
                    </FieldLabel>
                    <FieldLabel htmlFor={`${id}-sin`}>
                      <Field orientation="horizontal">
                        <FieldContent>
                          <FieldTitle>Sin baja laboral</FieldTitle>
                          <FieldDescription>Sigue trabajando: no corresponde licencia.</FieldDescription>
                        </FieldContent>
                        <RadioGroupItem value="sin" id={`${id}-sin`} />
                      </Field>
                    </FieldLabel>
                  </RadioGroup>
                  <FieldError>{fieldState.error ? "Elegí si la contingencia es con o sin baja laboral" : null}</FieldError>
                </FieldSet>
              )}
            />

            {conBaja ? (
              <Field data-invalid={!!errores.fecha_inicio_inasistencia || undefined}>
                <FieldLabel htmlFor={`${id}-inicio`}>Inicio de la inasistencia</FieldLabel>
                <Input
                  id={`${id}-inicio`}
                  type="date"
                  min={minimoInicio ?? undefined}
                  max={maximoInicio}
                  aria-invalid={!!errores.fecha_inicio_inasistencia || undefined}
                  className="sm:max-w-56"
                  {...form.register("fecha_inicio_inasistencia")}
                />
                <FieldDescription>
                  {minimoInicio
                    ? `Como mínimo, el día siguiente al siniestro: ${formatoFecha(minimoInicio)} (Res. SRT 3326/14).`
                    : fechaOcurrencia
                      ? `Desde cuándo no concurre a trabajar. Primera manifestación: ${formatoFecha(fechaOcurrencia)}.`
                      : "Desde cuándo no concurre a trabajar."}
                </FieldDescription>
                <FieldError errors={[errores.fecha_inicio_inasistencia]} />
              </Field>
            ) : null}

            <Controller
              control={form.control}
              name="estres_postraumatico"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel htmlFor={`${id}-estres`}>Estrés postraumático</FieldLabel>
                    <FieldDescription>Lo indica solo el Área médica. Por defecto, No.</FieldDescription>
                  </FieldContent>
                  <Switch id={`${id}-estres`} checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />
          </FieldGroup>
        </form>

        {error ? (
          <div className="border-t px-4 py-3">
            <ErrorAccion error={error} />
          </div>
        ) : null}
        <DialogFooter className="mx-0 mb-0">
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pendiente}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" form={`${id}-form`} disabled={pendiente}>
            {pendiente ? <Spinner /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
