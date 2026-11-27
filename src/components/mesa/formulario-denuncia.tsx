"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormProvider, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CircleCheckIcon, SaveIcon } from "lucide-react";
import { accionConsultarPersona, accionCrearDenuncia, accionEditarDenuncia } from "@/app/acciones";
import { TipoBadge } from "@/components/comun/badges";
import { ErrorAccion } from "@/components/comun/error-accion";
import { useAccion } from "@/components/comun/use-accion";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { documentosDeRecepcion, documentosFaltantes } from "@/lib/dominio/documentos";
import { dniCoincideConCuil, formatoCuil, MENSAJE_DNI_CUIL, soloDigitos } from "@/lib/dominio/validaciones";
import { esquemaNuevaDenuncia, type NuevaDenuncia } from "@/lib/esquemas";
import { plural } from "@/lib/formato";
import type { Persona } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { EtiquetasContext } from "./campos-denuncia";
import {
  armarDatos,
  claveEtiqueta,
  formatearCuit,
  nombreSolapa,
  primeraSolapaCon,
  problemasPorUbicacion,
  solapasDe,
  ubicacionDe,
  valoresVacios,
  type ClaveSolapa,
  type Entrada,
  type Ubicacion,
} from "./modelo";
import { PasoPersona, type Busqueda } from "./paso-persona";
import { RevisionDenuncia } from "./revision-denuncia";
import {
  SolapaDenunciante,
  SolapaDiagnosticos,
  SolapaDocumentacion,
  SolapaHecho,
  SolapaLaboral,
  SolapaTrabajador,
} from "./solapas-denuncia";

export type PropsFormularioDenuncia =
  | { modo: "nueva"; hoy: string }
  | {
      modo: "editar";
      hoy: string;
      expedienteId: number;
      valoresIniciales: Entrada;
      /** Descripciones de los códigos de catálogo ya cargados ("catalogo:codigo" → descripción). */
      etiquetasIniciales: Record<string, string>;
      /** Vínculo con otro siniestro, para mostrar (reingreso o intercurrencia). */
      vinculo?: string | null;
    };

type Paso = 1 | 2 | 3;

const PASOS: Array<{ numero: Paso; nombre: string }> = [
  { numero: 1, nombre: "Tipo y persona" },
  { numero: 2, nombre: "Formulario" },
  { numero: 3, nombre: "Revisar y registrar" },
];

function subir() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/**
 * Carga de una denuncia en Mesa de entrada: un único formulario con solapas
 * (RNF-01) dentro de un asistente de tres pasos. En modo "editar" corrige
 * una denuncia que sigue en Mesa de entrada (sin tipo, persona ni documentación).
 */
export function FormularioDenuncia(props: PropsFormularioDenuncia) {
  const { modo, hoy } = props;
  const expedienteId = props.modo === "editar" ? props.expedienteId : null;
  const router = useRouter();
  const solapas = solapasDe(modo);

  const form = useForm<Entrada, unknown, NuevaDenuncia>({
    resolver: zodResolver(esquemaNuevaDenuncia),
    defaultValues: props.modo === "editar" ? props.valoresIniciales : valoresVacios(),
    mode: "onTouched",
  });
  const { control, getValues, setValue, setError, trigger, handleSubmit } = form;

  const valores = useWatch({ control });
  const problemas = useMemo(() => problemasPorUbicacion(valores), [valores]);

  const [paso, setPaso] = useState<Paso>(modo === "editar" ? 2 : 1);
  const [solapa, setSolapa] = useState<ClaveSolapa>("trabajador");
  const [busqueda, setBusqueda] = useState<Busqueda | null>(null);
  const [avisoDecision, setAvisoDecision] = useState(false);
  const [intento, setIntento] = useState(false);
  const [navegando, setNavegando] = useState(false);
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>(
    props.modo === "editar" ? props.etiquetasIniciales : {},
  );
  /** CUIL de la persona cuyos datos se precargaron. */
  const precargadoDe = useRef<string | null>(null);
  const consulta = useAccion();
  const registro = useAccion();

  const setEtiqueta = useCallback((catalogo: string, codigo: string | number, descripcion: string) => {
    setEtiquetas((e) => {
      const clave = claveEtiqueta(catalogo, codigo);
      return e[clave] === descripcion ? e : { ...e, [clave]: descripcion };
    });
  }, []);
  const contextoEtiquetas = useMemo(() => ({ etiquetas, setEtiqueta }), [etiquetas, setEtiqueta]);

  const tipo = valores.tipo;
  const claveActual = `${soloDigitos(valores.cuil ?? "")}|${soloDigitos(valores.dni ?? "")}`;
  const busquedaVigente = busqueda && busqueda.clave === claveActual ? busqueda : null;
  const faltanDocumentos =
    tipo && !valores.es_intercurrencia
      ? documentosFaltantes(
          tipo,
          (valores.documentos ?? []).map((d) => d?.tipo ?? ""),
        ).length
      : 0;
  const ocupado = registro.pendiente || navegando;

  // -------------------------------------------------------------------------
  // Paso 1: tipo y persona
  // -------------------------------------------------------------------------
  function cargarPersona(p: Persona | null) {
    const opciones = { shouldDirty: true };
    setValue("apellido", p?.apellido ?? "", opciones);
    setValue("nombres", p?.nombres ?? "", opciones);
    setValue("fecha_nacimiento", p?.fecha_nacimiento ?? "", opciones);
    setValue("sexo", p?.sexo ?? "", opciones);
    setValue("telefono", p?.telefono ?? "", opciones);
    setValue("email", p?.email ?? "", opciones);
    setValue("domicilio", p?.domicilio ?? "", opciones);
    setValue("localidad_id", p?.localidad_id ?? null, opciones);
  }

  function aplicarBusqueda(b: Busqueda) {
    setBusqueda(b);
    setAvisoDecision(false);
    // El vínculo con un siniestro se decide de nuevo para cada búsqueda
    setValue("origen_id", null);
    setValue("es_intercurrencia", false);
    setValue("confirmo_hecho_distinto", false);
    const cuil = b.clave.split("|")[0];
    if (b.persona && b.persona.cuil === cuil) {
      cargarPersona(b.persona);
      precargadoDe.current = cuil;
    } else if (precargadoDe.current && precargadoDe.current !== cuil) {
      // Los datos precargados eran de otra persona
      cargarPersona(null);
      precargadoDe.current = null;
    }
  }

  function irAlFormulario() {
    const t = getValues("tipo");
    const diagnosticos = getValues("diagnosticos");
    if (t === "EP") {
      if (diagnosticos.length === 0) setValue("diagnosticos", [{ cie10: "", agente_causante: "" }]);
    } else {
      // En accidentes el diagnóstico es opcional y no lleva agente causante
      const conCodigo = diagnosticos.filter((d) => d.cie10).map((d) => ({ cie10: d.cie10, agente_causante: "" }));
      if (conCodigo.length !== diagnosticos.length || diagnosticos.some((d) => d.agente_causante)) {
        setValue("diagnosticos", conCodigo);
      }
    }
    // Documentos de otro tipo de denuncia (si se cambió el tipo)
    const delTipo = new Set([...documentosDeRecepcion(t).map((d) => d.clave), "otro"]);
    const documentos = getValues("documentos");
    if (documentos.some((d) => !delTipo.has(d.tipo))) {
      setValue(
        "documentos",
        documentos.filter((d) => delTipo.has(d.tipo)),
      );
    }
    setAvisoDecision(false);
    setPaso(2);
    subir();
  }

  function seguir(b: Busqueda) {
    const vinculada = getValues("es_intercurrencia") && getValues("origen_id") !== null;
    if (b.abiertos.length && !vinculada && !getValues("confirmo_hecho_distinto")) {
      setAvisoDecision(true);
      return;
    }
    irAlFormulario();
  }

  async function buscar(continuar: boolean) {
    const tipoElegido = getValues("tipo");
    if (continuar && !tipoElegido) setError("tipo", { type: "manual", message: "Elegí el tipo de denuncia." });
    const valido = await trigger(["cuil", "dni"], { shouldFocus: true });
    if (!valido) return;
    const cuil = soloDigitos(getValues("cuil"));
    const dni = soloDigitos(getValues("dni"));
    // El esquema ya lo controla, pero su superRefine no corre mientras falte el tipo.
    if (!dniCoincideConCuil(cuil, dni)) {
      setError("dni", { type: "manual", message: MENSAJE_DNI_CUIL }, { shouldFocus: true });
      return;
    }
    if (continuar && !tipoElegido) return;
    const clave = `${cuil}|${dni}`;
    if (busqueda?.clave === clave) {
      if (continuar) seguir(busqueda);
      return;
    }
    consulta.ejecutar(() => accionConsultarPersona(cuil, dni), {
      silencioso: true,
      alTerminar: (datos) => {
        const nueva: Busqueda = { clave, persona: datos.persona, abiertos: datos.abiertos };
        aplicarBusqueda(nueva);
        if (continuar) seguir(nueva);
      },
    });
  }

  function usarCuil(cuil: string) {
    setValue("cuil", formatearCuit(cuil), { shouldValidate: true });
    void buscar(false);
  }

  // -------------------------------------------------------------------------
  // Pasos 2 y 3: solapas, revisión y registro
  // -------------------------------------------------------------------------
  function irA(destino: Ubicacion) {
    if (destino === "persona") {
      setPaso(1);
    } else {
      setSolapa(destino);
      setPaso(2);
    }
    subir();
  }

  function alFallar(errores: FieldErrors<Entrada>) {
    setIntento(true);
    const campos = Object.keys(errores);
    if (modo === "nueva" && campos.some((c) => ubicacionDe(c) === "persona")) {
      setPaso(1);
    } else {
      const primera = primeraSolapaCon(campos, solapas);
      if (primera) setSolapa(primera);
      setPaso(2);
    }
    subir();
    const total = Object.values(problemas).reduce((a, b) => a + b, 0) || campos.length;
    toast.error("Revisá los datos marcados", {
      description: `Hay ${plural(total, "dato", "datos")} para completar o corregir.`,
    });
  }

  const revisar = handleSubmit(() => {
    setPaso(3);
    subir();
  }, alFallar);

  const registrar = handleSubmit((datos) => {
    const enviar = armarDatos(datos, modo);
    if (expedienteId === null) {
      registro.ejecutar(() => accionCrearDenuncia(enviar), {
        silencioso: true,
        alTerminar: (creada) => {
          setNavegando(true);
          toast.success(`Denuncia registrada: expediente ${creada.numero}`, {
            description: "Se emitió la constancia de recepción.",
          });
          router.push(`/expedientes/${creada.id}?nueva=1`);
        },
      });
    } else {
      registro.ejecutar(() => accionEditarDenuncia(expedienteId, enviar), {
        alTerminar: () => {
          setNavegando(true);
          router.push(`/expedientes/${expedienteId}`);
        },
      });
    }
  }, alFallar);

  const indiceSolapa = solapas.indexOf(solapa);
  const siguienteSolapa = solapas[indiceSolapa + 1] ?? null;

  return (
    <FormProvider {...form}>
      <EtiquetasContext.Provider value={contextoEtiquetas}>
        <form onSubmit={(e) => e.preventDefault()} noValidate className="flex flex-col gap-5">
          {props.modo === "nueva" ? (
            <div data-recorrido="pasos-denuncia">
              <IndicadorPasos paso={paso} onIr={(n) => (n === 1 ? irA("persona") : irA(solapa))} />
            </div>
          ) : (
            <Card size="sm">
              <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">Tipo</span>
                  {tipo ? <TipoBadge tipo={tipo} largo /> : null}
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-muted-foreground">CUIL</span>
                  <span className="font-mono">{formatoCuil(valores.cuil ?? "")}</span>
                </span>
                {props.vinculo ? <span className="text-muted-foreground">{props.vinculo}</span> : null}
                <p className="basis-full text-xs text-muted-foreground">
                  El tipo de denuncia y la persona no se pueden cambiar: si hay un error en esos datos, desistí la
                  denuncia y cargá una nueva. La documentación se adjunta desde la ficha del expediente.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Paso 1 */}
          {props.modo === "nueva" ? (
            <div hidden={paso !== 1} data-recorrido="paso-persona">
              <Card>
                <CardHeader>
                  <CardTitle>Tipo de denuncia y persona</CardTitle>
                  <CardDescription>
                    Antes de cargar la denuncia controlamos si la persona tiene siniestros abiertos, en este sistema y en el actual.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PasoPersona
                    busqueda={busquedaVigente}
                    buscando={consulta.pendiente}
                    errorBusqueda={consulta.error}
                    avisoDecision={avisoDecision}
                    onBuscar={() => void buscar(false)}
                    onUsarCuil={usarCuil}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Paso 2: un único formulario con solapas (RNF-01) */}
          <div hidden={paso !== 2}>
            <Card className="gap-0 py-0">
              <Tabs value={solapa} onValueChange={(v) => setSolapa(v as ClaveSolapa)} className="gap-0">
                <div className="border-b p-3">
                  <TabsList
                    aria-label="Solapas del formulario"
                    className="h-auto w-full flex-wrap justify-start gap-1 group-data-horizontal/tabs:h-auto"
                  >
                    {solapas.map((s) => (
                      <TabsTrigger key={s} value={s} className="h-7 flex-none px-2.5">
                        {nombreSolapa(s, tipo)}
                        <IndicadorSolapa
                          problemas={problemas[s]}
                          aviso={s === "documentacion" ? faltanDocumentos : 0}
                          intento={intento}
                        />
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
                {solapas.map((s) => (
                  <TabsContent key={s} value={s} forceMount className="p-4 data-[state=inactive]:hidden sm:p-6">
                    {s === "trabajador" ? <SolapaTrabajador modo={modo} hoy={hoy} /> : null}
                    {s === "denunciante" ? <SolapaDenunciante /> : null}
                    {s === "laboral" ? <SolapaLaboral /> : null}
                    {s === "hecho" ? <SolapaHecho hoy={hoy} /> : null}
                    {s === "diagnosticos" ? <SolapaDiagnosticos /> : null}
                    {s === "documentacion" ? <SolapaDocumentacion /> : null}
                  </TabsContent>
                ))}
              </Tabs>
            </Card>
          </div>

          {/* Paso 3 */}
          {props.modo === "nueva" && paso === 3 && tipo ? (
            <RevisionDenuncia
              valores={getValues()}
              etiquetas={etiquetas}
              busqueda={busquedaVigente}
              problemas={problemas}
              onIrA={irA}
            />
          ) : null}

          {paso !== 1 ? <ErrorAccion error={registro.error} /> : null}

          {/* Barra de acciones */}
          <div className="sticky bottom-0 z-20 -mx-4 flex items-center justify-between gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
            <div className="flex min-w-0 items-center gap-2">
              {paso === 1 ? (
                <Link href="/mesa" className={buttonVariants({ variant: "ghost" })}>
                  Cancelar
                </Link>
              ) : null}
              {paso === 2 && props.modo === "nueva" ? (
                <Button type="button" variant="ghost" onClick={() => irA("persona")} disabled={ocupado}>
                  <ArrowLeftIcon />
                  <span className="max-sm:sr-only">Tipo y persona</span>
                </Button>
              ) : null}
              {paso === 2 && props.modo === "editar" ? (
                <Link href={`/expedientes/${props.expedienteId}`} className={buttonVariants({ variant: "ghost" })}>
                  Cancelar
                </Link>
              ) : null}
              {paso === 3 ? (
                <Button type="button" variant="ghost" onClick={() => irA(solapa)} disabled={ocupado}>
                  <ArrowLeftIcon />
                  <span className="max-sm:sr-only">Volver al formulario</span>
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {paso === 1 ? (
                <Button type="button" onClick={() => void buscar(true)} disabled={consulta.pendiente}>
                  {consulta.pendiente ? <Spinner /> : null}
                  Continuar
                  <ArrowRightIcon />
                </Button>
              ) : null}
              {paso === 2 && siguienteSolapa ? (
                <Button
                  type="button"
                  variant="outline"
                  className="max-sm:hidden"
                  onClick={() => {
                    setSolapa(siguienteSolapa);
                    subir();
                  }}
                >
                  Siguiente: {nombreSolapa(siguienteSolapa, tipo)}
                </Button>
              ) : null}
              {paso === 2 && props.modo === "nueva" ? (
                <Button type="button" onClick={() => void revisar()}>
                  Revisar y registrar
                  <ArrowRightIcon />
                </Button>
              ) : null}
              {paso === 2 && props.modo === "editar" ? (
                <Button type="button" onClick={() => void registrar()} disabled={ocupado}>
                  {ocupado ? <Spinner /> : <SaveIcon />}
                  Guardar cambios
                </Button>
              ) : null}
              {paso === 3 ? (
                <Button type="button" onClick={() => void registrar()} disabled={ocupado}>
                  {ocupado ? <Spinner /> : <CheckIcon />}
                  Registrar denuncia
                </Button>
              ) : null}
            </div>
          </div>
        </form>
      </EtiquetasContext.Provider>
    </FormProvider>
  );
}

/** Pasos del asistente; se puede volver a un paso anterior. */
function IndicadorPasos({ paso, onIr }: { paso: Paso; onIr: (paso: Paso) => void }) {
  return (
    <nav aria-label="Pasos de la carga">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {PASOS.map((p, i) => {
          const estado = p.numero < paso ? "hecho" : p.numero === paso ? "actual" : "pendiente";
          const contenido = (
            <>
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  estado === "actual" && "border-primary bg-primary text-primary-foreground",
                  estado === "hecho" && "border-primary/30 bg-primary/10 text-primary",
                  estado === "pendiente" && "bg-background text-muted-foreground",
                )}
              >
                {estado === "hecho" ? <CheckIcon className="size-3.5" aria-hidden="true" /> : p.numero}
              </span>
              <span className={cn(estado === "actual" ? "font-medium text-foreground" : "text-muted-foreground")}>
                {p.nombre}
              </span>
            </>
          );
          return (
            <li key={p.numero} className="flex items-center gap-2">
              {i > 0 ? <span aria-hidden="true" className="hidden h-px w-10 bg-border sm:block" /> : null}
              {estado === "hecho" ? (
                <button
                  type="button"
                  onClick={() => onIr(p.numero)}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {contenido}
                  <span className="sr-only"> (volver a este paso)</span>
                </button>
              ) : (
                <span className="flex items-center gap-2 px-1.5 py-1" aria-current={estado === "actual" ? "step" : undefined}>
                  {contenido}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Tilde si la solapa está completa; si no, cuántos datos faltan o están mal. */
function IndicadorSolapa({ problemas, aviso, intento }: { problemas: number; aviso: number; intento: boolean }) {
  const burbuja = "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.65rem] font-semibold tabular-nums";
  if (problemas > 0) {
    return (
      <span className={cn(burbuja, intento ? "bg-destructive text-white" : "bg-amber-100 text-amber-800")}>
        {problemas}
        <span className="sr-only"> {problemas === 1 ? "dato por completar" : "datos por completar"}</span>
      </span>
    );
  }
  if (aviso > 0) {
    return (
      <span className={cn(burbuja, "bg-amber-100 text-amber-800")} title="Documentos obligatorios sin adjuntar">
        {aviso}
        <span className="sr-only"> {aviso === 1 ? "documento obligatorio sin adjuntar" : "documentos obligatorios sin adjuntar"}</span>
      </span>
    );
  }
  return (
    <>
      <CircleCheckIcon className="size-3.5 text-emerald-600" aria-hidden="true" />
      <span className="sr-only"> (completa)</span>
    </>
  );
}
