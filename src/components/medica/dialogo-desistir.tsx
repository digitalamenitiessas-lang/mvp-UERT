"use client";

import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BanIcon, TriangleAlertIcon } from "lucide-react";
import { accionDesistir } from "@/app/acciones";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { TipoDenuncia } from "@/lib/dominio/constantes";
import { esquemaDesistir } from "@/lib/esquemas";

/** Además del esquema común: el Área médica deja asentada la inconsistencia. */
const esquema = esquemaDesistir.refine((d) => d.observacion.length > 0, {
  path: ["observacion"],
  message: "Detallá la inconsistencia: queda en el historial del expediente",
});

/**
 * Desistimiento por inconsistencia en el diagnóstico (Asentamiento de
 * Actuaciones Previas): no es un rechazo ni habilita la Comisión Médica.
 */
export function DialogoDesistir({ expedienteId, tipo }: { expedienteId: number; tipo: TipoDenuncia }) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const iniciales = { expediente_id: expedienteId, motivo: "inconsistencia_diagnostico" as const, observacion: "" };
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
    ejecutar(() => accionDesistir(datos), { alTerminar: () => setAbierto(false) }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-auto min-h-7 justify-start py-1 text-left whitespace-normal text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <BanIcon />
          Desistir por inconsistencia en el diagnóstico
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Desistir por inconsistencia en el diagnóstico</DialogTitle>
          <DialogDescription>
            El expediente queda Desistido (Asentamiento de Actuaciones Previas). No es un rechazo y no habilita la Comisión
            Médica.
          </DialogDescription>
        </DialogHeader>
        <form id={`${id}-form`} noValidate onSubmit={enviar}>
          <FieldGroup>
            <Field data-invalid={!!errores.observacion || undefined}>
              <FieldLabel htmlFor={`${id}-observacion`}>Inconsistencia detectada</FieldLabel>
              <Textarea
                id={`${id}-observacion`}
                rows={4}
                placeholder="Por ejemplo: los estudios presentados no se corresponden con el diagnóstico invocado."
                aria-invalid={!!errores.observacion || undefined}
                {...form.register("observacion")}
              />
              <FieldDescription>Queda en el historial del expediente.</FieldDescription>
              <FieldError errors={[errores.observacion]} />
            </Field>
            <Alert className="border-amber-300 bg-amber-50 text-amber-900">
              <TriangleAlertIcon />
              <AlertTitle className="flex flex-wrap items-center gap-2">
                Se notifica al trabajador <Simulado />
              </AlertTitle>
              <AlertDescription className="text-amber-900/90">
                Por e-Servicios SRT y email.
                {tipo === "EP" ? " Además se informa el desistimiento a la SRT por el Web Service FODEP." : null} No se
                puede deshacer.
              </AlertDescription>
            </Alert>
          </FieldGroup>
        </form>
        <ErrorAccion error={error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={pendiente}>
              Cancelar
            </Button>
          </DialogClose>
          <Button type="submit" form={`${id}-form`} variant="destructive" disabled={pendiente}>
            {pendiente ? <Spinner /> : <BanIcon />}
            Desistir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
