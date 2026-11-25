"use client";

import { useId, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { SquarePenIcon, StethoscopeIcon } from "lucide-react";
import { accionEvaluarDiagnostico } from "@/app/acciones";
import { CampoCatalogo } from "@/components/comun/campo-catalogo";
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
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CODIGO_EXAMEN_INFO,
  CODIGOS_EXAMEN,
  CODIGOS_EXAMEN_SIN_FODEP,
  type CodigoExamen,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";
import type { FechaISO } from "@/lib/dominio/fechas";
import { esquemaEvaluacion } from "@/lib/esquemas";
import { ListaCodigos } from "./lista-codigos";
import type { CodigoDescripto, DiagnosticoEvaluable } from "./tipos";

type Valores = z.input<typeof esquemaEvaluacion>;

/** Valor del combo para "sin código de examen" (Radix no admite ""). */
const SIN_CODIGO = "sin_codigo";
/** Lesiones y zonas por diagnóstico (esquemaEvaluacion). */
const MAXIMO = 9;

/**
 * Exámenes de detección que admite cada tipo de denuncia. En un accidente no
 * hay formulario FODEP: con los demás códigos el archivo .AD exigiría el ID_FODEP.
 */
function codigosPermitidos(tipo: TipoDenuncia): readonly CodigoExamen[] {
  return tipo === "EP" ? CODIGOS_EXAMEN : CODIGOS_EXAMEN_SIN_FODEP;
}

function valoresIniciales(dx: DiagnosticoEvaluable, tipo: TipoDenuncia, hoy: FechaISO): Valores {
  const codigo = dx.codigo_examen && codigosPermitidos(tipo).includes(dx.codigo_examen) ? dx.codigo_examen : null;
  return {
    diagnostico_id: dx.id,
    cie10_adecuado: dx.cie10_adecuado ?? "",
    patologia_constatada: dx.patologia_constatada ?? true,
    en_listado: tipo === "EP" ? dx.en_listado : null,
    fecha_diagnostico: dx.fecha_diagnostico ?? hoy,
    codigo_examen: codigo ?? (tipo === "EP" ? "F" : ""),
    observacion_medica: dx.observacion_medica ?? "",
    lesiones: dx.lesiones.map((l) => l.codigo),
    zonas: dx.zonas.map((z) => z.codigo),
  };
}

const descripciones = (lista: CodigoDescripto[]) => Object.fromEntries(lista.map((x) => [x.codigo, x.descripcion]));

/**
 * Evaluación de un diagnóstico (o revisión de una ya guardada): CIE-10
 * adecuado, patología constatada, Listado de EP, fecha y examen de detección,
 * lesiones, zonas del cuerpo y observación médica.
 */
export function DialogoEvaluarDiagnostico({
  diagnostico: dx,
  tipo,
  hoy,
}: {
  diagnostico: DiagnosticoEvaluable;
  tipo: TipoDenuncia;
  hoy: FechaISO;
}) {
  const id = useId();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const esEP = tipo === "EP";
  const evaluado = dx.estado === "evaluado";

  // Además del esquema común: lo que el servidor exige según el tipo de denuncia.
  const esquema = useMemo(
    () =>
      esquemaEvaluacion.superRefine((d, ctx) => {
        if (!esEP && d.lesiones.length === 0) {
          ctx.addIssue({ code: "custom", path: ["lesiones"], message: "En un accidente indicá al menos una lesión" });
        }
        if (d.codigo_examen && !codigosPermitidos(tipo).includes(d.codigo_examen)) {
          ctx.addIssue({
            code: "custom",
            path: ["codigo_examen"],
            message: `En un accidente solo corresponden ${CODIGOS_EXAMEN_SIN_FODEP.join(", ")} o sin indicar`,
          });
        }
        if (esEP && d.en_listado === null) {
          ctx.addIssue({
            code: "custom",
            path: ["en_listado"],
            message: "Indicá si la patología está incluida en el Listado",
          });
        }
      }),
    [esEP, tipo],
  );

  const form = useForm({ resolver: zodResolver(esquema), defaultValues: valoresIniciales(dx, tipo, hoy) });
  const errores = form.formState.errors;

  function cambiar(a: boolean) {
    if (a) {
      form.reset(valoresIniciales(dx, tipo, hoy));
      limpiarError();
    }
    setAbierto(a);
  }

  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionEvaluarDiagnostico(datos), { alTerminar: () => setAbierto(false) }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiar}>
      <DialogTrigger asChild>
        <Button size="sm" variant={evaluado ? "outline" : "default"}>
          {evaluado ? <SquarePenIcon /> : <StethoscopeIcon />}
          {evaluado ? "Revisar evaluación" : "Evaluar"}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-4 pr-12">
          <DialogTitle>
            {evaluado ? "Revisar la evaluación del diagnóstico" : "Evaluar el diagnóstico"} {dx.orden}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="flex flex-col gap-0.5">
              <span>
                Invocado: <span className="font-mono font-semibold text-foreground">{dx.cie10}</span> · {dx.cie10_descripcion}
              </span>
              {esEP && dx.agente_causante ? (
                <span>
                  Agente causante: <span className="font-mono">{dx.agente_causante}</span>
                  {dx.agente_descripcion ? ` · ${dx.agente_descripcion}` : null}
                </span>
              ) : null}
            </div>
          </DialogDescription>
        </DialogHeader>

        <form id={`${id}-form`} noValidate onSubmit={enviar} className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <FieldGroup>
            <Controller
              control={form.control}
              name="cie10_adecuado"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${id}-cie10`}>
                    CIE-10 adecuado <span className="font-normal text-muted-foreground">(opcional)</span>
                  </FieldLabel>
                  <CampoCatalogo
                    id={`${id}-cie10`}
                    catalogo="cie10"
                    valor={field.value || null}
                    onChange={(codigo) => field.onChange(codigo ?? "")}
                    placeholder="Se mantiene el código invocado"
                    invalido={fieldState.invalid}
                  />
                  <FieldDescription>
                    Adecuación CIE-10, Res. SRT 475/17. Completalo solo si corresponde un código más preciso que el invocado.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="patologia_constatada"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel htmlFor={`${id}-constatada`}>Patología constatada</FieldLabel>
                    <FieldDescription>El examen confirma la patología denunciada.</FieldDescription>
                  </FieldContent>
                  <Switch id={`${id}-constatada`} checked={field.value} onCheckedChange={field.onChange} />
                </Field>
              )}
            />

            {esEP ? (
              <Controller
                control={form.control}
                name="en_listado"
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid || undefined} className="gap-3">
                    <FieldLegend variant="label">
                      ¿Incluida en el Listado de Enfermedades Profesionales (Decreto 658/96)?
                    </FieldLegend>
                    <RadioGroup
                      value={field.value === null ? "" : field.value ? "si" : "no"}
                      onValueChange={(v) => field.onChange(v === "si")}
                      aria-invalid={fieldState.invalid || undefined}
                      className="flex flex-wrap gap-6"
                    >
                      <Field orientation="horizontal" className="w-auto">
                        <RadioGroupItem value="si" id={`${id}-listado-si`} />
                        <FieldLabel htmlFor={`${id}-listado-si`} className="font-normal">
                          Sí, está incluida
                        </FieldLabel>
                      </Field>
                      <Field orientation="horizontal" className="w-auto">
                        <RadioGroupItem value="no" id={`${id}-listado-no`} />
                        <FieldLabel htmlFor={`${id}-listado-no`} className="font-normal">
                          No está incluida
                        </FieldLabel>
                      </Field>
                    </RadioGroup>
                    <FieldDescription>
                      Si no está incluida, el Área legal puede rechazarla (motivo L) y el trabajador puede instar el trámite
                      ante la Comisión Médica.
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </FieldSet>
                )}
              />
            ) : null}

            <div className="grid gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errores.fecha_diagnostico || undefined}>
                <FieldLabel htmlFor={`${id}-fecha`}>Fecha de diagnóstico</FieldLabel>
                <Input
                  id={`${id}-fecha`}
                  type="date"
                  max={hoy}
                  aria-invalid={!!errores.fecha_diagnostico || undefined}
                  {...form.register("fecha_diagnostico")}
                />
                <FieldError errors={[errores.fecha_diagnostico]} />
              </Field>
              <Controller
                control={form.control}
                name="codigo_examen"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor={`${id}-examen`}>Examen de detección</FieldLabel>
                    <Select
                      value={field.value || SIN_CODIGO}
                      onValueChange={(v) => field.onChange(v === SIN_CODIGO ? "" : v)}
                    >
                      <SelectTrigger id={`${id}-examen`} className="w-full" aria-invalid={fieldState.invalid || undefined}>
                        <SelectValue placeholder="Elegí el examen" />
                      </SelectTrigger>
                      <SelectContent>
                        {!esEP ? <SelectItem value={SIN_CODIGO}>Sin indicar</SelectItem> : null}
                        {codigosPermitidos(tipo).map((c) => (
                          <SelectItem key={c} value={c}>
                            <span className="w-3 font-mono text-xs font-semibold">{c}</span>
                            {CODIGO_EXAMEN_INFO[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription>
                      {esEP
                        ? "En la denuncia FODEP corresponde “F”."
                        : "En un accidente solo corresponden los exámenes laborales (P, R, E, A o T): los demás exigen un formulario FODEP."}
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <Controller
              control={form.control}
              name="lesiones"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${id}-lesion`}>
                    Lesiones
                    {esEP ? <span className="font-normal text-muted-foreground">(opcional)</span> : null}
                  </FieldLabel>
                  <ListaCodigos
                    id={`${id}-lesion`}
                    catalogo="lesion"
                    valor={field.value}
                    onChange={field.onChange}
                    descripciones={descripciones(dx.lesiones)}
                    maximo={MAXIMO}
                    nombre="lesión"
                    placeholder="Agregar una lesión…"
                    invalido={fieldState.invalid}
                  />
                  <FieldDescription>
                    Naturaleza de la lesión según la tabla de la SRT
                    {esEP ? "" : ": en un accidente, al menos una"}. Hasta {MAXIMO}.
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="zonas"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid || undefined}>
                  <FieldLabel htmlFor={`${id}-zona`}>Zonas del cuerpo</FieldLabel>
                  <ListaCodigos
                    id={`${id}-zona`}
                    catalogo="zona_cuerpo"
                    valor={field.value}
                    onChange={field.onChange}
                    descripciones={descripciones(dx.zonas)}
                    maximo={MAXIMO}
                    nombre="zona"
                    placeholder="Agregar una zona del cuerpo…"
                    invalido={fieldState.invalid}
                  />
                  <FieldDescription>Al menos una. Hasta {MAXIMO}.</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Field data-invalid={!!errores.observacion_medica || undefined}>
              <FieldLabel htmlFor={`${id}-observacion`}>Observación médica</FieldLabel>
              <Textarea
                id={`${id}-observacion`}
                rows={3}
                placeholder="Hallazgos del examen y estudios que respaldan la evaluación."
                aria-invalid={!!errores.observacion_medica || undefined}
                {...form.register("observacion_medica")}
              />
              <FieldError errors={[errores.observacion_medica]} />
            </Field>
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
            {evaluado ? "Guardar cambios" : "Guardar evaluación"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
