"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CalendarCheckIcon, CalendarPlusIcon, FileIcon, PlusIcon, XIcon } from "lucide-react";
import { accionRegistrarPresentacion } from "@/app/acciones";
import { Simulado } from "@/components/comun/badges";
import { ErrorAccion } from "@/components/comun/error-accion";
import { SelectorArchivos } from "@/components/comun/selector-archivos";
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
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { PLAZOS } from "@/lib/dominio/constantes";
import { TIPOS_DOCUMENTO, TIPO_DOCUMENTO_POR_CLAVE } from "@/lib/dominio/documentos";
import { esFechaISO, formatoFechaLarga, sumarDias, type FechaISO } from "@/lib/dominio/fechas";
import { esquemaPresentacion } from "@/lib/esquemas";
import { formatoTamano } from "@/lib/formato";

type Entrada = z.input<typeof esquemaPresentacion>;
type Salida = z.output<typeof esquemaPresentacion>;

/** Atajos para armar el detalle sin tipearlo todo. */
const ATAJOS = [
  { etiqueta: "Certificado de control", texto: "Presenta certificado médico de control" },
  { etiqueta: "Estudios", texto: "Adjunta estudios complementarios" },
  { etiqueta: "Pedido de kinesiología", texto: "Pedido de sesiones de kinesiología" },
  { etiqueta: "Cirugía", texto: "Indicación de cirugía" },
  { etiqueta: "Prótesis", texto: "Pedido de prótesis" },
] as const;

/** Tipos de documento que suelen llegar durante la licencia: van primero en la lista. */
const CLAVES_LICENCIA = ["certificado_control", "orden_practicas", "estudios", "certificado_medico"];
const TIPOS_LICENCIA = CLAVES_LICENCIA.map((c) => TIPO_DOCUMENTO_POR_CLAVE[c]).filter((t) => t !== undefined);
const TIPOS_OTROS = TIPOS_DOCUMENTO.filter((t) => !CLAVES_LICENCIA.includes(t.clave));
const TIPO_POR_DEFECTO = "certificado_control";

/** Próxima presentación sugerida, en días corridos desde la presentación. */
const DIAS_SUGERIDOS = PLAZOS.primeraPresentacionDias;

/**
 * Registrar una presentación de la licencia (RF-13, RF-14, RF-16): fecha,
 * detalle, documentos y la próxima presentación, que se notifica al
 * trabajador (simulado).
 */
export function DialogoPresentacion({
  expedienteId,
  numero,
  trabajador,
  hoy,
  compacto = false,
}: {
  expedienteId: number;
  numero: string;
  trabajador: string;
  /** Hoy en Argentina ('YYYY-MM-DD'), calculado en el servidor. */
  hoy: FechaISO;
  /** Botón chico, para usar dentro de una tabla. */
  compacto?: boolean;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();

  const esquema = useMemo(
    () =>
      esquemaPresentacion.superRefine((d, ctx) => {
        if (d.fecha > hoy) ctx.addIssue({ code: "custom", path: ["fecha"], message: "No puede ser posterior a hoy" });
        if (d.proxima_fecha && d.proxima_fecha <= hoy) {
          ctx.addIssue({ code: "custom", path: ["proxima_fecha"], message: "Tiene que ser posterior a hoy" });
        }
      }),
    [hoy],
  );

  const iniciales = (): Entrada => ({
    expediente_id: expedienteId,
    fecha: hoy,
    detalle: "",
    proxima_fecha: sumarDias(hoy, DIAS_SUGERIDOS),
    documentos: [],
  });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    reset,
    formState: { errors },
  } = useForm<Entrada, unknown, Salida>({ resolver: zodResolver(esquema), defaultValues: iniciales() });
  const documentos = useFieldArray({ control, name: "documentos" });
  const fecha = useWatch({ control, name: "fecha" });
  const proxima = useWatch({ control, name: "proxima_fecha" });

  function cambiarAbierto(valor: boolean) {
    if (valor) {
      reset(iniciales());
      limpiarError();
    }
    setAbierto(valor);
  }

  function sumarAtajo(texto: string) {
    const actual = getValues("detalle").trim().replace(/[\s.;,]+$/, "");
    setValue("detalle", actual ? `${actual}. ${texto}` : texto, {
      shouldDirty: true,
      shouldValidate: Boolean(errors.detalle),
    });
  }

  /** Próxima presentación a `dias` de la presentación (y siempre después de hoy). */
  function proximaEn(dias: number) {
    const base = esFechaISO(fecha) && fecha <= hoy ? fecha : hoy;
    let sugerida = sumarDias(base, dias);
    if (sugerida <= hoy) sugerida = sumarDias(hoy, dias);
    setValue("proxima_fecha", sugerida, { shouldDirty: true, shouldValidate: true });
  }

  const enviar = handleSubmit((d) =>
    ejecutar(() => accionRegistrarPresentacion({ ...d, detalle: d.detalle.replace(/[\s.]+$/, "") }), {
      alTerminar: () => setAbierto(false),
    }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiarAbierto}>
      <DialogTrigger asChild>
        {compacto ? (
          <Button variant="outline" size="sm">
            <CalendarPlusIcon />
            Registrar
          </Button>
        ) : (
          <Button>
            <CalendarPlusIcon />
            Registrar presentación
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar presentación</DialogTitle>
          <DialogDescription>
            Expediente <span className="font-mono">{numero}</span> · {trabajador}. Queda constancia del control y se fija la
            próxima presentación.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} noValidate className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4 py-1">
            <FieldGroup>
              <Field data-invalid={errors.fecha ? true : undefined} className="sm:max-w-56">
                <FieldLabel htmlFor={`${id}-fecha`}>Fecha de la presentación</FieldLabel>
                <Input
                  id={`${id}-fecha`}
                  type="date"
                  max={hoy}
                  aria-invalid={errors.fecha ? true : undefined}
                  {...register("fecha")}
                />
                <FieldError errors={[errors.fecha]} />
              </Field>

              <Field data-invalid={errors.detalle ? true : undefined}>
                <FieldLabel htmlFor={`${id}-detalle`}>Detalle</FieldLabel>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Atajos para sumar al detalle">
                  {ATAJOS.map((a) => (
                    <Button
                      key={a.etiqueta}
                      type="button"
                      variant="outline"
                      size="xs"
                      className="text-foreground"
                      onClick={() => sumarAtajo(a.texto)}
                    >
                      <PlusIcon />
                      {a.etiqueta}
                    </Button>
                  ))}
                </div>
                <Textarea
                  id={`${id}-detalle`}
                  rows={3}
                  placeholder="Qué presentó, qué indicó el médico tratante, cómo sigue el tratamiento…"
                  aria-invalid={errors.detalle ? true : undefined}
                  {...register("detalle")}
                />
                <FieldDescription>Los atajos suman el texto al final; después podés editarlo.</FieldDescription>
                <FieldError errors={[errors.detalle]} />
              </Field>

              <FieldSet className="gap-2">
                <FieldLegend variant="label">Documentos</FieldLegend>
                <FieldDescription>Elegí los archivos que trajo y, para cada uno, el tipo de documento.</FieldDescription>
                <SelectorArchivos
                  valor={[]}
                  aviso
                  textoBoton={documentos.fields.length ? "Agregar más archivos" : "Elegir archivos"}
                  onChange={(nuevos) =>
                    documentos.append(
                      nuevos.map((a) => ({ tipo: TIPO_POR_DEFECTO, nombre_archivo: a.nombre, tamano_bytes: a.tamano })),
                    )
                  }
                />
                {documentos.fields.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {documentos.fields.map((doc, i) => (
                      <li
                        key={doc.id}
                        className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 truncate text-sm">{doc.nombre_archivo}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{formatoTamano(doc.tamano_bytes)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Controller
                            control={control}
                            name={`documentos.${i}.tipo`}
                            render={({ field }) => (
                              <Select value={field.value} onValueChange={field.onChange}>
                                <SelectTrigger
                                  size="sm"
                                  className="w-full min-w-0 sm:w-60"
                                  aria-label={`Tipo de documento de ${doc.nombre_archivo}`}
                                >
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent position="popper">
                                  <SelectGroup>
                                    <SelectLabel>Durante la licencia</SelectLabel>
                                    {TIPOS_LICENCIA.map((t) => (
                                      <SelectItem key={t.clave} value={t.clave}>
                                        {t.nombre}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                  <SelectGroup>
                                    <SelectLabel>Otros documentos</SelectLabel>
                                    {TIPOS_OTROS.map((t) => (
                                      <SelectItem key={t.clave} value={t.clave}>
                                        {t.nombre}
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Quitar ${doc.nombre_archivo}`}
                            onClick={() => documentos.remove(i)}
                          >
                            <XIcon />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </FieldSet>

              <Field data-invalid={errors.proxima_fecha ? true : undefined}>
                <FieldLabel htmlFor={`${id}-proxima`}>Próxima presentación</FieldLabel>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id={`${id}-proxima`}
                    type="date"
                    min={sumarDias(hoy, 1)}
                    className="w-auto"
                    aria-invalid={errors.proxima_fecha ? true : undefined}
                    {...register("proxima_fecha")}
                  />
                  <div className="flex gap-1" role="group" aria-label="Sugerir la próxima presentación">
                    {[7, DIAS_SUGERIDOS, 30].map((n) => (
                      <Button
                        key={n}
                        type="button"
                        variant="outline"
                        size="xs"
                        className="text-foreground"
                        onClick={() => proximaEn(n)}
                      >
                        +{n} días
                      </Button>
                    ))}
                  </div>
                </div>
                <FieldDescription>
                  {esFechaISO(proxima) ? <span className="text-foreground">Cae el {formatoFechaLarga(proxima)}. </span> : null}
                  Sugerimos {DIAS_SUGERIDOS} días después de la presentación. Se le avisa al trabajador <Simulado />. Dejala
                  vacía si no hace falta otra presentación.
                </FieldDescription>
                <FieldError errors={[errors.proxima_fecha]} />
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
              {pendiente ? <Spinner /> : <CalendarCheckIcon />}
              Registrar presentación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
