"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BellRingIcon, PlusIcon } from "lucide-react";
import { accionAgregarDiagnostico } from "@/app/acciones";
import { Simulado } from "@/components/comun/badges";
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
import { Spinner } from "@/components/ui/spinner";
import { MAX_DIAGNOSTICOS_EP, type TipoDenuncia } from "@/lib/dominio/constantes";
import { esquemaAgregarDiagnostico } from "@/lib/esquemas";

/**
 * Agrega un diagnóstico que no se invocó en la denuncia. En EP lleva agente
 * causante y la denuncia admite hasta 10 (WS FODEP, error FO23).
 */
export function DialogoAgregarDiagnostico({
  expedienteId,
  tipo,
  cantidad,
}: {
  expedienteId: number;
  tipo: TipoDenuncia;
  /** Diagnósticos que ya tiene la denuncia. */
  cantidad: number;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const esEP = tipo === "EP";
  const completo = esEP && cantidad >= MAX_DIAGNOSTICOS_EP;

  const esquema = useMemo(
    () =>
      esquemaAgregarDiagnostico.superRefine((d, ctx) => {
        if (esEP && !d.agente_causante) {
          ctx.addIssue({ code: "custom", path: ["agente_causante"], message: "Elegí el agente causante" });
        }
      }),
    [esEP],
  );
  const iniciales = { expediente_id: expedienteId, cie10: "", agente_causante: "" };
  const form = useForm({ resolver: zodResolver(esquema), defaultValues: iniciales });

  function cambiar(a: boolean) {
    if (a) {
      form.reset(iniciales);
      limpiarError();
    }
    setAbierto(a);
  }

  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionAgregarDiagnostico(datos), { alTerminar: () => setAbierto(false) }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={completo}>
          <PlusIcon />
          Agregar diagnóstico
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar diagnóstico</DialogTitle>
          <DialogDescription>
            Para una patología que no figura en la denuncia. Queda pendiente de evaluación como los demás.
          </DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={enviar}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="cie10"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${id}-cie10`}>Diagnóstico CIE-10</FieldLabel>
                  <CampoCatalogo
                    id={`${id}-cie10`}
                    catalogo="cie10"
                    valor={field.value || null}
                    onChange={(codigo) => field.onChange(codigo ?? "")}
                    placeholder="Buscá por código o por palabras…"
                    invalido={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            {esEP ? (
              <Controller
                control={form.control}
                name="agente_causante"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor={`${id}-agente`}>Agente causante</FieldLabel>
                    <CampoCatalogo
                      id={`${id}-agente`}
                      catalogo="agente_causante"
                      valor={field.value || null}
                      onChange={(codigo) => field.onChange(codigo ?? "")}
                      placeholder="Elegí el agente de riesgo…"
                      invalido={fieldState.invalid}
                    />
                    <FieldDescription>
                      La denuncia tiene {cantidad} de {MAX_DIAGNOSTICOS_EP} diagnósticos posibles.
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            ) : null}
            {esEP ? (
              <Alert>
                <BellRingIcon />
                <AlertTitle className="flex flex-wrap items-center gap-2">
                  Patología detectada en la evaluación <Simulado />
                </AlertTitle>
                <AlertDescription>
                  Una patología detectada en la evaluación se notifica al trabajador (e-Servicios SRT) y al empleador
                  (Ventanilla Electrónica), y se suma al formulario FODEP de la SRT (Anexo II pto. 3.6).
                </AlertDescription>
              </Alert>
            ) : null}
          </FieldGroup>
        </form>
        <ErrorAccion error={error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pendiente}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" form={`${id}-form`} disabled={pendiente}>
            {pendiente ? <Spinner /> : null}
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
