"use client";

import { useId } from "react";
import { Controller, useFieldArray, useFormContext, useWatch } from "react-hook-form";
import {
  CircleCheckIcon,
  CircleDashedIcon,
  InfoIcon,
  MailCheckIcon,
  PlusIcon,
  StethoscopeIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from "lucide-react";
import { CampoCatalogo } from "@/components/comun/campo-catalogo";
import { Etiqueta, Simulado } from "@/components/comun/badges";
import { AVISO_ARCHIVOS_DEMO, SelectorArchivos } from "@/components/comun/selector-archivos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CANAL_INFO,
  DENUNCIANTE_INFO,
  MAX_DIAGNOSTICOS_EP,
  UERT,
  type Canal,
  type TipoDenunciante,
} from "@/lib/dominio/constantes";
import { AVISO_IN_ITINERE, documentosDeRecepcion, documentosFaltantes, type Exigencia } from "@/lib/dominio/documentos";
import { esCuitValido, formatoCuil, formatoDni, soloDigitos } from "@/lib/dominio/validaciones";
import { plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import {
  CampoCatalogoForm,
  CampoInterruptor,
  CampoLocalidadForm,
  CampoSoloLectura,
  CampoTexto,
  EtiquetaCampo,
  useEtiquetas,
} from "./campos-denuncia";
import { formatearCuit, SEXO_INFO, type Entrada, type ModoFormulario } from "./modelo";

// ---------------------------------------------------------------------------
// Trabajador/a
// ---------------------------------------------------------------------------
export function SolapaTrabajador({ modo, hoy }: { modo: ModoFormulario; hoy: string }) {
  const { control } = useFormContext<Entrada>();
  const [tipo, cuil, dni] = useWatch({ control, name: ["tipo", "cuil", "dni"] });
  const esEP = tipo === "EP";
  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend>Identificación</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampoSoloLectura
            etiqueta="CUIL"
            valor={formatoCuil(cuil)}
            mono
            descripcion={modo === "nueva" ? "Se cargó en el paso 1." : "La persona de la denuncia no se puede cambiar."}
          />
          {modo === "nueva" ? (
            <CampoSoloLectura etiqueta="DNI" valor={formatoDni(dni)} mono descripcion="Se cargó en el paso 1." />
          ) : (
            <CampoTexto nombre="dni" etiqueta="DNI" requerido inputMode="numeric" maxLength={10} autoComplete="off" />
          )}
          <CampoSexo />
          <CampoTexto nombre="apellido" etiqueta="Apellido" requerido autoComplete="off" />
          <CampoTexto nombre="nombres" etiqueta="Nombres" requerido autoComplete="off" />
          <CampoTexto nombre="fecha_nacimiento" etiqueta="Fecha de nacimiento" type="date" max={hoy} />
        </div>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Contacto y domicilio</FieldLegend>
        <FieldDescription>
          {esEP
            ? "Teléfono y email son obligatorios en la denuncia FODEP: por esos medios se notifica a la persona."
            : "Se usan para enviar la constancia de recepción y las notificaciones."}
        </FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampoTexto
            nombre="telefono"
            etiqueta="Teléfono"
            requerido={esEP}
            type="tel"
            placeholder="Con característica: 385 4123456"
            autoComplete="off"
          />
          <CampoTexto nombre="email" etiqueta="Email" requerido={esEP} type="email" placeholder="nombre@correo.com" autoComplete="off" />
          <CampoSoloLectura etiqueta="País" valor="Argentina" />
          <CampoTexto nombre="domicilio" etiqueta="Domicilio" placeholder="Calle, número y barrio" autoComplete="off" />
          <CampoLocalidadForm nombre="localidad_id" etiqueta="Localidad" className="sm:col-span-2 lg:col-span-2" />
        </div>
      </FieldSet>
    </div>
  );
}

function CampoSexo() {
  const { control } = useFormContext<Entrada>();
  const id = useId();
  return (
    <Controller
      control={control}
      name="sexo"
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <EtiquetaCampo htmlFor={id} texto="Sexo" />
          <Select
            value={field.value}
            onValueChange={(v) => {
              field.onChange(v);
              field.onBlur();
            }}
          >
            <SelectTrigger id={id} className="w-full data-[size=default]:h-9" aria-invalid={fieldState.invalid || undefined}>
              <SelectValue placeholder="Sin indicar" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SEXO_INFO).map(([clave, nombre]) => (
                <SelectItem key={clave} value={clave}>
                  {nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Denunciante y canal
// ---------------------------------------------------------------------------
const CANAL_DESCRIPCION: Record<Canal, string> = {
  presencial: "La persona (o quien denuncia) se acercó a la Mesa de entrada y la denuncia se carga con su asistencia.",
  digital: "La denuncia llegó por email o por un canal web y se transcribe en el sistema.",
};

/** Opción de un grupo de radio con forma de tarjeta. */
function OpcionTarjeta({
  id,
  valor,
  titulo,
  descripcion,
}: {
  id: string;
  valor: string;
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
}) {
  return (
    <FieldLabel htmlFor={id} className="*:data-[slot=field]:p-3">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldTitle>{titulo}</FieldTitle>
          {descripcion ? <FieldDescription>{descripcion}</FieldDescription> : null}
        </FieldContent>
        <RadioGroupItem value={valor} id={id} />
      </Field>
    </FieldLabel>
  );
}

export function SolapaDenunciante() {
  const { control } = useFormContext<Entrada>();
  const denunciante = useWatch({ control, name: "denunciante_tipo" });
  const base = useId();
  const otraPersona = denunciante !== "trabajador";
  return (
    <div className="flex flex-col gap-6">
      <Controller
        control={control}
        name="canal"
        render={({ field }) => (
          <FieldSet>
            <FieldLegend>Canal de recepción</FieldLegend>
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(CANAL_INFO) as Canal[]).map((c) => (
                <OpcionTarjeta
                  key={c}
                  id={`${base}-canal-${c}`}
                  valor={c}
                  titulo={CANAL_INFO[c]}
                  descripcion={CANAL_DESCRIPCION[c]}
                />
              ))}
            </RadioGroup>
          </FieldSet>
        )}
      />
      <FieldSeparator />
      <Controller
        control={control}
        name="denunciante_tipo"
        render={({ field }) => (
          <FieldSet>
            <FieldLegend>¿Quién hace la denuncia?</FieldLegend>
            <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(DENUNCIANTE_INFO) as TipoDenunciante[]).map((d) => (
                <OpcionTarjeta key={d} id={`${base}-denunciante-${d}`} valor={d} titulo={DENUNCIANTE_INFO[d]} />
              ))}
            </RadioGroup>
          </FieldSet>
        )}
      />
      {otraPersona ? (
        <FieldSet>
          <FieldLegend variant="label">Datos de quien denuncia</FieldLegend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CampoTexto
              nombre="denunciante_nombre"
              etiqueta={denunciante === "empleador" ? "Servicio o responsable" : "Nombre y apellido"}
              requerido
              placeholder={denunciante === "empleador" ? "Ej.: Medicina Laboral · Hospital Regional" : undefined}
              autoComplete="off"
            />
            <CampoTexto nombre="denunciante_email" etiqueta="Email" type="email" autoComplete="off" />
            <CampoTexto nombre="denunciante_telefono" etiqueta="Teléfono" type="tel" autoComplete="off" />
          </div>
        </FieldSet>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <MailCheckIcon className="size-4 shrink-0" aria-hidden="true" />
        <span>
          La constancia de recepción se envía por email a la persona trabajadora
          {otraPersona ? " y a quien hizo la denuncia" : ""}.
        </span>
        <Simulado />
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Datos laborales
// ---------------------------------------------------------------------------
export function SolapaLaboral() {
  const { control } = useFormContext<Entrada>();
  const tipo = useWatch({ control, name: "tipo" });
  const esEP = tipo === "EP";
  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend>Empleador</FieldLegend>
        <FieldDescription>Datos fijos de la Provincia: vienen precargados y no se pueden modificar.</FieldDescription>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CampoSoloLectura etiqueta="Empleador" valor={`Provincia de ${UERT.provincia}`} />
          <CampoSoloLectura etiqueta="CUIT del empleador" valor={formatoCuil(UERT.cuitEmpleador)} mono />
          <CampoSoloLectura etiqueta="Código de establecimiento" valor={UERT.codigoEstablecimiento} mono />
        </div>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Lugar de trabajo</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nombre="reparticion"
            etiqueta="Repartición"
            requerido
            placeholder="Ej.: Ministerio de Salud · Hospital Regional"
            className="sm:col-span-2"
            autoComplete="off"
          />
          <CampoTexto nombre="domicilio_laboral" etiqueta="Domicilio laboral" requerido={esEP} autoComplete="off" />
          <CampoLocalidadForm nombre="localidad_laboral_id" etiqueta="Localidad del lugar de trabajo" requerido={esEP} />
        </div>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Puesto y tareas</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoTexto
            nombre="puesto"
            etiqueta="Puesto"
            requerido={esEP}
            placeholder="Ej.: Enfermera de guardia"
            autoComplete="off"
          />
          <CampoCatalogoForm
            nombre="ciuo"
            catalogo="ciuo88"
            etiqueta="Ocupación (CIUO-88)"
            placeholder="Buscar ocupación…"
          />
          <CampoTexto
            nombre="tareas"
            etiqueta="Tareas que realiza"
            requerido={esEP}
            multilinea
            placeholder="Qué hace habitualmente, con qué elementos y en qué condiciones."
            className="sm:col-span-2"
          />
          <CampoTexto
            nombre="antiguedad_empresa"
            etiqueta="Antigüedad en la Administración Pública"
            requerido={esEP}
            placeholder="Ej.: 12 años"
            autoComplete="off"
          />
          <CampoTexto
            nombre="antiguedad_area"
            etiqueta="Antigüedad en el área o puesto"
            requerido={esEP}
            placeholder="Ej.: 3 años y 6 meses"
            autoComplete="off"
          />
        </div>
        <CampoInterruptor
          nombre="desvinculado"
          etiqueta="Ya no trabaja en la Administración Pública Provincial"
          descripcion="Marcalo si la persona renunció o fue desvinculada después del hecho."
        />
      </FieldSet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// El accidente (AT/IT) o La enfermedad (EP)
// ---------------------------------------------------------------------------
export function SolapaHecho({ hoy }: { hoy: string }) {
  const { control } = useFormContext<Entrada>();
  const [tipo, pluriempleo] = useWatch({ control, name: ["tipo", "pluriempleo"] });

  if (tipo === "EP") {
    return (
      <div className="flex flex-col gap-6">
        <FieldSet>
          <FieldLegend>Exposición al agente de riesgo</FieldLegend>
          <FieldDescription>
            Período en que la persona estuvo expuesta en su trabajo. Si sigue expuesta, dejá vacía la fecha “Hasta”.
          </FieldDescription>
          <div className="grid gap-4 sm:grid-cols-3">
            <CampoTexto nombre="exposicion_desde" etiqueta="Exposición desde" type="date" max={hoy} requerido />
            <CampoTexto nombre="exposicion_hasta" etiqueta="Exposición hasta" type="date" max={hoy} />
            <CampoTexto
              nombre="fecha_ocurrencia"
              etiqueta="Primera manifestación"
              type="date"
              max={hoy}
              descripcion="Cuándo aparecieron los síntomas, si se conoce."
            />
          </div>
          <CampoTexto
            nombre="descripcion"
            etiqueta="Descripción"
            multilinea
            placeholder="Síntomas, evolución y su relación con las tareas."
          />
        </FieldSet>
        <FieldSeparator />
        <FieldSet>
          <FieldLegend>Pluriempleo</FieldLegend>
          <CampoInterruptor
            nombre="pluriempleo"
            etiqueta="Tiene otros empleos (pluriempleo)"
            descripcion="Si también trabaja para otros empleadores, la SRT pide sus CUIT."
          />
          {pluriempleo ? (
            <div className="grid gap-6 rounded-lg border bg-background p-4 lg:grid-cols-2">
              <ListaCuits />
              <CampoObligadaPago />
            </div>
          ) : null}
        </FieldSet>
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
          <span>Estos datos se informan a la SRT con el formulario FODEP cuando la denuncia pasa al Área médica.</span>
          <Simulado />
        </p>
      </div>
    );
  }

  const esIT = tipo === "IT";
  return (
    <div className="flex flex-col gap-6">
      <FieldSet>
        <FieldLegend>Cuándo y dónde</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <CampoTexto nombre="fecha_ocurrencia" etiqueta="Fecha del accidente" type="date" max={hoy} requerido />
          <CampoTexto nombre="hora_ocurrencia" etiqueta="Hora" type="time" />
          <CampoTexto
            nombre="lugar_ocurrencia"
            etiqueta="Lugar"
            placeholder={esIT ? "Ej.: Av. Belgrano y Pellegrini" : "Ej.: Escalera del edificio central"}
            className="sm:col-span-2"
            autoComplete="off"
          />
          <CampoLocalidadForm nombre="localidad_ocurrencia_id" etiqueta="Localidad" className="sm:col-span-2" />
        </div>
      </FieldSet>
      <FieldSeparator />
      <FieldSet>
        <FieldLegend>Cómo ocurrió</FieldLegend>
        <CampoTexto
          nombre="descripcion"
          etiqueta="Descripción del accidente"
          requerido
          multilinea
          placeholder="Qué estaba haciendo, qué pasó y qué parte del cuerpo se lesionó."
        />
        {esIT ? (
          <CampoTexto
            nombre="trayecto"
            etiqueta="Trayecto"
            requerido
            multilinea
            placeholder="Desde dónde y hacia dónde iba, el recorrido habitual y el medio de transporte."
            descripcion="Se respalda con la Declaración Jurada de Trayecto."
          />
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoCatalogoForm
            nombre="forma_accidente"
            catalogo="forma_accidente"
            etiqueta="Forma del accidente"
            placeholder="Buscar forma del accidente…"
          />
          <CampoCatalogoForm
            nombre="agente_material"
            catalogo="agente_material"
            etiqueta="Agente material"
            placeholder="Buscar agente material…"
          />
        </div>
      </FieldSet>
    </div>
  );
}

/** CUIT de los otros empleadores (pluriempleo, WS FODEP). */
function ListaCuits() {
  const { control } = useFormContext<Entrada>();
  const id = useId();
  return (
    <Controller
      control={control}
      name="cuits_pluriempleo"
      render={({ field, fieldState }) => {
        const cuits = field.value.length ? field.value : [""];
        return (
          <Field data-invalid={fieldState.invalid}>
            <EtiquetaCampo htmlFor={`${id}-0`} texto="CUIT de los otros empleadores" requerido />
            <ul className="flex flex-col gap-2">
              {cuits.map((cuit, i) => {
                const digitos = soloDigitos(cuit);
                const invalido = digitos.length === 11 && !esCuitValido(digitos);
                return (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <Input
                      id={`${id}-${i}`}
                      value={cuit}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="30-12345678-9"
                      aria-label={`CUIT del empleador ${i + 1}`}
                      aria-invalid={invalido || fieldState.invalid || undefined}
                      className="h-9 w-44 font-mono"
                      onBlur={field.onBlur}
                      onChange={(e) => {
                        const nuevos = [...cuits];
                        nuevos[i] = formatearCuit(e.target.value);
                        field.onChange(nuevos);
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Quitar el CUIT ${i + 1}`}
                      disabled={cuits.length === 1 && !cuit}
                      onClick={() => field.onChange(cuits.filter((_, j) => j !== i))}
                    >
                      <Trash2Icon />
                    </Button>
                    {invalido ? <span className="text-xs text-destructive">CUIT inválido</span> : null}
                  </li>
                );
              })}
            </ul>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => field.onChange([...cuits, ""])}>
                <PlusIcon />
                Agregar CUIT
              </Button>
            </div>
            <FieldError errors={[fieldState.error]} />
          </Field>
        );
      }}
    />
  );
}

function CampoObligadaPago() {
  const { control } = useFormContext<Entrada>();
  const base = useId();
  return (
    <Controller
      control={control}
      name="obligada_pago"
      render={({ field, fieldState }) => (
        <FieldSet data-invalid={fieldState.invalid}>
          <FieldLegend variant="label">
            ¿La UERT está obligada al pago?
            <span aria-hidden="true" className="ml-0.5 text-destructive">
              *
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </FieldLegend>
          <FieldDescription>Con pluriempleo, la SRT pide saber si la UERT es la obligada al pago.</FieldDescription>
          <RadioGroup
            value={field.value === null ? "" : field.value ? "si" : "no"}
            onValueChange={(v) => {
              field.onChange(v === "si");
              field.onBlur();
            }}
            className="flex flex-wrap gap-6"
            aria-invalid={fieldState.invalid || undefined}
          >
            {[
              { valor: "si", texto: "Sí" },
              { valor: "no", texto: "No" },
            ].map((o) => (
              <Field key={o.valor} orientation="horizontal" className="w-auto">
                <RadioGroupItem value={o.valor} id={`${base}-${o.valor}`} />
                <FieldLabel htmlFor={`${base}-${o.valor}`} className="font-normal">
                  {o.texto}
                </FieldLabel>
              </Field>
            ))}
          </RadioGroup>
          <FieldError errors={[fieldState.error]} />
        </FieldSet>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Diagnósticos
// ---------------------------------------------------------------------------
export function SolapaDiagnosticos() {
  const {
    control,
    formState: { errors },
  } = useFormContext<Entrada>();
  const tipo = useWatch({ control, name: "tipo" });
  const esEP = tipo === "EP";
  const { fields, append, remove } = useFieldArray({ control, name: "diagnosticos" });
  const errorLista = errors.diagnosticos?.message ?? errors.diagnosticos?.root?.message;
  const lleno = fields.length >= MAX_DIAGNOSTICOS_EP;
  const agregar = () => append({ cie10: "", agente_causante: "" }, { shouldFocus: false });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h3 className="font-medium">
            {esEP ? "Diagnósticos invocados en el certificado médico" : "Diagnóstico del certificado médico"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {esEP
              ? `Obligatorio al menos uno y hasta ${MAX_DIAGNOSTICOS_EP}. Cada diagnóstico se informa a la SRT con su agente causante.`
              : "Opcional: si el certificado trae un diagnóstico podés cargarlo. Si no, lo completa el Área médica al evaluar."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={agregar} disabled={lleno}>
          <PlusIcon />
          Agregar diagnóstico
        </Button>
      </div>

      {fields.length === 0 ? (
        <Empty className="rounded-lg border border-dashed bg-background py-8">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <StethoscopeIcon />
            </EmptyMedia>
            <EmptyTitle>Sin diagnósticos cargados</EmptyTitle>
            <EmptyDescription>
              {esEP
                ? "Cargá el diagnóstico que figura en el certificado médico."
                : "Podés registrar la denuncia sin diagnóstico: el Área médica lo define al evaluar."}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col gap-3">
          {fields.map((f, i) => (
            <li key={f.id} className="rounded-lg border bg-background p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Diagnóstico {i + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Quitar el diagnóstico ${i + 1}`}
                  disabled={esEP && fields.length === 1}
                  onClick={() => remove(i)}
                >
                  <Trash2Icon />
                </Button>
              </div>
              <div className={cn("grid gap-4", esEP && "md:grid-cols-2")}>
                <CampoDiagnostico indice={i} campo="cie10" />
                {esEP ? <CampoDiagnostico indice={i} campo="agente_causante" /> : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {errorLista ? (
        <p role="alert" className="text-sm text-destructive">
          {errorLista}
        </p>
      ) : null}
      {esEP || fields.length ? (
        <p className="text-xs text-muted-foreground">
          {fields.length} de {MAX_DIAGNOSTICOS_EP} diagnósticos posibles.
        </p>
      ) : null}
    </div>
  );
}

function CampoDiagnostico({ indice, campo }: { indice: number; campo: "cie10" | "agente_causante" }) {
  const { control } = useFormContext<Entrada>();
  const { setEtiqueta } = useEtiquetas();
  const id = useId();
  const catalogo = campo === "cie10" ? "cie10" : "agente_causante";
  return (
    <Controller
      control={control}
      name={`diagnosticos.${indice}.${campo}`}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className="min-w-0">
          <EtiquetaCampo htmlFor={id} texto={campo === "cie10" ? "Diagnóstico CIE-10" : "Agente causante"} requerido />
          <CampoCatalogo
            id={id}
            catalogo={catalogo}
            valor={field.value || null}
            invalido={fieldState.invalid}
            placeholder={campo === "cie10" ? "Buscar por código o descripción…" : "Buscar agente de riesgo…"}
            onChange={(codigo, opcion) => {
              if (codigo && opcion) setEtiqueta(catalogo, codigo, opcion.descripcion);
              field.onChange(codigo ?? "");
              field.onBlur();
            }}
          />
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// Documentación (solo al cargar una denuncia nueva)
// ---------------------------------------------------------------------------
interface DocumentoPedido {
  clave: string;
  nombre: string;
  aclaracion?: string;
  exigencia: Exigencia | "opcional";
}

const OTRO_DOCUMENTO: DocumentoPedido = {
  clave: "otro",
  nombre: "Otro documento",
  exigencia: "opcional",
  aclaracion: "Cualquier otra documentación que acompañe la denuncia.",
};

const EXIGENCIA_ETIQUETA: Record<DocumentoPedido["exigencia"], { texto: string; clase: string }> = {
  obligatorio: { texto: "Obligatorio", clase: "bg-sky-50 text-sky-800 ring-sky-600/20" },
  si_corresponde: { texto: "Si corresponde", clase: "bg-zinc-50 text-zinc-700 ring-zinc-500/20" },
  opcional: { texto: "Opcional", clase: "bg-zinc-50 text-zinc-700 ring-zinc-500/20" },
};

export function SolapaDocumentacion() {
  const { control } = useFormContext<Entrada>();
  const [tipo, esIntercurrencia] = useWatch({ control, name: ["tipo", "es_intercurrencia"] });
  if (!tipo) return null;
  const pedidos: DocumentoPedido[] = [...documentosDeRecepcion(tipo), OTRO_DOCUMENTO];

  return (
    <Controller
      control={control}
      name="documentos"
      render={({ field }) => {
        const faltan = documentosFaltantes(
          tipo,
          field.value.map((d) => d.tipo),
        );
        return (
          <div className="flex flex-col gap-4">
            <div className="max-w-3xl">
              <h3 className="font-medium">Documentación recibida</h3>
              <p className="text-sm text-muted-foreground">
                Adjuntá el archivo digitalizado de cada documento. Podés elegir varios archivos, en distintas tandas y
                desde distintas carpetas.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{AVISO_ARCHIVOS_DEMO}</p>
            </div>

            {tipo === "IT" ? (
              <Alert>
                <InfoIcon />
                <AlertTitle>Documentación de in itinere</AlertTitle>
                <AlertDescription>{AVISO_IN_ITINERE}</AlertDescription>
              </Alert>
            ) : null}

            {esIntercurrencia ? (
              <Alert>
                <InfoIcon />
                <AlertTitle>Intercurrencia</AlertTitle>
                <AlertDescription>
                  La intercurrencia pasa directo al Área médica: la documentación de la recepción todavía no se exige (a
                  definir con la UERT). Adjuntá lo que haya traído la persona.
                </AlertDescription>
              </Alert>
            ) : faltan.length ? (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <TriangleAlertIcon />
                <AlertTitle>
                  {faltan.length === 1 ? "Falta" : "Faltan"}{" "}
                  {plural(faltan.length, "documento obligatorio", "documentos obligatorios")}
                </AlertTitle>
                <AlertDescription className="text-amber-900/80">
                  Podés registrar la denuncia igual, pero el pase al Área médica los va a pedir:{" "}
                  {faltan.map((f) => f.nombre).join(" · ")}.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <CircleCheckIcon />
                <AlertTitle>Documentación obligatoria completa</AlertTitle>
                <AlertDescription className="text-emerald-900/80">
                  Con la relación laboral verificada, la denuncia va a poder pasar al Área médica.
                </AlertDescription>
              </Alert>
            )}

            <ul className="divide-y rounded-lg border bg-background">
              {pedidos.map((doc) => {
                const archivos = field.value
                  .filter((d) => d.tipo === doc.clave)
                  .map((d) => ({ nombre: d.nombre_archivo, tamano: d.tamano_bytes ?? 0 }));
                const exigencia = EXIGENCIA_ETIQUETA[doc.exigencia];
                return (
                  <li key={doc.clave} className="flex flex-col gap-3 p-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {archivos.length ? (
                        <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Adjuntado" />
                      ) : (
                        <CircleDashedIcon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            doc.exigencia === "obligatorio" && !esIntercurrencia ? "text-amber-600" : "text-muted-foreground",
                          )}
                          aria-label="Sin adjuntar"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium">{doc.nombre}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Etiqueta className={exigencia.clase}>{exigencia.texto}</Etiqueta>
                          {doc.aclaracion ? <span>{doc.aclaracion}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="md:w-96 md:shrink-0">
                      <SelectorArchivos
                        valor={archivos}
                        textoBoton="Adjuntar"
                        etiqueta={`Adjuntar ${doc.nombre}`}
                        onChange={(nuevos) =>
                          field.onChange([
                            ...field.value.filter((d) => d.tipo !== doc.clave),
                            ...nuevos.map((a) => ({ tipo: doc.clave, nombre_archivo: a.nombre, tamano_bytes: a.tamano })),
                          ])
                        }
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      }}
    />
  );
}
