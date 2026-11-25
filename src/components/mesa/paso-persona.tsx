"use client";

import { useId, useRef } from "react";
import Link from "next/link";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import {
  CircleCheckIcon,
  ExternalLinkIcon,
  HardHatIcon,
  InfoIcon,
  Link2Icon,
  MicroscopeIcon,
  RouteIcon,
  SearchIcon,
  TriangleAlertIcon,
  UserRoundCheckIcon,
  UserRoundPlusIcon,
} from "lucide-react";
import type { ErrorDeAccion } from "@/components/comun/use-accion";
import { ErrorAccion } from "@/components/comun/error-accion";
import { Etiqueta } from "@/components/comun/badges";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { TIPO_INFO, TIPOS, type TipoDenuncia } from "@/lib/dominio/constantes";
import { formatoCuil, formatoDni, soloDigitos } from "@/lib/dominio/validaciones";
import type { SiniestroAbierto } from "@/lib/operaciones";
import type { Persona } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { EtiquetaCampo } from "./campos-denuncia";
import { dniDesdeCuil, formatearCuit, TIPO_EXPLICACION, type Entrada } from "./modelo";

/** Resultado de buscar a la persona (RF-25): sus datos y sus siniestros abiertos. */
export interface Busqueda {
  /** CUIL y DNI buscados ("cuil|dni", solo dígitos). */
  clave: string;
  persona: Persona | null;
  abiertos: SiniestroAbierto[];
}

const ICONO_TIPO: Record<TipoDenuncia, typeof HardHatIcon> = {
  EP: MicroscopeIcon,
  AT: HardHatIcon,
  IT: RouteIcon,
};

/**
 * Paso 1 de la carga: tipo de denuncia, CUIL/DNI y control de siniestros
 * abiertos de la persona en este sistema y en el actual (RF-25 a RF-28).
 */
export function PasoPersona({
  busqueda,
  buscando,
  errorBusqueda,
  avisoDecision,
  onBuscar,
  onUsarCuil,
}: {
  /** Búsqueda vigente (la del CUIL y DNI cargados), si ya se hizo. */
  busqueda: Busqueda | null;
  buscando: boolean;
  errorBusqueda: ErrorDeAccion | null;
  /** Se intentó continuar sin decidir el vínculo con los siniestros abiertos. */
  avisoDecision: boolean;
  onBuscar: () => void;
  onUsarCuil: (cuil: string) => void;
}) {
  const { control, getValues, setValue, clearErrors } = useFormContext<Entrada>();
  const base = useId();
  // El DNI se completa desde el CUIL mientras la persona no lo escriba a mano.
  const dniAutomatico = useRef(true);

  const olvidarVinculo = () => {
    if (getValues("origen_id") !== null || getValues("es_intercurrencia") || getValues("confirmo_hecho_distinto")) {
      setValue("origen_id", null);
      setValue("es_intercurrencia", false);
      setValue("confirmo_hecho_distinto", false);
    }
  };

  const alPresionarEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onBuscar();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Controller
        control={control}
        name="tipo"
        render={({ field, fieldState }) => (
          <FieldSet data-invalid={fieldState.invalid}>
            <FieldLegend>¿Qué se denuncia?</FieldLegend>
            <FieldDescription>El tipo define los datos y la documentación que se piden.</FieldDescription>
            <RadioGroup
              value={field.value ?? ""}
              onValueChange={(v) => {
                field.onChange(v);
                clearErrors("tipo");
              }}
              aria-invalid={fieldState.invalid || undefined}
              className="grid gap-3 md:grid-cols-3"
            >
              {TIPOS.map((t) => {
                const Icono = ICONO_TIPO[t];
                return (
                  <FieldLabel key={t} htmlFor={`${base}-tipo-${t}`} className="*:data-[slot=field]:p-4">
                    <Field orientation="horizontal" className="items-start">
                      <FieldContent>
                        <FieldTitle>
                          <Icono className="size-4 text-primary" aria-hidden="true" />
                          {TIPO_INFO[t].nombre}
                        </FieldTitle>
                        <FieldDescription>{TIPO_EXPLICACION[t]}</FieldDescription>
                      </FieldContent>
                      <RadioGroupItem value={t} id={`${base}-tipo-${t}`} />
                    </Field>
                  </FieldLabel>
                );
              })}
            </RadioGroup>
            <FieldError errors={[fieldState.error]} />
          </FieldSet>
        )}
      />

      <FieldSeparator />

      <FieldSet>
        <FieldLegend>Persona trabajadora</FieldLegend>
        <FieldDescription>
          Buscamos si ya está registrada y si tiene siniestros abiertos, en este sistema y en el que la UERT usa hoy.
        </FieldDescription>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,12rem)_max-content] sm:items-start">
          <Controller
            control={control}
            name="cuil"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <EtiquetaCampo htmlFor={`${base}-cuil`} texto="CUIL" requerido />
                <Input
                  id={`${base}-cuil`}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="20-12345678-9"
                  aria-invalid={fieldState.invalid || undefined}
                  className="h-9 font-mono"
                  onKeyDown={alPresionarEnter}
                  onChange={(e) => {
                    const nuevo = formatearCuit(e.target.value);
                    field.onChange(nuevo);
                    const dni = dniDesdeCuil(nuevo);
                    if (dni && (dniAutomatico.current || !soloDigitos(getValues("dni")))) {
                      setValue("dni", dni, { shouldValidate: !!fieldState.error });
                      dniAutomatico.current = true;
                    }
                    olvidarVinculo();
                  }}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={control}
            name="dni"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <EtiquetaCampo htmlFor={`${base}-dni`} texto="DNI" requerido />
                <Input
                  id={`${base}-dni`}
                  name={field.name}
                  ref={field.ref}
                  value={field.value}
                  onBlur={field.onBlur}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="12345678"
                  aria-invalid={fieldState.invalid || undefined}
                  className="h-9 font-mono"
                  onKeyDown={alPresionarEnter}
                  onChange={(e) => {
                    dniAutomatico.current = false;
                    field.onChange(soloDigitos(e.target.value).slice(0, 8));
                    olvidarVinculo();
                  }}
                />
                {fieldState.error ? null : <FieldDescription>Se completa con el CUIL.</FieldDescription>}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Field>
            <FieldLabel aria-hidden="true" className="invisible max-sm:hidden">
              Buscar
            </FieldLabel>
            <Button type="button" variant="secondary" className="h-9 w-full sm:w-auto" onClick={onBuscar} disabled={buscando}>
              {buscando ? <Spinner /> : <SearchIcon />}
              Buscar
            </Button>
          </Field>
        </div>

        <ErrorAccion error={errorBusqueda} />

        {buscando ? (
          <div className="flex flex-col gap-3 rounded-lg border bg-background p-4" aria-busy="true">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner /> Buscando a la persona y sus siniestros abiertos…
            </span>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : busqueda ? (
          <ResultadoBusqueda busqueda={busqueda} avisoDecision={avisoDecision} onUsarCuil={onUsarCuil} />
        ) : (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Cargá el CUIL y tocá “Buscar” (o “Continuar”): si la persona ya está registrada, precargamos sus datos.
          </p>
        )}
      </FieldSet>
    </div>
  );
}

function ResultadoBusqueda({
  busqueda,
  avisoDecision,
  onUsarCuil,
}: {
  busqueda: Busqueda;
  avisoDecision: boolean;
  onUsarCuil: (cuil: string) => void;
}) {
  const { control, setValue } = useFormContext<Entrada>();
  const [origenId, esIntercurrencia, confirmo] = useWatch({
    control,
    name: ["origen_id", "es_intercurrencia", "confirmo_hecho_distinto"],
  });
  const idConfirmo = useId();
  const p = busqueda.persona;
  const cuilBuscado = busqueda.clave.split("|")[0];
  const otroCuil = p !== null && p.cuil !== cuilBuscado;
  const vinculada = esIntercurrencia && origenId !== null;
  const hayAbiertos = busqueda.abiertos.length > 0;
  const faltaDecidir = hayAbiertos && !vinculada && !confirmo;

  const vincular = (id: number) => {
    setValue("origen_id", id);
    setValue("es_intercurrencia", true);
    setValue("confirmo_hecho_distinto", false);
  };
  const desvincular = () => {
    setValue("origen_id", null);
    setValue("es_intercurrencia", false);
  };

  return (
    <div className="flex flex-col divide-y rounded-lg border bg-background" aria-live="polite">
      {/* La persona */}
      <div className="flex items-start gap-3 p-4">
        {p && !otroCuil ? (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <UserRoundCheckIcon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {p.apellido}, {p.nombres}
                <Etiqueta className="bg-emerald-50 text-emerald-800 ring-emerald-600/20">Persona registrada</Etiqueta>
              </p>
              <p className="text-sm text-muted-foreground">
                CUIL {formatoCuil(p.cuil)} · DNI {formatoDni(p.dni)}. Precargamos sus datos personales y de contacto:
                revisalos en la solapa Trabajador/a.
              </p>
            </div>
          </>
        ) : p && otroCuil ? (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
              <TriangleAlertIcon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="flex min-w-0 flex-col gap-2">
              <div>
                <p className="font-medium">El DNI corresponde a una persona registrada con otro CUIL</p>
                <p className="text-sm text-muted-foreground">
                  {p.apellido}, {p.nombres} · CUIL {formatoCuil(p.cuil)}. Revisá el número antes de seguir.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onUsarCuil(p.cuil)}>
                Usar el CUIL {formatoCuil(p.cuil)}
              </Button>
            </div>
          </>
        ) : (
          <>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-700">
              <UserRoundPlusIcon className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-medium">Persona no registrada</p>
              <p className="text-sm text-muted-foreground">
                {hayAbiertos
                  ? "No tiene denuncias en este sistema con ese CUIL o DNI: vas a cargar sus datos en el formulario."
                  : "No hay denuncias anteriores con ese CUIL o DNI: vas a cargar sus datos en el formulario."}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Siniestros abiertos */}
      <div className="flex flex-col gap-3 p-4">
        <div>
          <p className="font-medium">Siniestros abiertos</p>
          <p className="text-sm text-muted-foreground">En este sistema y en el sistema que la UERT usa hoy.</p>
        </div>
        {!hayAbiertos ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700">
            <CircleCheckIcon className="size-4" aria-hidden="true" />
            No tiene siniestros abiertos.
          </p>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {busqueda.abiertos.map((a) => {
                const id = a.id;
                const elegible = a.origen === "nuevo" && a.licencia_activa;
                const elegido = vinculada && id !== null && origenId === id;
                return (
                  <li
                    key={`${a.origen}-${a.numero}`}
                    className={cn(
                      "flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between",
                      elegido && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium">{a.numero}</span>
                        <Etiqueta
                          className={
                            a.origen === "nuevo"
                              ? "bg-sky-50 text-sky-800 ring-sky-600/20"
                              : "bg-zinc-50 text-zinc-700 ring-zinc-500/20"
                          }
                        >
                          {a.origen === "nuevo" ? "Este sistema" : "Sistema actual"}
                        </Etiqueta>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {a.tipo} · {a.estado}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {id !== null ? (
                        <Link
                          href={`/expedientes/${id}`}
                          target="_blank"
                          rel="noopener"
                          className={buttonVariants({ variant: "ghost", size: "sm" })}
                        >
                          Ver ficha
                          <ExternalLinkIcon />
                        </Link>
                      ) : null}
                      {elegible && id !== null ? (
                        elegido ? (
                          <>
                            <Etiqueta className="bg-primary/10 text-primary ring-primary/20">
                              <Link2Icon className="size-3" aria-hidden="true" />
                              Intercurrencia de este siniestro
                            </Etiqueta>
                            <Button type="button" variant="ghost" size="sm" onClick={desvincular}>
                              Quitar
                            </Button>
                          </>
                        ) : (
                          <Button type="button" variant="outline" size="sm" onClick={() => vincular(id)}>
                            <Link2Icon />
                            Es una intercurrencia de este siniestro
                          </Button>
                        )
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>

            {vinculada ? (
              <p className="text-sm text-muted-foreground">
                Se va a registrar como intercurrencia: un siniestro nuevo durante la licencia activa, vinculado al
                anterior, que pasa directo al Área médica.
              </p>
            ) : (
              <Controller
                control={control}
                name="confirmo_hecho_distinto"
                render={({ field }) => (
                  <Field
                    orientation="horizontal"
                    data-invalid={avisoDecision && faltaDecidir}
                    className={cn(
                      "rounded-md border border-dashed p-3",
                      avisoDecision && faltaDecidir && "border-destructive/50 bg-destructive/5",
                    )}
                  >
                    <Checkbox
                      id={idConfirmo}
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                      aria-invalid={(avisoDecision && faltaDecidir) || undefined}
                    />
                    <FieldContent>
                      <FieldLabel htmlFor={idConfirmo}>Confirmo que es un hecho distinto</FieldLabel>
                      <FieldDescription>
                        El nuevo hecho no tiene relación con los siniestros abiertos de la persona.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                )}
              />
            )}
            {avisoDecision && faltaDecidir ? (
              <p role="alert" className="text-sm text-destructive">
                Para continuar, indicá si es una intercurrencia de un siniestro con licencia activa o confirmá que es un
                hecho distinto.
              </p>
            ) : null}
          </>
        )}
      </div>

      {/* Reingresos */}
      <div className="flex items-start gap-2 bg-muted/30 p-4 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          ¿Es una recaída de un siniestro que ya tuvo el alta? Los reingresos no se cargan acá: se registran desde la
          ficha de ese siniestro (“Registrar reingreso”), con el mismo número y el sufijo siguiente.
        </p>
      </div>
    </div>
  );
}
