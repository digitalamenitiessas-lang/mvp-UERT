import Link from "next/link";
import {
  BedIcon,
  CalendarClockIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  GavelIcon,
  PrinterIcon,
  StethoscopeIcon,
  type LucideIcon,
} from "lucide-react";
import { EstadoCitacionBadge, EstadoDiagnosticoBadge, Etiqueta } from "@/components/comun/badges";
import { Dato } from "@/components/comun/pagina";
import type { PanelProps } from "@/components/comun/panel";
import { PanelArea } from "@/components/comun/panel-area";
import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getDb } from "@/lib/db";
import { MAX_DIAGNOSTICOS_EP, MOTIVO_CITACION_INFO, PLAZOS, type TipoDenuncia } from "@/lib/dominio/constantes";
import { fechaDe, formatoFecha, formatoFechaHora, hoy, sumarDias, sumarDiasHabiles } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { plural } from "@/lib/formato";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import type { Citacion, DiagnosticoDetalle } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { BotonPasarALegal } from "./boton-pasar-a-legal";
import { BotonesAsistencia } from "./botones-asistencia";
import { DialogoAgregarDiagnostico } from "./dialogo-agregar-diagnostico";
import { DialogoBaja } from "./dialogo-baja";
import { DialogoCitacion } from "./dialogo-citacion";
import { DialogoDesistir } from "./dialogo-desistir";
import { DialogoEvaluarDiagnostico } from "./dialogo-evaluar-diagnostico";
import { DialogoReencuadre } from "./dialogo-reencuadre";
import type { CitacionAReiterar, DatoFodep, DiagnosticoEvaluable, LimitesCitacion } from "./tipos";
import { TONO, cuandoRelativo, yaPaso } from "./utilidades";

/**
 * Acciones del Área médica en la ficha del expediente: evaluación de cada
 * diagnóstico, citaciones, baja laboral, reencuadre, desistimiento y pase al
 * Área legal. Solo para el rol médico con el expediente en evaluación médica.
 * El detalle completo de diagnósticos y citaciones está en las solapas de la ficha.
 */
export function PanelMedico(props: PanelProps) {
  if (props.usuario.rol !== "medico" || props.ficha.expediente.estado !== "evaluacion_medica") return null;
  return <PanelMedicoContenido {...props} />;
}

async function PanelMedicoContenido({ ficha, usuario }: PanelProps) {
  const exp = ficha.expediente;
  const { estado, tipo } = exp;
  const rol = usuario.rol;
  const feriados = await cargarFeriados(await getDb());
  const ahora = new Date();
  const hoyISO = hoy(ahora);

  // Diagnósticos (los desistidos no cuentan)
  const diagnosticos = ficha.diagnosticos.filter((d) => d.estado !== "desistido");
  const evaluados = diagnosticos.filter((d) => d.estado === "evaluado").length;

  // Citaciones: una sola programada a la vez y una única reiteración por inasistencia
  const reiteradas = new Set(ficha.citaciones.flatMap((c) => (c.reiteracion_de ? [c.reiteracion_de] : [])));
  const programada = ficha.citaciones.find((c) => c.estado === "programada") ?? null;
  const esReiterable = (c: Citacion) => c.estado === "no_asistio" && !c.reiteracion_de && !reiteradas.has(c.id);
  const hayParaReiterar = ficha.citaciones.some(esReiterable);
  const minimo = new Date(ahora.getTime() + PLAZOS.citacionHorasMinimas * 3_600_000);
  const limites: LimitesCitacion = {
    sugerida: sumarDiasHabiles(fechaDe(minimo), 1, feriados),
    minimaFecha: fechaDe(minimo),
    minimaTexto: formatoFechaHora(minimo),
  };

  // Pase al Área legal: los mismos controles que hace el servidor
  const controles = [
    {
      ok: diagnosticos.length > 0 && evaluados === diagnosticos.length,
      texto: diagnosticos.length
        ? `Diagnósticos evaluados: ${evaluados} de ${diagnosticos.length}`
        : "Falta cargar al menos un diagnóstico",
    },
    {
      ok: exp.con_baja !== null,
      texto: exp.con_baja === null ? "Baja laboral sin definir" : `Baja laboral definida: ${exp.con_baja ? "con baja" : "sin baja"}`,
    },
    {
      ok: !programada,
      texto: programada ? "Hay una citación programada sin resultado" : "Sin citaciones pendientes de resultado",
    },
  ];
  const faltan = controles.filter((c) => !c.ok).length;
  const venceLegal = sumarDiasHabiles(hoyISO, PLAZOS.legalDiasHabiles, feriados);

  const puedeEvaluar = puede(rol, "evaluar_diagnostico", estado);
  const puedeAgregar = puede(rol, "agregar_diagnostico", estado);
  const puedeCitar = puede(rol, "programar_citacion", estado);
  const puedeAsistencia = puede(rol, "registrar_asistencia", estado);
  const puedeBaja = puede(rol, "definir_baja", estado);
  const puedePasar = puede(rol, "pasar_a_legal", estado);
  const puedeReencuadrar = tipo === "AT" && puede(rol, "reencuadrar_ep", estado);
  const puedeDesistir = puede(rol, "desistir", estado);
  const faltanFodep = puedeReencuadrar ? datosFodepFaltantes(ficha) : [];

  return (
    <PanelArea
      rol="medico"
      className="@container"
      descripcion="Evaluá los diagnósticos, definí la baja laboral y pasá el expediente al Área legal."
    >
      <CardContent className="flex flex-col gap-5">
        {/* Diagnósticos */}
        <Bloque
          icono={StethoscopeIcon}
          titulo="Diagnósticos"
          resumen={diagnosticos.length ? `${evaluados} de ${diagnosticos.length} evaluados` : "Sin diagnósticos"}
        >
          {diagnosticos.length ? (
            <ul className="grid gap-2 @xl:grid-cols-2">
              {diagnosticos.map((dx) => (
                <li key={dx.id} className="flex flex-col gap-1.5 rounded-lg border bg-background p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm">
                      <span className="text-muted-foreground">{dx.orden}.</span>{" "}
                      <span className="font-mono font-semibold">{dx.cie10}</span>
                      {dx.cie10_adecuado ? (
                        <span className="text-muted-foreground" title="Adecuación CIE-10 (Res. SRT 475/17)">
                          {" → "}
                          <span className="font-mono font-semibold text-foreground">{dx.cie10_adecuado}</span>
                        </span>
                      ) : null}
                    </p>
                    <EstadoDiagnosticoBadge estado={dx.estado} />
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {dx.cie10_adecuado_descripcion ?? dx.cie10_descripcion}
                  </p>
                  {dx.estado === "evaluado" ? <ResumenEvaluacion dx={dx} tipo={tipo} /> : null}
                  {tipo === "EP" && !dx.agente_causante ? (
                    <p className="text-xs text-amber-700">Falta el agente causante.</p>
                  ) : null}
                  {puedeEvaluar ? (
                    <div className="pt-0.5">
                      <DialogoEvaluarDiagnostico diagnostico={evaluable(dx)} tipo={tipo} hoy={hoyISO} />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Vacio>Todavía no hay diagnósticos: agregá el CIE-10 para poder evaluarlo.</Vacio>
          )}
          {puedeAgregar ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <DialogoAgregarDiagnostico expedienteId={exp.id} tipo={tipo} cantidad={diagnosticos.length} />
              {tipo === "EP" ? (
                <span className="text-xs text-muted-foreground">Hasta {MAX_DIAGNOSTICOS_EP} en EP</span>
              ) : null}
            </div>
          ) : null}
        </Bloque>

        <Separator />

        {/* Citaciones */}
        <Bloque
          icono={CalendarClockIcon}
          titulo="Citaciones"
          resumen={
            programada
              ? "Hay una citación programada"
              : hayParaReiterar
                ? "No asistió: corresponde reiterar"
                : ficha.citaciones.length
                  ? plural(ficha.citaciones.length, "citación", "citaciones")
                  : "Sin citaciones"
          }
        >
          {ficha.citaciones.length ? (
            <ul className="grid gap-2 @xl:grid-cols-2">
              {ficha.citaciones.map((c) => {
                const pasada = c.estado === "programada" && yaPaso(c.fecha_hora, ahora);
                const reiterable = esReiterable(c);
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "flex flex-col gap-2 rounded-lg border bg-background p-2.5",
                      pasada && "border-amber-300 bg-amber-50/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium tabular-nums">{formatoFechaHora(c.fecha_hora)}</p>
                        <p className="text-xs text-muted-foreground">
                          {MOTIVO_CITACION_INFO[c.motivo]}
                          {c.estado === "programada" && !pasada ? ` · ${cuandoRelativo(c.fecha_hora, ahora)}` : null}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <EstadoCitacionBadge estado={c.estado} />
                        {c.reiteracion_de ? <Etiqueta className={TONO.ambar}>Reiteración</Etiqueta> : null}
                        {reiteradas.has(c.id) ? <Etiqueta className={TONO.gris}>Reiterada</Etiqueta> : null}
                      </div>
                    </div>
                    {pasada ? <p className="text-xs font-medium text-amber-800">Ya pasó la fecha: registrá si asistió.</p> : null}
                    {c.estado === "programada" && c.reiteracion_de ? (
                      <p className="text-xs text-amber-800">Si no asiste, caduca el trámite (Anexo II pto. 3.3).</p>
                    ) : null}
                    {reiterable ? (
                      <p className="text-xs text-red-700">
                        Se reitera por única vez, bajo apercibimiento de caducidad (Anexo II pto. 3.3).
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {c.estado === "programada" && puedeAsistencia ? (
                        <BotonesAsistencia
                          citacionId={c.id}
                          esReiteracion={!!c.reiteracion_de}
                          fecha={formatoFechaHora(c.fecha_hora)}
                          yaPaso={pasada}
                        />
                      ) : null}
                      {reiterable && puedeCitar && !programada ? (
                        <DialogoCitacion expedienteId={exp.id} limites={limites} reiteracion={aReiterar(c)} />
                      ) : null}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/imprimir/citacion/${c.id}`} target="_blank" rel="noopener">
                          <PrinterIcon />
                          Imprimir citación
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Vacio>
              Si hace falta un examen, estudios o documentación, citá al trabajador con al menos{" "}
              {PLAZOS.citacionHorasMinimas} h de anticipación.
            </Vacio>
          )}
          {puedeCitar ? (
            <div className="flex flex-col gap-1">
              <div>
                <DialogoCitacion expedienteId={exp.id} limites={limites} bloqueada={!!programada || hayParaReiterar} />
              </div>
              {programada ? (
                <p className="text-xs text-muted-foreground">
                  Para citar de nuevo, primero registrá el resultado de la citación programada.
                </p>
              ) : hayParaReiterar ? (
                <p className="text-xs text-muted-foreground">
                  No asistió a la última citación: la próxima es su reiteración («Reiterar citación», arriba).
                </p>
              ) : null}
            </div>
          ) : null}
        </Bloque>

        <Separator />

        {/* Baja laboral */}
        <Bloque
          icono={BedIcon}
          titulo="Baja laboral"
          resumen={exp.con_baja === null ? "A definir" : exp.con_baja ? "Con baja laboral" : "Sin baja laboral"}
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border bg-background p-2.5 @lg:grid-cols-3">
            <Dato etiqueta="Baja">
              {exp.con_baja === null ? (
                <span className="font-medium text-amber-700">A definir</span>
              ) : exp.con_baja ? (
                "Con baja"
              ) : (
                "Sin baja"
              )}
            </Dato>
            <Dato etiqueta="Desde">{exp.con_baja ? formatoFecha(exp.fecha_inicio_inasistencia) : "—"}</Dato>
            <Dato etiqueta="Estrés postraumático" className="col-span-2 @lg:col-span-1">
              {exp.estres_postraumatico ? "Sí" : "No"}
            </Dato>
          </dl>
          {puedeBaja ? (
            <div>
              <DialogoBaja
                expedienteId={exp.id}
                actual={{
                  con_baja: exp.con_baja,
                  fecha_inicio_inasistencia: exp.fecha_inicio_inasistencia,
                  estres_postraumatico: exp.estres_postraumatico,
                }}
                minimoInicio={tipo !== "EP" && exp.fecha_ocurrencia ? sumarDias(exp.fecha_ocurrencia, 1) : null}
                maximoInicio={sumarDias(hoyISO, 30)}
                fechaOcurrencia={exp.fecha_ocurrencia}
              />
            </div>
          ) : null}
        </Bloque>

        <Separator />

        {/* Pase al Área legal */}
        <Bloque
          icono={GavelIcon}
          titulo="Pase al Área legal"
          resumen={faltan ? plural(faltan, "requisito pendiente", "requisitos pendientes") : "Listo para el pase"}
        >
          <ul className="flex flex-col gap-1.5" aria-label="Requisitos para el pase">
            {controles.map((c) => (
              <li key={c.texto} className="flex items-start gap-2 text-sm">
                {c.ok ? (
                  <CircleCheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                ) : (
                  <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <span className={cn(!c.ok && "text-muted-foreground")}>
                  <span className="sr-only">{c.ok ? "Cumplido: " : "Pendiente: "}</span>
                  {c.texto}
                </span>
              </li>
            ))}
            {hayParaReiterar ? (
              <li className="flex items-start gap-2 text-sm text-amber-800">
                <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                Hay una inasistencia sin reiterar: si el examen hace falta, reiterá la citación antes del pase.
              </li>
            ) : null}
          </ul>
          <p className="text-xs text-muted-foreground">
            Al pasar, el Área legal tiene {PLAZOS.legalDiasHabiles} días hábiles para expedirse: vencería el{" "}
            <span className="font-medium text-foreground">{formatoFecha(venceLegal)}</span>.
          </p>
          {puedePasar ? (
            <BotonPasarALegal
              expedienteId={exp.id}
              habilitado={faltan === 0}
              dias={PLAZOS.legalDiasHabiles}
              vence={formatoFecha(venceLegal)}
              className="w-full @lg:w-fit"
            />
          ) : null}
        </Bloque>
      </CardContent>

      {puedeReencuadrar || puedeDesistir ? (
        <CardFooter className="flex-col items-stretch gap-1.5 @lg:flex-row @lg:flex-wrap @lg:items-center">
          <p className="text-xs text-muted-foreground @lg:mr-auto">Otras acciones</p>
          {puedeReencuadrar ? (
            <DialogoReencuadre
              expedienteId={exp.id}
              hoy={hoyISO}
              diagnosticos={diagnosticos.length}
              faltan={faltanFodep}
            />
          ) : null}
          {puedeDesistir ? <DialogoDesistir expedienteId={exp.id} tipo={tipo} /> : null}
        </CardFooter>
      ) : null}
    </PanelArea>
  );
}

/** Cada bloque del panel: ícono, título, resumen y contenido. */
function Bloque({
  icono: Icono,
  titulo,
  resumen,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  resumen?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5" aria-label={titulo}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15">
          <Icono className="size-3.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm leading-tight font-semibold">{titulo}</h3>
          {resumen ? <p className="text-xs text-muted-foreground">{resumen}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">{children}</p>;
}

/** Lo esencial de la evaluación (el detalle está en la solapa Diagnósticos). */
function ResumenEvaluacion({ dx, tipo }: { dx: DiagnosticoDetalle; tipo: TipoDenuncia }) {
  const partes: React.ReactNode[] = [dx.patologia_constatada ? "Constatada" : "No constatada"];
  if (tipo === "EP") {
    partes.push(
      dx.en_listado === null ? (
        "Listado sin indicar"
      ) : dx.en_listado ? (
        "En el Listado"
      ) : (
        <span className="font-medium text-amber-700">Fuera del Listado</span>
      ),
    );
  }
  partes.push(plural(dx.zonas.length, "zona", "zonas"));
  if (tipo !== "EP" || dx.lesiones.length) partes.push(plural(dx.lesiones.length, "lesión", "lesiones"));
  partes.push(formatoFecha(dx.fecha_diagnostico));
  return (
    <p className="text-xs text-muted-foreground">
      {partes.map((p, i) => (
        <span key={i}>
          {i ? " · " : null}
          {p}
        </span>
      ))}
    </p>
  );
}

/** Datos serializables del diagnóstico para el diálogo de evaluación. */
function evaluable(dx: DiagnosticoDetalle): DiagnosticoEvaluable {
  return {
    id: dx.id,
    orden: dx.orden,
    estado: dx.estado,
    cie10: dx.cie10,
    cie10_descripcion: dx.cie10_descripcion,
    cie10_adecuado: dx.cie10_adecuado,
    agente_causante: dx.agente_causante,
    agente_descripcion: dx.agente_descripcion,
    patologia_constatada: dx.patologia_constatada,
    en_listado: dx.en_listado,
    fecha_diagnostico: dx.fecha_diagnostico,
    codigo_examen: dx.codigo_examen,
    observacion_medica: dx.observacion_medica,
    lesiones: dx.lesiones.map(({ codigo, descripcion }) => ({ codigo, descripcion })),
    zonas: dx.zonas.map(({ codigo, descripcion }) => ({ codigo, descripcion })),
  };
}

/** Datos que exige la denuncia FODEP (WS FODEP, error FO26) y que el accidente no tiene. */
function datosFodepFaltantes({ persona, expediente: e }: PanelProps["ficha"]): DatoFodep[] {
  const telefonoValido = /^\d{6,15}$/.test((persona.telefono ?? "").replace(/\D/g, ""));
  const datos: Array<[DatoFodep, boolean]> = [
    ["telefono", telefonoValido],
    ["email", !!persona.email],
    ["domicilio_laboral", !!e.domicilio_laboral],
    ["localidad_laboral_id", e.localidad_laboral_id !== null],
    ["puesto", !!e.puesto],
    ["tareas", !!e.tareas],
    ["antiguedad_empresa", !!e.antiguedad_empresa],
    ["antiguedad_area", !!e.antiguedad_area],
  ];
  return datos.filter(([, cargado]) => !cargado).map(([dato]) => dato);
}

function aReiterar(c: Citacion): CitacionAReiterar {
  return {
    id: c.id,
    fecha: formatoFechaHora(c.fecha_hora),
    motivo: c.motivo,
    lugar: c.lugar,
    detalle: c.detalle,
  };
}
