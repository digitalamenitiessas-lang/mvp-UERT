"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";
import {
  ArrowRightIcon,
  BanIcon,
  InfoIcon,
  RotateCcwIcon,
  SendIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { accionCrearReingreso, accionDesistir, accionPasarAMedica, accionVerificar } from "@/app/acciones";
import { Simulado } from "@/components/comun/badges";
import { ErrorAccion } from "@/components/comun/error-accion";
import { useAccion } from "@/components/comun/use-accion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  DESISTIMIENTO_INFO,
  PLAZOS,
  type MotivoDesistimiento,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";
import { formatoFecha } from "@/lib/dominio/fechas";
import { esquemaDesistir, esquemaReingreso, esquemaVerificacion } from "@/lib/esquemas";

const EXPLICACION_DESISTIMIENTO: Record<MotivoDesistimiento, string> = {
  falta_cobertura: "La persona no está cubierta por la UERT (por ejemplo, revista en una contratista con ART propia).",
  relacion_no_corroborada: "No se pudo constatar que la persona trabaje en la Administración Pública Provincial.",
  inconsistencia_diagnostico: "El diagnóstico denunciado no se condice con la documentación presentada.",
  incomparecencia: "No se presentó a las citaciones o no entregó la documentación pedida (caducidad del trámite).",
};

/** Aviso de qué pasa al desistir: no es un rechazo y se informa (simulado). */
function AvisoDesistimiento({ tipo }: { tipo: TipoDenuncia }) {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-900">
      <TriangleAlertIcon />
      <AlertTitle>La denuncia queda Desistida</AlertTitle>
      <AlertDescription className="text-amber-900/80">
        <p>
          Es un Asentamiento de Actuaciones Previas: no es un rechazo ni habilita la Comisión Médica. Se notifica a la
          persona y se informa a la SRT dentro de las {PLAZOS.configuracionHoras} h
          {tipo === "EP" ? " por Web Service FODEP" : ""}. <Simulado />
        </p>
      </AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// Relación laboral y cotizaciones (Anexo II pto. 2)
// ---------------------------------------------------------------------------
export function VerificarRelacion({ expedienteId, tipo }: { expedienteId: number; tipo: TipoDenuncia }) {
  return (
    <div className="flex flex-wrap gap-2">
      <DialogoVerificada expedienteId={expedienteId} />
      <DialogoNoCorresponde expedienteId={expedienteId} tipo={tipo} />
    </div>
  );
}

type EntradaVerificacion = z.input<typeof esquemaVerificacion>;
type SalidaVerificacion = z.output<typeof esquemaVerificacion>;

function DialogoVerificada({ expedienteId }: { expedienteId: number }) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const id = useId();
  const form = useForm<EntradaVerificacion, unknown, SalidaVerificacion>({
    resolver: zodResolver(esquemaVerificacion),
    defaultValues: { expediente_id: expedienteId, verificada: true, motivo: null, observacion: "" },
  });

  const cambiarApertura = (a: boolean) => {
    setAbierto(a);
    if (!a) {
      form.reset();
      limpiarError();
    }
  };
  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionVerificar(datos), { alTerminar: () => cambiarApertura(false) }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <ShieldCheckIcon />
          Verificada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Relación laboral verificada</DialogTitle>
            <DialogDescription>
              Confirmá que la persona revista en la Administración Pública Provincial y registra cotizaciones (Anexo II,
              punto 2).
            </DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="observacion"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-observacion`}>Observación</FieldLabel>
                <Textarea
                  id={`${id}-observacion`}
                  {...field}
                  placeholder="Ej.: Se constató en la liquidación de haberes de octubre."
                  aria-invalid={fieldState.invalid || undefined}
                />
                <FieldDescription>Opcional. Queda en el historial del expediente.</FieldDescription>
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
              {pendiente ? <Spinner /> : <ShieldCheckIcon />}
              Confirmar verificación
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DialogoNoCorresponde({ expedienteId, tipo }: { expedienteId: number; tipo: TipoDenuncia }) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const id = useId();
  const form = useForm<EntradaVerificacion, unknown, SalidaVerificacion>({
    resolver: zodResolver(esquemaVerificacion),
    defaultValues: { expediente_id: expedienteId, verificada: false, motivo: null, observacion: "" },
  });

  const cambiarApertura = (a: boolean) => {
    setAbierto(a);
    if (!a) {
      form.reset();
      limpiarError();
    }
  };
  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionVerificar(datos), { alTerminar: () => cambiarApertura(false) }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          <ShieldXIcon />
          No corresponde
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>La relación laboral no se corrobora</DialogTitle>
            <DialogDescription>
              Si no se corrobora la relación laboral o la cobertura, la denuncia no se configura (Anexo II, punto 2).
            </DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="motivo"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Motivo</FieldLegend>
                <RadioGroup
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  aria-invalid={fieldState.invalid || undefined}
                >
                  {(["falta_cobertura", "relacion_no_corroborada"] as const).map((m) => (
                    <FieldLabel key={m} htmlFor={`${id}-${m}`} className="*:data-[slot=field]:p-3">
                      <Field orientation="horizontal">
                        <RadioGroupItem value={m} id={`${id}-${m}`} />
                        <FieldContent>
                          <FieldTitle>{DESISTIMIENTO_INFO[m]}</FieldTitle>
                          <FieldDescription>{EXPLICACION_DESISTIMIENTO[m]}</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
                <FieldError errors={[fieldState.error]} />
              </FieldSet>
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
                  placeholder="Qué se constató y con qué fuente."
                  aria-invalid={fieldState.invalid || undefined}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <AvisoDesistimiento tipo={tipo} />
          <ErrorAccion error={error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pendiente}>
              {pendiente ? <Spinner /> : <ShieldXIcon />}
              Registrar y desistir
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Pase al Área médica
// ---------------------------------------------------------------------------
export function PasarAMedica({
  expedienteId,
  tipo,
  bloqueo,
}: {
  expedienteId: number;
  tipo: TipoDenuncia;
  /** Por qué todavía no se puede pasar (null si se puede). */
  bloqueo: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error } = useAccion();
  const esEP = tipo === "EP";

  const pasar = () =>
    ejecutar(
      async () => {
        const r = await accionPasarAMedica(expedienteId);
        // Si la SRT rechazó la denuncia, el intento quedó registrado en el expediente: se actualiza la ficha.
        if (!r.ok && r.detalles?.length) router.refresh();
        return r;
      },
      { alTerminar: () => setAbierto(false) },
    );

  if (bloqueo) {
    return (
      <div className="flex flex-col gap-1.5">
        <Button type="button" size="sm" disabled className="w-fit" aria-describedby={`bloqueo-${expedienteId}`}>
          <ArrowRightIcon />
          Pasar al Área médica
        </Button>
        <p id={`bloqueo-${expedienteId}`} className="text-xs text-muted-foreground">
          {bloqueo}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AlertDialog open={abierto} onOpenChange={setAbierto}>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" className="w-fit">
            <ArrowRightIcon />
            Pasar al Área médica
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="data-[size=default]:sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Pasar la denuncia al Área médica?</AlertDialogTitle>
            <AlertDialogDescription>
              El expediente queda en evaluación médica y Mesa de entrada ya no puede corregir sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {esEP ? (
            <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
              <SendIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p>
                Antes se informa la denuncia a la SRT por Web Service FODEP: alta de la denuncia y de sus diagnósticos.
                Si la SRT la rechaza, queda en Mesa de entrada con los códigos de error. <Simulado />
              </p>
            </div>
          ) : null}
          <ErrorAccion error={error} />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pendiente}>Cancelar</AlertDialogCancel>
            <Button type="button" onClick={pasar} disabled={pendiente}>
              {pendiente ? <Spinner /> : esEP ? <SendIcon /> : <ArrowRightIcon />}
              {esEP ? "Informar a la SRT y pasar" : "Pasar al Área médica"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {esEP ? (
        <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          Se informa la denuncia a la SRT por Web Service FODEP <Simulado />
        </p>
      ) : null}
      {!abierto ? <ErrorAccion error={error} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desistimiento manual
// ---------------------------------------------------------------------------
type EntradaDesistir = z.input<typeof esquemaDesistir>;
type SalidaDesistir = z.output<typeof esquemaDesistir>;

export function DesistirDenuncia({ expedienteId, tipo }: { expedienteId: number; tipo: TipoDenuncia }) {
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const id = useId();
  const form = useForm<EntradaDesistir, unknown, SalidaDesistir>({
    resolver: zodResolver(esquemaDesistir),
    defaultValues: { expediente_id: expedienteId, observacion: "" },
  });

  const cambiarApertura = (a: boolean) => {
    setAbierto(a);
    if (!a) {
      form.reset();
      limpiarError();
    }
  };
  const enviar = form.handleSubmit((datos) =>
    ejecutar(() => accionDesistir(datos), { alTerminar: () => cambiarApertura(false) }),
  );

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="destructive">
          <BanIcon />
          Desistir
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Desistir la denuncia</DialogTitle>
            <DialogDescription>
              Se usa cuando la denuncia no se configura. Indicá el motivo: queda en el historial y en la notificación.
            </DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="motivo"
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Motivo</FieldLegend>
                <RadioGroup
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  aria-invalid={fieldState.invalid || undefined}
                  className="gap-2"
                >
                  {(Object.keys(DESISTIMIENTO_INFO) as MotivoDesistimiento[]).map((m) => (
                    <FieldLabel key={m} htmlFor={`${id}-${m}`} className="*:data-[slot=field]:p-2.5">
                      <Field orientation="horizontal">
                        <RadioGroupItem value={m} id={`${id}-${m}`} />
                        <FieldContent>
                          <FieldTitle>{DESISTIMIENTO_INFO[m]}</FieldTitle>
                          <FieldDescription>{EXPLICACION_DESISTIMIENTO[m]}</FieldDescription>
                        </FieldContent>
                      </Field>
                    </FieldLabel>
                  ))}
                </RadioGroup>
                <FieldError errors={fieldState.error ? [{ message: "Elegí el motivo del desistimiento." }] : []} />
              </FieldSet>
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
                  placeholder="Detalle del motivo."
                  aria-invalid={fieldState.invalid || undefined}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <AvisoDesistimiento tipo={tipo} />
          <ErrorAccion error={error} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pendiente}>
              {pendiente ? <Spinner /> : <BanIcon />}
              Desistir la denuncia
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Reingreso de un siniestro dado de alta (RF-24)
// ---------------------------------------------------------------------------
type EntradaReingreso = z.input<typeof esquemaReingreso>;
type SalidaReingreso = z.output<typeof esquemaReingreso>;

export function RegistrarReingreso({
  expedienteId,
  numeroPrevisto,
  fechaAlta,
  hoy,
  abiertos,
}: {
  expedienteId: number;
  /** Número que va a tomar el reingreso (mismo número, sufijo siguiente). */
  numeroPrevisto: string;
  fechaAlta: string | null;
  hoy: string;
  /** Reingresos de este siniestro que siguen abiertos. */
  abiertos: Array<{ numero: string; estado: string }>;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const { ejecutar, pendiente, error, limpiarError } = useAccion();
  const id = useId();
  const form = useForm<EntradaReingreso, unknown, SalidaReingreso>({
    resolver: zodResolver(esquemaReingreso),
    defaultValues: { origen_id: expedienteId, fecha_ocurrencia: "", descripcion: "" },
  });

  const cambiarApertura = (a: boolean) => {
    setAbierto(a);
    if (!a) {
      form.reset();
      limpiarError();
    }
  };
  const enviar = form.handleSubmit((datos) => {
    if (fechaAlta && datos.fecha_ocurrencia < fechaAlta) {
      form.setError("fecha_ocurrencia", { message: `No puede ser anterior al alta (${formatoFecha(fechaAlta)}).` });
      return;
    }
    if (datos.fecha_ocurrencia > hoy) {
      form.setError("fecha_ocurrencia", { message: "No puede ser posterior a hoy." });
      return;
    }
    ejecutar(() => accionCrearReingreso(datos), {
      silencioso: true,
      alTerminar: (nuevo) => {
        toast.success(`Reingreso registrado: expediente ${nuevo.numero}`, {
          description: "Quedó en Mesa de entrada para controlar y pasar al Área médica.",
        });
        setAbierto(false);
        router.push(`/expedientes/${nuevo.id}`);
      },
    });
  });

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" className="w-fit">
          <RotateCcwIcon />
          Registrar reingreso
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={enviar} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Registrar reingreso</DialogTitle>
            <DialogDescription>
              La persona vuelve a consultar por este siniestro después del alta (recaída).
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p>
              Conserva el número del siniestro con el sufijo siguiente: se registra como{" "}
              <span className="font-mono font-medium">{numeroPrevisto}</span>. Vuelve a pasar por Mesa de entrada y por
              el Área médica, que reevalúa los diagnósticos aceptados.
            </p>
          </div>
          {abiertos.length ? (
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <TriangleAlertIcon />
              <AlertTitle>Este siniestro ya tiene un reingreso abierto</AlertTitle>
              <AlertDescription className="text-amber-900/80">
                {abiertos.map((a) => `${a.numero} (${a.estado})`).join(" · ")}. Revisá que no sea el mismo hecho.
              </AlertDescription>
            </Alert>
          ) : null}
          <Controller
            control={form.control}
            name="fecha_ocurrencia"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-fecha`}>Fecha de la recaída</FieldLabel>
                <Input
                  id={`${id}-fecha`}
                  type="date"
                  {...field}
                  min={fechaAlta ?? undefined}
                  max={hoy}
                  className="h-9 w-48"
                  aria-invalid={fieldState.invalid || undefined}
                />
                {fechaAlta ? <FieldDescription>Alta médica: {formatoFecha(fechaAlta)}.</FieldDescription> : null}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            control={form.control}
            name="descripcion"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-descripcion`}>Descripción</FieldLabel>
                <Textarea
                  id={`${id}-descripcion`}
                  {...field}
                  placeholder="Qué síntomas o lesión presenta y desde cuándo."
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
              {pendiente ? <Spinner /> : <RotateCcwIcon />}
              Registrar reingreso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
