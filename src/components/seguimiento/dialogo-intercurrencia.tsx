"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import { GitBranchIcon, ZapIcon } from "lucide-react";
import { accionRegistrarIntercurrencia } from "@/app/acciones";
import { CampoCatalogo } from "@/components/comun/campo-catalogo";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatoFecha, type FechaISO } from "@/lib/dominio/fechas";
import { esquemaIntercurrencia } from "@/lib/esquemas";

type Entrada = z.input<typeof esquemaIntercurrencia>;
type Salida = z.output<typeof esquemaIntercurrencia>;

/**
 * Intercurrencia (RF-18, RF-26): hecho ocurrido durante la licencia activa,
 * por el tratamiento o en el traslado al prestador. Se carga como un
 * siniestro nuevo vinculado y pasa directo al Área médica.
 */
export function DialogoIntercurrencia({
  expedienteId,
  numero,
  hoy,
  inicioLicencia,
}: {
  expedienteId: number;
  numero: string;
  hoy: FechaISO;
  /** Inicio de la inasistencia: la intercurrencia no puede ser anterior. */
  inicioLicencia: FechaISO | null;
}) {
  const id = useId();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  const esquema = useMemo(
    () =>
      esquemaIntercurrencia.superRefine((d, ctx) => {
        if (d.fecha_ocurrencia > hoy) {
          ctx.addIssue({ code: "custom", path: ["fecha_ocurrencia"], message: "No puede ser posterior a hoy" });
        } else if (inicioLicencia && d.fecha_ocurrencia < inicioLicencia) {
          ctx.addIssue({
            code: "custom",
            path: ["fecha_ocurrencia"],
            message: `Tiene que ocurrir durante la licencia (desde el ${formatoFecha(inicioLicencia)})`,
          });
        }
      }),
    [hoy, inicioLicencia],
  );

  const iniciales = (): Entrada => ({ expediente_id: expedienteId, fecha_ocurrencia: hoy, descripcion: "", cie10: "" });
  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Entrada, unknown, Salida>({ resolver: zodResolver(esquema), defaultValues: iniciales() });

  function cambiarAbierto(valor: boolean) {
    if (valor) {
      reset(iniciales());
      limpiarError();
    }
    setAbierto(valor);
  }

  const enviar = handleSubmit((d) =>
    ejecutar(() => accionRegistrarIntercurrencia(d), {
      silencioso: true,
      alTerminar: (nuevo) => {
        setAbierto(false);
        toast.success(`Intercurrencia registrada: ${nuevo.numero}`, {
          description: "Pasó directo al Área médica. Te llevamos a su ficha.",
        });
        router.push(`/expedientes/${nuevo.id}`);
      },
    }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <ZapIcon />
          Registrar intercurrencia
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Registrar intercurrencia</DialogTitle>
          <DialogDescription>
            Un hecho nuevo durante la licencia del expediente <span className="font-mono">{numero}</span>: por el
            tratamiento o en el traslado al prestador.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-1">
            <FieldGroup>
              <Alert>
                <GitBranchIcon />
                <AlertTitle>Se carga como un siniestro nuevo, vinculado a este</AlertTitle>
                <AlertDescription>
                  Toma los datos de la persona y del empleo, queda marcado como intercurrencia y pasa directo al
                  Área médica, sin volver a Mesa de entrada.
                </AlertDescription>
              </Alert>

              <Field data-invalid={errors.fecha_ocurrencia ? true : undefined} className="sm:max-w-56">
                <FieldLabel htmlFor={`${id}-fecha`}>Fecha del hecho</FieldLabel>
                <Input
                  id={`${id}-fecha`}
                  type="date"
                  min={inicioLicencia ?? undefined}
                  max={hoy}
                  aria-invalid={errors.fecha_ocurrencia ? true : undefined}
                  {...register("fecha_ocurrencia")}
                />
                {inicioLicencia ? (
                  <FieldDescription>La licencia empezó el {formatoFecha(inicioLicencia)}.</FieldDescription>
                ) : null}
                <FieldError errors={[errors.fecha_ocurrencia]} />
              </Field>

              <Field data-invalid={errors.descripcion ? true : undefined}>
                <FieldLabel htmlFor={`${id}-descripcion`}>Qué pasó</FieldLabel>
                <Textarea
                  id={`${id}-descripcion`}
                  rows={4}
                  placeholder="Dónde estaba, qué tratamiento o traslado hacía y qué lesión sufrió."
                  aria-invalid={errors.descripcion ? true : undefined}
                  {...register("descripcion")}
                />
                <FieldError errors={[errors.descripcion]} />
              </Field>

              <Field>
                <FieldLabel htmlFor={`${id}-cie10`}>Diagnóstico presunto (CIE-10)</FieldLabel>
                <Controller
                  control={control}
                  name="cie10"
                  render={({ field }) => (
                    <CampoCatalogo
                      id={`${id}-cie10`}
                      catalogo="cie10"
                      valor={field.value || null}
                      onChange={(codigo) => field.onChange(codigo ?? "")}
                      placeholder="Opcional: buscá por código o palabras"
                    />
                  )}
                />
                <FieldDescription>Opcional. El Área médica lo evalúa y puede corregirlo.</FieldDescription>
              </Field>
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
              {pendiente ? <Spinner /> : <ZapIcon />}
              Registrar y pasar al Área médica
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
