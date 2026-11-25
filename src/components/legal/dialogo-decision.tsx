"use client";

import { useState } from "react";
import { Controller, useForm, useWatch, type DefaultValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CircleCheckIcon, CircleXIcon, GavelIcon, TriangleAlertIcon } from "lucide-react";
import { accionAdjuntarDocumento, accionDecidirDiagnostico } from "@/app/acciones";
import { Etiqueta } from "@/components/comun/badges";
import { ErrorAccion } from "@/components/comun/error-accion";
import { SelectorArchivos, type ArchivoElegido } from "@/components/comun/selector-archivos";
import { useAccion } from "@/components/comun/use-accion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  MOTIVO_RECHAZO_INFO,
  type EstadoDiagnostico,
  type MotivoRechazo,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";
import { esquemaDecision } from "@/lib/esquemas";
import { CLASE_MOTIVO } from "./motivos";

type Entrada = z.input<typeof esquemaDecision>;
type Salida = z.output<typeof esquemaDecision>;

/** Lo que el diálogo necesita del diagnóstico (todo serializable). */
export interface DiagnosticoParaDecidir {
  id: number;
  orden: number;
  /** Código CIE-10 vigente (el adecuado por el área médica o, si no hay, el invocado). */
  codigo: string;
  descripcion: string;
  estado: EstadoDiagnostico;
  motivo_rechazo: MotivoRechazo | null;
  fundamento: string | null;
  estudios: string | null;
  cymat_adjunto: boolean | null;
  en_listado: boolean | null;
  patologia_constatada: boolean | null;
}

function valoresIniciales(
  d: DiagnosticoParaDecidir,
  motivos: MotivoRechazo[],
  cymatEnExpediente: boolean,
): DefaultValues<Entrada> {
  const motivo = d.motivo_rechazo && motivos.includes(d.motivo_rechazo) ? d.motivo_rechazo : "";
  return {
    diagnostico_id: d.id,
    decision: d.estado === "aceptado" || d.estado === "rechazado" ? d.estado : undefined,
    motivo_rechazo: motivo || (motivos.length === 1 ? motivos[0] : ""),
    fundamento: d.fundamento ?? "",
    estudios: d.estudios ?? "",
    // Sin el relevamiento en el expediente, hay que elegir el archivo de nuevo
    cymat_adjunto: d.cymat_adjunto === true && cymatEnExpediente,
  };
}

/**
 * Aceptar o rechazar un diagnóstico (RF-47 a RF-49). Al rechazar se elige el
 * motivo que corresponde al expediente y se fundamenta; con P se precisan los
 * estudios y con E se adjunta el relevamiento CYMAT (el archivo, si el
 * expediente todavía no lo tiene).
 */
export function DialogoDecision({
  expedienteId,
  diagnostico,
  motivos,
  tipo,
  cymatEnExpediente,
}: {
  expedienteId: number;
  diagnostico: DiagnosticoParaDecidir;
  motivos: MotivoRechazo[];
  tipo: TipoDenuncia;
  cymatEnExpediente: boolean;
}) {
  const d = diagnostico;
  const [abierto, setAbierto] = useState(false);
  const [cymat, setCymat] = useState<ArchivoElegido[]>([]);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const form = useForm<Entrada, unknown, Salida>({
    resolver: zodResolver(esquemaDecision),
    defaultValues: valoresIniciales(d, motivos, cymatEnExpediente),
  });
  const { errors } = form.formState;
  const decision = useWatch({ control: form.control, name: "decision" });
  const motivo = useWatch({ control: form.control, name: "motivo_rechazo" });
  const rechaza = decision === "rechazado";
  const decidido = d.estado === "aceptado" || d.estado === "rechazado";
  const pref = `decision-${d.id}`;

  const avisos: string[] = [];
  if (tipo === "EP" && d.en_listado === false) {
    avisos.push("Según el área médica, la patología no figura en el Listado de Enfermedades Profesionales (Decreto N° 658/96).");
  }
  if (d.patologia_constatada === false) avisos.push("El área médica no constató la patología invocada.");

  const enviar = form.handleSubmit((v) => {
    const r = v.decision === "rechazado";
    const archivoCymat = r && v.motivo_rechazo === "E" && !cymatEnExpediente ? cymat[0] : undefined;
    ejecutar(
      async () => {
        // Primero el relevamiento CYMAT a la documentación del expediente; después, la decisión.
        if (archivoCymat) {
          const adjunto = await accionAdjuntarDocumento({
            expediente_id: expedienteId,
            tipo: "cymat",
            nombre_archivo: archivoCymat.nombre,
            tamano_bytes: archivoCymat.tamano,
            observacion: `Adjuntado al rechazar el diagnóstico ${d.orden} por ausencia de exposición.`,
          });
          if (!adjunto.ok) return adjunto;
        }
        return accionDecidirDiagnostico({
          diagnostico_id: v.diagnostico_id,
          decision: v.decision,
          motivo_rechazo: r ? v.motivo_rechazo : "",
          fundamento: r ? v.fundamento : "",
          estudios: r && v.motivo_rechazo === "P" ? v.estudios : "",
          cymat_adjunto: r && v.motivo_rechazo === "E" ? v.cymat_adjunto : false,
        });
      },
      {
        exito: r ? `Diagnóstico ${d.orden} rechazado` : `Diagnóstico ${d.orden} aceptado`,
        alTerminar: () => setAbierto(false),
      },
    );
  });

  return (
    <Dialog
      open={abierto}
      onOpenChange={(a) => {
        if (pendiente) return;
        if (a) {
          form.reset(valoresIniciales(d, motivos, cymatEnExpediente));
          setCymat([]);
          limpiarError();
        }
        setAbierto(a);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant={decidido ? "outline" : "default"}>
          <GavelIcon />
          {decidido ? "Cambiar decisión" : "Decidir"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Decisión sobre el diagnóstico {d.orden}</DialogTitle>
            <DialogDescription>
              <span className="font-mono font-medium text-foreground">{d.codigo}</span> · {d.descripcion}
            </DialogDescription>
          </DialogHeader>

          <div className="-mx-4 max-h-[min(62vh,36rem)] overflow-y-auto px-4 py-1">
            <FieldGroup className="gap-5">
              {avisos.length ? (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <ul className="space-y-0.5">
                    {avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <Controller
                control={form.control}
                name="decision"
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid || undefined}>
                    <FieldLegend variant="label">Decisión</FieldLegend>
                    <RadioGroup
                      name={field.name}
                      value={field.value ?? ""}
                      onValueChange={(v) => {
                        field.onChange(v);
                        if (v === "rechazado" && !form.getValues("motivo_rechazo") && motivos.length === 1) {
                          form.setValue("motivo_rechazo", motivos[0]);
                        }
                      }}
                      className="grid-cols-1 sm:grid-cols-2"
                      aria-invalid={fieldState.invalid || undefined}
                    >
                      <FieldLabel htmlFor={`${pref}-aceptado`}>
                        <Field orientation="horizontal">
                          <RadioGroupItem value="aceptado" id={`${pref}-aceptado`} />
                          <FieldContent>
                            <FieldTitle>
                              <CircleCheckIcon className="size-4 text-green-700" aria-hidden />
                              Aceptar
                            </FieldTitle>
                            <FieldDescription className="text-xs">
                              Se reconoce el carácter laboral del diagnóstico.
                            </FieldDescription>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                      <FieldLabel htmlFor={`${pref}-rechazado`}>
                        <Field orientation="horizontal">
                          <RadioGroupItem value="rechazado" id={`${pref}-rechazado`} />
                          <FieldContent>
                            <FieldTitle>
                              <CircleXIcon className="size-4 text-red-700" aria-hidden />
                              Rechazar
                            </FieldTitle>
                            <FieldDescription className="text-xs">
                              Con motivo y fundamento: se notifica al trabajador.
                            </FieldDescription>
                          </FieldContent>
                        </Field>
                      </FieldLabel>
                    </RadioGroup>
                    {fieldState.invalid ? <FieldError>Elegí si aceptás o rechazás el diagnóstico.</FieldError> : null}
                  </FieldSet>
                )}
              />

              {rechaza ? (
                <>
                  <Controller
                    control={form.control}
                    name="motivo_rechazo"
                    render={({ field, fieldState }) => (
                      <FieldSet data-invalid={fieldState.invalid || undefined}>
                        <FieldLegend variant="label">Motivo del rechazo</FieldLegend>
                        <FieldDescription className="text-xs">
                          {motivos.length === 1
                            ? "Es el único motivo que corresponde a este expediente."
                            : "Se muestran los motivos que corresponden a este expediente."}
                        </FieldDescription>
                        <RadioGroup
                          name={field.name}
                          value={field.value}
                          onValueChange={field.onChange}
                          aria-invalid={fieldState.invalid || undefined}
                        >
                          {motivos.map((m) => {
                            const info = MOTIVO_RECHAZO_INFO[m];
                            return (
                              <FieldLabel key={m} htmlFor={`${pref}-motivo-${m}`}>
                                <Field orientation="horizontal">
                                  <RadioGroupItem value={m} id={`${pref}-motivo-${m}`} />
                                  <FieldContent>
                                    <FieldTitle>
                                      <Etiqueta className={CLASE_MOTIVO}>{m}</Etiqueta>
                                      {info.nombre}
                                    </FieldTitle>
                                    <FieldDescription className="text-xs">{info.detalle}</FieldDescription>
                                  </FieldContent>
                                </Field>
                              </FieldLabel>
                            );
                          })}
                        </RadioGroup>
                        <FieldError errors={[fieldState.error]} />
                      </FieldSet>
                    )}
                  />

                  <Field data-invalid={!!errors.fundamento || undefined}>
                    <FieldLabel htmlFor={`${pref}-fundamento`}>Fundamento</FieldLabel>
                    <Textarea
                      id={`${pref}-fundamento`}
                      rows={4}
                      className="min-h-24"
                      placeholder="Explicá por qué se rechaza: se transcribe en la notificación al trabajador."
                      aria-invalid={!!errors.fundamento || undefined}
                      {...form.register("fundamento")}
                    />
                    <FieldError errors={[errors.fundamento]} />
                  </Field>

                  {motivo === "P" ? (
                    <Field data-invalid={!!errors.estudios || undefined}>
                      <FieldLabel htmlFor={`${pref}-estudios`}>
                        Estudios en que se basa (Anexo III, estudios mínimos)
                      </FieldLabel>
                      <Textarea
                        id={`${pref}-estudios`}
                        rows={3}
                        placeholder="Detallá cada estudio, con su fecha y resultado."
                        aria-invalid={!!errors.estudios || undefined}
                        {...form.register("estudios")}
                      />
                      <FieldDescription className="text-xs">
                        Obligatorio para rechazar por ausencia de patología según los exámenes practicados.
                      </FieldDescription>
                      <FieldError errors={[errors.estudios]} />
                    </Field>
                  ) : null}

                  {motivo === "E" && cymatEnExpediente ? (
                    <Controller
                      control={form.control}
                      name="cymat_adjunto"
                      render={({ field, fieldState }) => (
                        <Field orientation="horizontal" data-invalid={fieldState.invalid || undefined}>
                          <Checkbox
                            id={`${pref}-cymat`}
                            name={field.name}
                            checked={field.value === true}
                            onCheckedChange={(c) => field.onChange(c === true)}
                            onBlur={field.onBlur}
                            aria-invalid={fieldState.invalid || undefined}
                          />
                          <FieldContent>
                            <FieldLabel htmlFor={`${pref}-cymat`}>Se adjunta el relevamiento CYMAT</FieldLabel>
                            <FieldDescription className="text-xs">
                              Obligatorio para rechazar por ausencia de exposición (Anexo II pto. 5.1.a). El relevamiento
                              ya figura en la documentación del expediente.
                            </FieldDescription>
                            <FieldError errors={[fieldState.error]} />
                          </FieldContent>
                        </Field>
                      )}
                    />
                  ) : motivo === "E" ? (
                    <Controller
                      control={form.control}
                      name="cymat_adjunto"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid || undefined}>
                          <FieldLabel>Relevamiento CYMAT</FieldLabel>
                          <SelectorArchivos
                            multiple={false}
                            aviso
                            textoBoton={cymat.length ? "Cambiar archivo" : "Elegir el archivo"}
                            etiqueta="Elegir el archivo del relevamiento CYMAT"
                            valor={cymat}
                            onChange={(archivos) => {
                              setCymat(archivos);
                              field.onChange(archivos.length > 0);
                            }}
                          />
                          <FieldDescription className="text-xs">
                            Obligatorio para rechazar por ausencia de exposición (Anexo II pto. 5.1.a). Queda en la
                            documentación del expediente y se adjunta a la notificación.
                          </FieldDescription>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                  ) : null}
                </>
              ) : null}
            </FieldGroup>
          </div>

          <ErrorAccion error={error} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pendiente}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pendiente} variant={rechaza ? "destructive" : "default"}>
              {pendiente ? <Spinner /> : <GavelIcon />}
              {rechaza ? "Rechazar diagnóstico" : decision === "aceptado" ? "Aceptar diagnóstico" : "Guardar decisión"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
