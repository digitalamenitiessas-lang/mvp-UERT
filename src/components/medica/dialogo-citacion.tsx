"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CalendarPlusIcon, MailIcon, RepeatIcon, TriangleAlertIcon } from "lucide-react";
import { accionProgramarCitacion } from "@/app/acciones";
import { Simulado } from "@/components/comun/badges";
import { ErrorAccion } from "@/components/comun/error-accion";
import { useAccion } from "@/components/comun/use-accion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { MOTIVO_CITACION_INFO, PLAZOS, type MotivoCitacion } from "@/lib/dominio/constantes";
import { esFechaISO, formatoFechaHora, momentoArgentina } from "@/lib/dominio/fechas";
import { esquemaCitacion } from "@/lib/esquemas";
import type { CitacionAReiterar, LimitesCitacion } from "./tipos";
import { LUGAR_CITACION } from "./utilidades";

/** Además del esquema común: al menos 72 h de anticipación (Anexo II pto. 1.6). */
const esquema = esquemaCitacion.superRefine((d, ctx) => {
  if (!esFechaISO(d.fecha) || !/^\d{2}:\d{2}$/.test(d.hora)) return;
  const minimo = Date.now() + PLAZOS.citacionHorasMinimas * 3_600_000;
  if (momentoArgentina(d.fecha, d.hora).getTime() < minimo) {
    ctx.addIssue({
      code: "custom",
      path: ["fecha"],
      message: `Se notifica con al menos ${PLAZOS.citacionHorasMinimas} h de anticipación: elegí desde el ${formatoFechaHora(new Date(minimo))}`,
    });
  }
});

type Valores = z.input<typeof esquemaCitacion>;

const MOTIVOS = Object.entries(MOTIVO_CITACION_INFO) as Array<[MotivoCitacion, string]>;

/**
 * Citación del trabajador (examen, estudios o documentación) o reiteración
 * de una a la que no asistió. Se notifica por e-Servicios SRT y por email.
 */
export function DialogoCitacion({
  expedienteId,
  limites,
  reiteracion = null,
  bloqueada = false,
}: {
  expedienteId: number;
  limites: LimitesCitacion;
  /** Citación a la que no asistió: el diálogo pasa a ser de reiteración. */
  reiteracion?: CitacionAReiterar | null;
  /** Ya hay una citación programada: primero hay que registrar su resultado. */
  bloqueada?: boolean;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  const iniciales = (): Valores => ({
    expediente_id: expedienteId,
    fecha: limites.sugerida,
    hora: "10:00",
    motivo: reiteracion?.motivo ?? "examen",
    lugar: reiteracion?.lugar ?? LUGAR_CITACION,
    detalle: reiteracion?.detalle ?? "",
    reiteracion_de: reiteracion?.id ?? null,
  });
  const form = useForm({ resolver: zodResolver(esquema), defaultValues: iniciales() });
  const errores = form.formState.errors;

  function cambiar(a: boolean) {
    if (a) {
      form.reset(iniciales());
      limpiarError();
    }
    setAbierto(a);
  }

  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionProgramarCitacion(datos), {
      exito: reiteracion ? "Reiteración notificada (simulado)" : undefined,
      alTerminar: () => setAbierto(false),
    }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogTrigger asChild>
        {reiteracion ? (
          <Button size="sm">
            <RepeatIcon />
            Reiterar citación
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={bloqueada}>
            <CalendarPlusIcon />
            Citar al trabajador
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>{reiteracion ? "Reiterar la citación" : "Citar al trabajador"}</DialogTitle>
          <DialogDescription>
            {reiteracion
              ? `No asistió a la citación del ${reiteracion.fecha}.`
              : "A examen médico, a estudios complementarios o a presentar documentación."}
          </DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={enviar} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <FieldGroup>
            {reiteracion ? (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900">
                <TriangleAlertIcon />
                <AlertTitle>Se reitera por única vez</AlertTitle>
                <AlertDescription className="text-amber-900/90">
                  Bajo apercibimiento de caducidad del trámite (Anexo II pto. 3.3): si tampoco asiste, el expediente queda
                  Desistido.
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col gap-2">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field data-invalid={!!errores.fecha || undefined}>
                  <FieldLabel htmlFor={`${id}-fecha`}>Fecha</FieldLabel>
                  <Input
                    id={`${id}-fecha`}
                    type="date"
                    min={limites.minimaFecha}
                    aria-invalid={!!errores.fecha || undefined}
                    aria-describedby={`${id}-anticipacion`}
                    {...form.register("fecha")}
                  />
                </Field>
                <Field data-invalid={!!errores.hora || undefined}>
                  <FieldLabel htmlFor={`${id}-hora`}>Hora</FieldLabel>
                  <Input
                    id={`${id}-hora`}
                    type="time"
                    aria-invalid={!!errores.hora || undefined}
                    {...form.register("hora")}
                  />
                </Field>
              </div>
              <FieldDescription id={`${id}-anticipacion`}>
                Con al menos {PLAZOS.citacionHorasMinimas} h de anticipación: desde el {limites.minimaTexto}.
              </FieldDescription>
              <FieldError errors={[errores.fecha, errores.hora]} />
            </div>

            <Controller
              control={form.control}
              name="motivo"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${id}-motivo`}>Motivo</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id={`${id}-motivo`} className="w-full" aria-invalid={fieldState.invalid || undefined}>
                      <SelectValue placeholder="Elegí el motivo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOTIVOS.map(([valor, texto]) => (
                        <SelectItem key={valor} value={valor}>
                          {texto}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Field data-invalid={!!errores.lugar || undefined}>
              <FieldLabel htmlFor={`${id}-lugar`}>Lugar</FieldLabel>
              <Input id={`${id}-lugar`} aria-invalid={!!errores.lugar || undefined} {...form.register("lugar")} />
              <FieldError errors={[errores.lugar]} />
            </Field>

            <Field data-invalid={!!errores.detalle || undefined}>
              <FieldLabel htmlFor={`${id}-detalle`}>
                Indicaciones <span className="font-normal text-muted-foreground">(opcional)</span>
              </FieldLabel>
              <Textarea
                id={`${id}-detalle`}
                rows={3}
                placeholder="Por ejemplo: traer estudios y certificados previos."
                aria-invalid={!!errores.detalle || undefined}
                {...form.register("detalle")}
              />
              <FieldError errors={[errores.detalle]} />
            </Field>

            <Alert>
              <MailIcon />
              <AlertTitle className="flex flex-wrap items-center gap-2">
                Notificación al trabajador <Simulado />
              </AlertTitle>
              <AlertDescription>
                Se notifica por e-Servicios SRT y por email con al menos {PLAZOS.citacionHorasMinimas} h de anticipación
                (Anexo II pto. 1.6).
              </AlertDescription>
            </Alert>
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
            {reiteracion ? "Reiterar y notificar" : "Citar y notificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
