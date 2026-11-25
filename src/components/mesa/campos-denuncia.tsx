"use client";

import { createContext, useCallback, useContext, useId } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { LockIcon } from "lucide-react";
import { CampoCatalogo } from "@/components/comun/campo-catalogo";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Catalogo } from "@/lib/datos/catalogos";
import { cn } from "@/lib/utils";
import { CampoLocalidad } from "./campo-localidad";
import { claveEtiqueta, type Entrada } from "./modelo";

// ---------------------------------------------------------------------------
// Descripciones de catálogo ya conocidas (para el resumen antes de registrar)
// ---------------------------------------------------------------------------
interface ContextoEtiquetas {
  etiquetas: Record<string, string>;
  setEtiqueta: (catalogo: string, codigo: string | number, descripcion: string) => void;
}

export const EtiquetasContext = createContext<ContextoEtiquetas>({ etiquetas: {}, setEtiqueta: () => undefined });

export function useEtiquetas(): ContextoEtiquetas {
  return useContext(EtiquetasContext);
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

/** Campos de texto libre del formulario (excluye los de opciones fijas). */
export type CampoDeTexto = {
  [K in keyof Entrada]-?: string extends Entrada[K] ? (Entrada[K] extends string ? K : never) : never;
}[keyof Entrada];

export function EtiquetaCampo({
  htmlFor,
  texto,
  requerido,
  className,
}: {
  htmlFor?: string;
  texto: React.ReactNode;
  requerido?: boolean;
  className?: string;
}) {
  return (
    <FieldLabel htmlFor={htmlFor} className={className}>
      <span>
        {texto}
        {requerido ? (
          <>
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        ) : null}
      </span>
    </FieldLabel>
  );
}

export function CampoTexto({
  nombre,
  etiqueta,
  requerido,
  descripcion,
  className,
  multilinea,
  ...resto
}: {
  nombre: CampoDeTexto;
  etiqueta: string;
  requerido?: boolean;
  descripcion?: React.ReactNode;
  className?: string;
  multilinea?: boolean;
} & Pick<
  React.ComponentProps<"input">,
  "type" | "placeholder" | "autoComplete" | "inputMode" | "max" | "min" | "maxLength" | "onKeyDown"
>) {
  const { control } = useFormContext<Entrada>();
  const id = useId();
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <EtiquetaCampo htmlFor={id} texto={etiqueta} requerido={requerido} />
          {multilinea ? (
            <Textarea
              id={id}
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              placeholder={resto.placeholder}
              maxLength={resto.maxLength}
              aria-invalid={fieldState.invalid || undefined}
              className="min-h-20"
            />
          ) : (
            <Input
              id={id}
              {...resto}
              name={field.name}
              ref={field.ref}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid || undefined}
              className="h-9"
            />
          )}
          {descripcion ? <FieldDescription>{descripcion}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/** Dato precargado que no se puede modificar (RNF-05). */
export function CampoSoloLectura({
  etiqueta,
  valor,
  descripcion,
  className,
  mono,
}: {
  etiqueta: string;
  valor: string;
  descripcion?: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  const id = useId();
  return (
    <Field className={className}>
      <FieldLabel htmlFor={id}>
        <span className="inline-flex items-center gap-1.5">
          {etiqueta}
          <LockIcon className="size-3 text-muted-foreground" aria-hidden="true" />
        </span>
      </FieldLabel>
      <Input
        id={id}
        value={valor}
        readOnly
        aria-readonly="true"
        className={cn("h-9 cursor-default bg-muted/60 text-muted-foreground focus-visible:ring-0", mono && "font-mono")}
      />
      {descripcion ? <FieldDescription>{descripcion}</FieldDescription> : null}
    </Field>
  );
}

type CampoDeCodigo = "ciuo" | "forma_accidente" | "agente_material";

/** Combo de un catálogo de la SRT conectado al formulario. */
export function CampoCatalogoForm({
  nombre,
  catalogo,
  etiqueta,
  requerido,
  descripcion,
  placeholder,
  className,
}: {
  nombre: CampoDeCodigo;
  catalogo: Catalogo;
  etiqueta: string;
  requerido?: boolean;
  descripcion?: React.ReactNode;
  placeholder?: string;
  className?: string;
}) {
  const { control } = useFormContext<Entrada>();
  const { setEtiqueta } = useEtiquetas();
  const id = useId();
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <EtiquetaCampo htmlFor={id} texto={etiqueta} requerido={requerido} />
          <CampoCatalogo
            id={id}
            catalogo={catalogo}
            valor={field.value || null}
            placeholder={placeholder}
            invalido={fieldState.invalid}
            onChange={(codigo, opcion) => {
              if (codigo && opcion) setEtiqueta(catalogo, codigo, opcion.descripcion);
              field.onChange(codigo ?? "");
              field.onBlur();
            }}
          />
          {descripcion ? <FieldDescription>{descripcion}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

type CampoDeLocalidad = "localidad_id" | "localidad_laboral_id" | "localidad_ocurrencia_id";

/** Localidad del catálogo de la SRT conectada al formulario (el valor es el id). */
export function CampoLocalidadForm({
  nombre,
  etiqueta,
  requerido,
  descripcion,
  className,
}: {
  nombre: CampoDeLocalidad;
  etiqueta: string;
  requerido?: boolean;
  descripcion?: React.ReactNode;
  className?: string;
}) {
  const { control } = useFormContext<Entrada>();
  const { etiquetas, setEtiqueta } = useEtiquetas();
  const id = useId();
  const alResolver = useCallback((loc: number, n: string) => setEtiqueta("localidad", loc, n), [setEtiqueta]);
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <EtiquetaCampo htmlFor={id} texto={etiqueta} requerido={requerido} />
          <CampoLocalidad
            id={id}
            valor={field.value}
            etiqueta={field.value !== null ? etiquetas[claveEtiqueta("localidad", field.value)] : null}
            invalido={fieldState.invalid}
            onEtiqueta={alResolver}
            onChange={(loc, n) => {
              if (loc !== null && n) setEtiqueta("localidad", loc, n);
              field.onChange(loc);
              field.onBlur();
            }}
          />
          {descripcion ? <FieldDescription>{descripcion}</FieldDescription> : null}
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

/** Sí/No con interruptor. */
export function CampoInterruptor({
  nombre,
  etiqueta,
  descripcion,
  className,
}: {
  nombre: "desvinculado" | "pluriempleo";
  etiqueta: string;
  descripcion?: React.ReactNode;
  className?: string;
}) {
  const { control } = useFormContext<Entrada>();
  const id = useId();
  return (
    <Controller
      control={control}
      name={nombre}
      render={({ field }) => (
        <Field orientation="horizontal" className={cn("rounded-lg border bg-muted/20 p-3", className)}>
          <Switch id={id} checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} />
          <FieldContent>
            <FieldLabel htmlFor={id}>{etiqueta}</FieldLabel>
            {descripcion ? <FieldDescription>{descripcion}</FieldDescription> : null}
          </FieldContent>
        </Field>
      )}
    />
  );
}
