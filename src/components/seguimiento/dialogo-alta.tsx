"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CircleCheckIcon, DoorOpenIcon, HourglassIcon } from "lucide-react";
import { accionDarAlta } from "@/app/acciones";
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
import { MOTIVO_CESE_ILT_INFO, PLAZOS, type MotivoCeseIlt } from "@/lib/dominio/constantes";
import { diasEntre, esFechaISO, formatoFecha, type EstadoPlazo, type FechaISO } from "@/lib/dominio/fechas";
import { esquemaAlta } from "@/lib/esquemas";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";

type Entrada = z.input<typeof esquemaAlta>;
type Salida = z.output<typeof esquemaAlta>;

const MOTIVOS = Object.keys(MOTIVO_CESE_ILT_INFO) as MotivoCeseIlt[];

const AYUDA_MOTIVO: Record<MotivoCeseIlt, string> = {
  L: "Puede volver a sus tareas.",
  P: "Se declara una incapacidad laboral permanente.",
  D: "Fallecimiento del trabajador.",
  T: "Se cumplió el tope de 365 días sin alta.",
};

/**
 * Alta médica (RF-17, RF-21): la fecha de alta es la de cese de la ILT.
 * Con alta médica (L) no puede pasar del tope de 365 días, y el motivo T solo
 * corresponde cuando ese tope se cumplió (RF-22).
 */
export function DialogoAlta({
  expedienteId,
  numero,
  trabajador,
  hoy,
  inicioLicencia,
  tope,
  plazoTope,
}: {
  expedienteId: number;
  numero: string;
  trabajador: string;
  hoy: FechaISO;
  /** Inicio de la inasistencia: el alta no puede ser anterior. */
  inicioLicencia: FechaISO | null;
  /** Tope de la ILT (siniestro + 365 días), si el expediente tiene fecha del siniestro. */
  tope: FechaISO | null;
  plazoTope: EstadoPlazo | null;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  const topeCumplido = tope !== null && tope < hoy;
  /** Con el tope cumplido, la ILT terminó ese día (o al empezar la licencia, si fue después). */
  const fechaDelTope = tope && inicioLicencia && inicioLicencia > tope ? inicioLicencia : tope;

  const esquema = useMemo(
    () =>
      esquemaAlta.superRefine((d, ctx) => {
        if (d.fecha_alta > hoy) {
          ctx.addIssue({ code: "custom", path: ["fecha_alta"], message: "No puede ser posterior a hoy" });
        } else if (inicioLicencia && d.fecha_alta < inicioLicencia) {
          ctx.addIssue({
            code: "custom",
            path: ["fecha_alta"],
            message: `No puede ser anterior al inicio de la licencia (${formatoFecha(inicioLicencia)})`,
          });
        }
        if (tope && d.motivo_cese_ilt === "L" && d.fecha_alta > tope) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo_cese_ilt"],
            message: `Con alta médica la ILT no puede pasar del tope (${formatoFecha(tope)}). Elegí «Transcurso de un año».`,
          });
        }
        if (d.motivo_cese_ilt === "T" && (!tope || d.fecha_alta < tope)) {
          ctx.addIssue({
            code: "custom",
            path: ["motivo_cese_ilt"],
            message: tope
              ? `«Transcurso de un año» corresponde solo cuando se cumplió el tope de ${PLAZOS.topeIltDias} días (${formatoFecha(tope)}).`
              : "«Transcurso de un año» necesita la fecha del siniestro para calcular el tope de la ILT.",
          });
        }
      }),
    [hoy, inicioLicencia, tope],
  );

  const iniciales = (): Entrada => ({
    expediente_id: expedienteId,
    fecha_alta: topeCumplido && fechaDelTope ? fechaDelTope : hoy,
    motivo_cese_ilt: topeCumplido ? "T" : "L",
  });
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<Entrada, unknown, Salida>({ resolver: zodResolver(esquema), defaultValues: iniciales() });
  const fechaAlta = useWatch({ control, name: "fecha_alta" });

  const duracion =
    inicioLicencia && esFechaISO(fechaAlta) && fechaAlta >= inicioLicencia ? diasEntre(inicioLicencia, fechaAlta) : null;
  const superaTope = tope !== null && esFechaISO(fechaAlta) && fechaAlta > tope;
  const avisarTope = tope !== null && (superaTope || (plazoTope !== null && plazoTope.nivel !== "en_termino"));
  const grave = superaTope || plazoTope?.nivel === "vencido" || plazoTope?.nivel === "hoy";

  function cambiarAbierto(valor: boolean) {
    if (valor) {
      reset(iniciales());
      limpiarError();
    }
    setAbierto(valor);
  }

  function usarTope() {
    if (!fechaDelTope) return;
    setValue("fecha_alta", fechaDelTope, { shouldValidate: true });
    setValue("motivo_cese_ilt", "T", { shouldValidate: true });
  }

  const enviar = handleSubmit((d) => ejecutar(() => accionDarAlta(d), { alTerminar: () => setAbierto(false) }));

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <DoorOpenIcon />
          Dar de alta
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dar de alta</DialogTitle>
          <DialogDescription>
            Expediente <span className="font-mono">{numero}</span> · {trabajador}. La fecha de alta es la de cese de la
            incapacidad laboral temporaria (ILT).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-1">
            <FieldGroup>
              {avisarTope && tope ? (
                <Alert
                  className={cn(
                    grave ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900",
                  )}
                >
                  <HourglassIcon />
                  <AlertTitle>
                    Tope de la ILT: {formatoFecha(tope)}
                    {plazoTope ? ` · ${plazoTope.texto}` : null}
                  </AlertTitle>
                  <AlertDescription className={grave ? "text-red-800" : "text-amber-800"}>
                    <p>
                      La ILT no puede superar los {PLAZOS.topeIltDias} días desde el siniestro. Con «Alta médica» la fecha
                      no puede pasar del tope; si se cumplió el año sin alta, el motivo es «Transcurso de un año» (T).
                    </p>
                    {topeCumplido && fechaDelTope ? (
                      <Button type="button" variant="outline" size="xs" className="mt-2" onClick={usarTope}>
                        Usar el tope: {formatoFecha(fechaDelTope)} · motivo T
                      </Button>
                    ) : null}
                  </AlertDescription>
                </Alert>
              ) : null}

              <Field data-invalid={errors.fecha_alta ? true : undefined}>
                <FieldLabel htmlFor={`${id}-fecha`}>Fecha de alta (fin de la ILT)</FieldLabel>
                <Input
                  id={`${id}-fecha`}
                  type="date"
                  min={inicioLicencia ?? undefined}
                  max={hoy}
                  className="sm:max-w-56"
                  aria-invalid={errors.fecha_alta ? true : undefined}
                  {...register("fecha_alta")}
                />
                <FieldDescription>
                  {duracion !== null ? (
                    <>
                      Duración de la licencia: <span className="font-medium text-foreground">{plural(duracion, "día")}</span>{" "}
                      (desde el {formatoFecha(inicioLicencia)}).
                    </>
                  ) : inicioLicencia ? (
                    <>La licencia empezó el {formatoFecha(inicioLicencia)}.</>
                  ) : null}
                  {tope && !avisarTope ? <> Tope de la ILT: {formatoFecha(tope)}.</> : null}
                </FieldDescription>
                <FieldError errors={[errors.fecha_alta]} />
              </Field>

              <FieldSet className="gap-2">
                <FieldLegend variant="label">Motivo del cese de la ILT</FieldLegend>
                <Controller
                  control={control}
                  name="motivo_cese_ilt"
                  render={({ field }) => (
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="grid gap-2 sm:grid-cols-2"
                      aria-invalid={errors.motivo_cese_ilt ? true : undefined}
                    >
                      {MOTIVOS.map((m) => (
                        <FieldLabel key={m} htmlFor={`${id}-motivo-${m}`}>
                          <Field orientation="horizontal">
                            <RadioGroupItem value={m} id={`${id}-motivo-${m}`} />
                            <FieldContent>
                              <FieldTitle>
                                {MOTIVO_CESE_ILT_INFO[m]}
                                <span className="font-mono text-xs font-normal text-muted-foreground">{m}</span>
                              </FieldTitle>
                              <FieldDescription className="text-xs">{AYUDA_MOTIVO[m]}</FieldDescription>
                            </FieldContent>
                          </Field>
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                  )}
                />
                <FieldError errors={[errors.motivo_cese_ilt]} />
              </FieldSet>

              <p className="text-xs text-muted-foreground">
                El expediente pasa a «Alta médica» y se notifica al trabajador por e-Servicios y al empleador por
                Ventanilla Electrónica <Simulado />. Si después surge una complicación del mismo siniestro, Mesa de
                entrada puede cargar un reingreso.
              </p>
            </FieldGroup>
          </div>
          <ErrorAccion error={error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Spinner /> : <CircleCheckIcon />}
              Confirmar el alta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
