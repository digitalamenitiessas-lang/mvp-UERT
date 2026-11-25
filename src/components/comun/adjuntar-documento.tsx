"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PaperclipIcon } from "lucide-react";
import { accionAdjuntarDocumentos } from "@/app/acciones";
import { ErrorAccion } from "@/components/comun/error-accion";
import { AVISO_ARCHIVOS_DEMO, SelectorArchivos } from "@/components/comun/selector-archivos";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { TipoDenuncia } from "@/lib/dominio/constantes";
import { TIPOS_DOCUMENTO } from "@/lib/dominio/documentos";
import { esquemaDocumento } from "@/lib/esquemas";
import { plural } from "@/lib/formato";

type VarianteBoton = React.ComponentProps<typeof Button>["variant"];
type TamanoBoton = React.ComponentProps<typeof Button>["size"];

const esquema = z.object({
  expediente_id: esquemaDocumento.shape.expediente_id,
  tipo: esquemaDocumento.shape.tipo,
  archivos: z
    .array(z.object({ nombre: z.string(), tamano: z.number() }))
    .min(1, "Elegí el archivo digitalizado (podés elegir varios)."),
  observacion: esquemaDocumento.shape.observacion,
});
type Entrada = z.input<typeof esquema>;
type Salida = z.output<typeof esquema>;

/**
 * Adjuntar documentación al expediente: uno o varios archivos del mismo tipo,
 * en una o varias tandas (RNF-03). Lo usan todas las áreas que pueden sumar
 * documentación en el estado del expediente (permisos: adjuntar_documento).
 */
export function AdjuntarDocumento({
  expedienteId,
  tipoExpediente,
  faltantes = [],
  tipoInicial,
  textoBoton = "Adjuntar documento",
  variante = "outline",
  tamano = "sm",
  etiquetaAccesible,
}: {
  expedienteId: number;
  tipoExpediente: TipoDenuncia;
  /** Claves de los documentos obligatorios que faltan (se marcan en la lista). */
  faltantes?: string[];
  tipoInicial?: string;
  textoBoton?: string;
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  /** Texto para lectores de pantalla cuando el botón es corto ("Adjuntar"). */
  etiquetaAccesible?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const id = useId();
  const iniciales: Entrada = { expediente_id: expedienteId, tipo: tipoInicial ?? "", archivos: [], observacion: "" };
  const form = useForm<Entrada, unknown, Salida>({ resolver: zodResolver(esquema), defaultValues: iniciales });

  const deRecepcion = TIPOS_DOCUMENTO.filter((t) => t.exige?.[tipoExpediente]);
  const delTramite = TIPOS_DOCUMENTO.filter((t) => !t.exige?.[tipoExpediente]);

  const cambiarApertura = (a: boolean) => {
    setAbierto(a);
    if (a) form.reset(iniciales);
    else limpiarError();
  };
  const enviar = form.handleSubmit((datos) =>
    ejecutar(
      () =>
        accionAdjuntarDocumentos({
          expediente_id: datos.expediente_id,
          tipo: datos.tipo,
          observacion: datos.observacion,
          archivos: datos.archivos.map((a) => ({ nombre_archivo: a.nombre, tamano_bytes: a.tamano })),
        }),
      { alTerminar: () => cambiarApertura(false) },
    ),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" variant={variante} size={tamano} aria-label={etiquetaAccesible}>
          {variante === "link" ? null : <PaperclipIcon />}
          {textoBoton}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Adjuntar documento</DialogTitle>
            <DialogDescription>
              Elegí el tipo y los archivos digitalizados: podés sumar varios, en distintas tandas. {AVISO_ARCHIVOS_DEMO}
            </DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="tipo"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-tipo`}>Tipo de documento</FieldLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id={`${id}-tipo`} className="w-full" aria-invalid={fieldState.invalid || undefined}>
                    <SelectValue placeholder="Elegí el tipo de documento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Documentación de la recepción</SelectLabel>
                      {deRecepcion.map((t) => (
                        <SelectItem key={t.clave} value={t.clave}>
                          {t.nombre}
                          {faltantes.includes(t.clave) ? " · falta" : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Durante el trámite</SelectLabel>
                      {delTramite.map((t) => (
                        <SelectItem key={t.clave} value={t.clave}>
                          {t.nombre}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="archivos"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Archivos</FieldLabel>
                <SelectorArchivos
                  textoBoton={field.value.length ? "Agregar más archivos" : "Elegir archivos"}
                  valor={field.value}
                  onChange={field.onChange}
                />
                {field.value.length > 1 ? (
                  <FieldDescription>
                    Se adjuntan {plural(field.value.length, "archivo")} del mismo tipo de documento.
                  </FieldDescription>
                ) : null}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="observacion"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-observacion`}>Observación</FieldLabel>
                <Textarea
                  id={`${id}-observacion`}
                  {...field}
                  placeholder="Opcional: por ejemplo, quién lo presentó."
                  aria-invalid={fieldState.invalid || undefined}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <ErrorAccion error={error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pendiente}>
              {pendiente ? <Spinner /> : <PaperclipIcon />}
              Adjuntar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
