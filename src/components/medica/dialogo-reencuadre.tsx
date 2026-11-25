"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CircleAlertIcon, ReplaceIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { accionReencuadrar } from "@/app/acciones";
import { Simulado } from "@/components/comun/badges";
import { CampoCatalogo } from "@/components/comun/campo-catalogo";
import { ErrorAccion } from "@/components/comun/error-accion";
import { useAccion } from "@/components/comun/use-accion";
import { CampoLocalidad } from "@/components/mesa/campo-localidad";
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { FechaISO } from "@/lib/dominio/fechas";
import { esquemaReencuadre } from "@/lib/esquemas";
import type { DatoFodep } from "./tipos";

type Valores = z.input<typeof esquemaReencuadre>;

/** Cómo se pide cada dato de la denuncia FODEP que el accidente no tiene. */
const DATO_FODEP: Record<Exclude<DatoFodep, "localidad_laboral_id">, { etiqueta: string; placeholder: string; tipo?: string }> = {
  telefono: { etiqueta: "Teléfono del trabajador", placeholder: "Con característica, por ejemplo 385 555-0101", tipo: "tel" },
  email: { etiqueta: "Email del trabajador", placeholder: "nombre@correo.com", tipo: "email" },
  domicilio_laboral: { etiqueta: "Domicilio laboral", placeholder: "Calle y número del lugar de trabajo" },
  puesto: { etiqueta: "Puesto", placeholder: "Por ejemplo, ordenanza" },
  tareas: { etiqueta: "Tareas", placeholder: "Qué hace en su puesto" },
  antiguedad_empresa: { etiqueta: "Antigüedad en la Administración", placeholder: "Por ejemplo, 9 años" },
  antiguedad_area: { etiqueta: "Antigüedad en el área", placeholder: "Por ejemplo, 4 años" },
};

/**
 * Reencuadre de un accidente de trabajo como enfermedad profesional (Anexo II
 * pto. 1.5): no requiere un nuevo formulario y el plazo corre desde el
 * reencuadre. Se informa la denuncia FODEP a la SRT: si falta algún dato que
 * la denuncia exige, se pide acá; si la SRT la rechaza, no se reencuadra.
 */
export function DialogoReencuadre({
  expedienteId,
  hoy,
  diagnosticos,
  faltan,
}: {
  expedienteId: number;
  hoy: FechaISO;
  /** Diagnósticos vigentes: la denuncia FODEP exige al menos uno. */
  diagnosticos: number;
  /** Datos de la denuncia FODEP que el accidente no tiene. */
  faltan: DatoFodep[];
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const sinDiagnosticos = diagnosticos === 0;

  const esquema = useMemo(
    () =>
      esquemaReencuadre.superRefine((d, ctx) => {
        if (d.exposicion_desde > hoy) {
          ctx.addIssue({ code: "custom", path: ["exposicion_desde"], message: "No puede ser posterior a hoy" });
        }
        for (const dato of faltan) {
          const valor = d[dato];
          if (valor === null || valor === undefined || (typeof valor === "string" && !valor.trim())) {
            ctx.addIssue({ code: "custom", path: [dato], message: "Obligatorio para la denuncia FODEP" });
          }
        }
      }),
    [hoy, faltan],
  );
  const iniciales: Valores = {
    expediente_id: expedienteId,
    agente_causante: "",
    exposicion_desde: "",
    observacion: "",
    telefono: "",
    email: "",
    domicilio_laboral: "",
    localidad_laboral_id: null,
    puesto: "",
    tareas: "",
    antiguedad_empresa: "",
    antiguedad_area: "",
  };
  const form = useForm({ resolver: zodResolver(esquema), defaultValues: iniciales });
  const errores = form.formState.errors;

  function cambiar(a: boolean) {
    if (a) {
      form.reset(iniciales);
      limpiarError();
    }
    setAbierto(a);
  }

  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionReencuadrar(datos), {
      silencioso: true,
      alTerminar: () => {
        setAbierto(false);
        toast.success("Reencuadrado como enfermedad profesional", {
          description: "Se informó la denuncia a la SRT por el WS FODEP (simulado).",
        });
      },
    }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-auto min-h-7 justify-start py-1 text-left whitespace-normal">
          <ReplaceIcon />
          Reencuadrar como enfermedad profesional
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>Reencuadrar como enfermedad profesional</DialogTitle>
          <DialogDescription>
            El accidente pasa a tramitarse como enfermedad profesional (Anexo II pto. 1.5). No hace falta un nuevo
            formulario y el plazo corre desde el reencuadre.
          </DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={enviar} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <FieldGroup>
            {sinDiagnosticos ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <CircleAlertIcon />
                <AlertTitle>Primero agregá un diagnóstico</AlertTitle>
                <AlertDescription className="text-amber-900/80">
                  La denuncia FODEP exige al menos un diagnóstico CIE-10. Agregalo en el bloque Diagnósticos y después
                  reencuadrá.
                </AlertDescription>
              </Alert>
            ) : null}
            <Controller
              control={form.control}
              name="agente_causante"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${id}-agente`}>Agente de riesgo</FieldLabel>
                  <CampoCatalogo
                    id={`${id}-agente`}
                    catalogo="agente_causante"
                    valor={field.value || null}
                    onChange={(codigo) => field.onChange(codigo ?? "")}
                    placeholder="Elegí el agente causante…"
                    invalido={fieldState.invalid}
                  />
                  <FieldDescription>Se asigna a los diagnósticos que todavía no tienen agente causante.</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Field data-invalid={!!errores.exposicion_desde || undefined}>
              <FieldLabel htmlFor={`${id}-exposicion`}>Exposición desde</FieldLabel>
              <Input
                id={`${id}-exposicion`}
                type="date"
                max={hoy}
                aria-invalid={!!errores.exposicion_desde || undefined}
                className="sm:max-w-56"
                {...form.register("exposicion_desde")}
              />
              <FieldDescription>Desde cuándo está expuesto al agente de riesgo en su puesto.</FieldDescription>
              <FieldError errors={[errores.exposicion_desde]} />
            </Field>

            {faltan.length ? (
              <FieldSet className="gap-4 rounded-lg border p-3">
                <FieldLegend variant="label">Datos que pide la denuncia FODEP</FieldLegend>
                <FieldDescription className="-mt-2">
                  El accidente se cargó sin estos datos y la SRT los exige para la enfermedad profesional.
                </FieldDescription>
                {faltan.map((dato) =>
                  dato === "localidad_laboral_id" ? (
                    <Controller
                      key={dato}
                      control={form.control}
                      name="localidad_laboral_id"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid || undefined}>
                          <FieldLabel htmlFor={`${id}-localidad`}>Localidad del lugar de trabajo</FieldLabel>
                          <CampoLocalidad
                            id={`${id}-localidad`}
                            valor={field.value ?? null}
                            onChange={(valor) => field.onChange(valor)}
                            invalido={fieldState.invalid}
                          />
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  ) : (
                    <Field key={dato} data-invalid={!!errores[dato] || undefined}>
                      <FieldLabel htmlFor={`${id}-${dato}`}>{DATO_FODEP[dato].etiqueta}</FieldLabel>
                      {dato === "tareas" ? (
                        <Textarea
                          id={`${id}-${dato}`}
                          rows={2}
                          placeholder={DATO_FODEP[dato].placeholder}
                          aria-invalid={!!errores[dato] || undefined}
                          {...form.register(dato)}
                        />
                      ) : (
                        <Input
                          id={`${id}-${dato}`}
                          type={DATO_FODEP[dato].tipo ?? "text"}
                          placeholder={DATO_FODEP[dato].placeholder}
                          aria-invalid={!!errores[dato] || undefined}
                          {...form.register(dato)}
                        />
                      )}
                      <FieldError errors={[errores[dato]]} />
                    </Field>
                  ),
                )}
              </FieldSet>
            ) : null}

            <Field data-invalid={!!errores.observacion || undefined}>
              <FieldLabel htmlFor={`${id}-observacion`}>
                Observación <span className="font-normal text-muted-foreground">(opcional)</span>
              </FieldLabel>
              <Textarea
                id={`${id}-observacion`}
                rows={3}
                placeholder="Por qué corresponde tramitarlo como enfermedad profesional."
                aria-invalid={!!errores.observacion || undefined}
                {...form.register("observacion")}
              />
              <FieldError errors={[errores.observacion]} />
            </Field>
            <Alert>
              <SendIcon />
              <AlertTitle className="flex flex-wrap items-center gap-2">
                Comunicación con la SRT <Simulado />
              </AlertTitle>
              <AlertDescription>
                Se informa la denuncia por el Web Service FODEP y se notifica al trabajador por e-Servicios SRT y email. Si
                la SRT la rechaza, el expediente sigue como accidente y se muestran los errores.
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
          <Button type="submit" form={`${id}-form`} disabled={pendiente || sinDiagnosticos}>
            {pendiente ? <Spinner /> : null}
            Reencuadrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
