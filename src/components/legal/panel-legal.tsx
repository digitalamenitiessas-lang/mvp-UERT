import Link from "next/link";
import {
  CalendarClockIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  FileTextIcon,
  LandmarkIcon,
  MailIcon,
  PrinterIcon,
  SendIcon,
  StampIcon,
  StethoscopeIcon,
  type LucideIcon,
} from "lucide-react";
import {
  EstadoBadge,
  EstadoDiagnosticoBadge,
  Etiqueta,
  PlazoBadge,
  Simulado,
} from "@/components/comun/badges";
import type { PanelProps } from "@/components/comun/panel";
import { PanelArea } from "@/components/comun/panel-area";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { getDb } from "@/lib/db";
import type { PlazoExpediente } from "@/lib/datos/expedientes";
import {
  MOTIVO_RECHAZO_INFO,
  PLAZOS,
  UERT,
  type EstadoExpediente,
  type MotivoRechazo,
} from "@/lib/dominio/constantes";
import { formatoFecha, formatoFechaHora, hoy, sumarDiasHabiles, type FechaISO } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { plural } from "@/lib/formato";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import type { DiagnosticoDetalle, Expediente } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { DialogoCerrarDictamen } from "./dialogo-cerrar-dictamen";
import { DialogoDecision, type DiagnosticoParaDecidir } from "./dialogo-decision";
import { DialogoPresentacionCM } from "./dialogo-presentacion-cm";
import { DialogoProrroga } from "./dialogo-prorroga";
import { CLASE_MOTIVO, motivosPermitidos } from "./motivos";

/** Código y descripción vigentes: los adecuados por el área médica o, si no hay, los invocados. */
function cie10Vigente(d: DiagnosticoDetalle): { codigo: string; descripcion: string } {
  return d.cie10_adecuado
    ? { codigo: d.cie10_adecuado, descripcion: d.cie10_adecuado_descripcion ?? d.cie10_descripcion }
    : { codigo: d.cie10, descripcion: d.cie10_descripcion };
}

const rutaNotificacion = (id: number) => `/imprimir/rechazo/${id}`;

/**
 * Acciones del Área legal en la ficha del expediente: plazo y prórroga,
 * decisión por diagnóstico, cierre del dictamen, presentación ante la
 * Comisión Médica (aceptados sin baja) y notificación de rechazo.
 */
export function PanelLegal(props: PanelProps) {
  const { ficha, usuario, plazos } = props;
  if (usuario.rol !== "legal") return null;

  const exp = ficha.expediente;
  const activos = ficha.diagnosticos.filter((d) => d.estado !== "desistido");
  const rechazados = activos.filter((d) => d.estado === "rechazado");
  const enDictamen = exp.estado === "dictamen_legal";
  const conComisionMedica = exp.estado === "sin_baja" && puede(usuario.rol, "registrar_presentacion_cm", exp.estado);
  if (!enDictamen && !conComisionMedica && !rechazados.length) return null;

  const descripcion = enDictamen
    ? `Aceptá o rechazá cada diagnóstico y cerrá el dictamen dentro del plazo de ${PLAZOS.legalDiasHabiles} días hábiles${
        exp.legal_prorroga_usada ? ` (con la prórroga de ${PLAZOS.prorrogaDiasHabiles})` : ""
      }.`
    : conComisionMedica
      ? "La contingencia se aceptó sin baja laboral: falta presentar el trámite ante la Comisión Médica."
      : "El dictamen rechazó diagnósticos: desde acá podés volver a imprimir la notificación.";

  return (
    <PanelArea rol="legal" className="@container/legal" descripcion={descripcion}>
      <CardContent className="flex flex-col gap-5">
        {enDictamen ? (
          <Dictamen
            exp={exp}
            diagnosticos={activos}
            plazo={plazos.find((p) => p.clave === "legal")}
            cymatEnExpediente={ficha.documentos.some((d) => d.tipo === "cymat")}
            puedeDecidir={puede(usuario.rol, "decidir_diagnostico", exp.estado)}
            puedeProrroga={puede(usuario.rol, "solicitar_prorroga", exp.estado)}
            puedeCerrar={puede(usuario.rol, "cerrar_dictamen", exp.estado)}
          />
        ) : null}
        {conComisionMedica ? (
          <ComisionMedica exp={exp} plazo={plazos.find((p) => p.clave === "comision_medica")} />
        ) : null}
        {!enDictamen && rechazados.length ? <NotificacionRechazo expedienteId={exp.id} rechazados={rechazados} /> : null}
      </CardContent>
    </PanelArea>
  );
}

// ---------------------------------------------------------------------------
// Dictamen legal
// ---------------------------------------------------------------------------
function Dictamen({
  exp,
  diagnosticos,
  plazo,
  cymatEnExpediente,
  puedeDecidir,
  puedeProrroga,
  puedeCerrar,
}: {
  exp: Expediente;
  diagnosticos: DiagnosticoDetalle[];
  plazo: PlazoExpediente | undefined;
  cymatEnExpediente: boolean;
  puedeDecidir: boolean;
  puedeProrroga: boolean;
  puedeCerrar: boolean;
}) {
  const motivos = motivosPermitidos(exp);
  const aceptados = diagnosticos.filter((d) => d.estado === "aceptado");
  const rechazados = diagnosticos.filter((d) => d.estado === "rechazado");
  const pendientes = diagnosticos.filter((d) => d.estado !== "aceptado" && d.estado !== "rechazado");
  const decididos = aceptados.length + rechazados.length;

  return (
    <>
      {/* Plazo y prórroga */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2.5">
        <div className="flex min-w-0 items-start gap-2.5">
          <CalendarClockIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Plazo para expedirse</span>
              {plazo ? <PlazoBadge plazo={plazo} /> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Ingresó al Área legal el {formatoFecha(exp.legal_ingreso)} · vence el {formatoFecha(exp.legal_vence)}{" "}
              {exp.legal_prorroga_usada
                ? `(${PLAZOS.legalDiasHabiles} días hábiles + ${PLAZOS.prorrogaDiasHabiles} de prórroga)`
                : `(${PLAZOS.legalDiasHabiles} días hábiles)`}
            </p>
          </div>
        </div>
        {exp.legal_prorroga_usada ? (
          <Etiqueta className="bg-violet-50 text-violet-800 ring-violet-600/20">Prórroga usada</Etiqueta>
        ) : puedeProrroga && exp.legal_vence ? (
          <ProrrogaLegal expedienteId={exp.id} vence={exp.legal_vence} />
        ) : null}
      </div>

      {/* Diagnósticos */}
      <section aria-labelledby={`legal-dx-${exp.id}`} className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`legal-dx-${exp.id}`} className="text-sm font-medium">
            Diagnósticos
          </h3>
          <Avance decididos={decididos} total={diagnosticos.length} />
        </div>
        {diagnosticos.length ? (
          <ul className="flex flex-col gap-3">
            {diagnosticos.map((d) => (
              <TarjetaDiagnostico
                key={d.id}
                d={d}
                exp={exp}
                motivos={motivos}
                cymatEnExpediente={cymatEnExpediente}
                puedeDecidir={puedeDecidir}
              />
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-sm text-muted-foreground">
            El expediente no tiene diagnósticos para decidir.
          </p>
        )}
      </section>

      {/* Cierre */}
      <section
        aria-labelledby={`legal-cierre-${exp.id}`}
        className="flex flex-col gap-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id={`legal-cierre-${exp.id}`} className="flex items-center gap-2 text-sm font-medium">
              <StampIcon className="size-4 text-violet-700" aria-hidden />
              Cierre del dictamen
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Se cierra cuando todos los diagnósticos tienen decisión.
            </p>
          </div>
          {puedeCerrar ? (
            <DialogoCerrarDictamen expedienteId={exp.id} numero={exp.numero} habilitado={!pendientes.length && decididos > 0}>
              <ConsecuenciasCierre exp={exp} aceptados={aceptados.length} rechazados={rechazados.length} />
            </DialogoCerrarDictamen>
          ) : null}
        </div>
        {pendientes.length ? (
          <p className="text-sm">
            Falta decidir {plural(pendientes.length, "diagnóstico")}:{" "}
            {pendientes.map((d) => `${d.orden} (${cie10Vigente(d).codigo})`).join(", ")}. Cuando estén todos, vas a poder
            cerrar el dictamen y ver qué pasa con el expediente.
          </p>
        ) : decididos ? (
          <div className="flex flex-col gap-1 text-sm">
            <p className="flex flex-wrap items-center gap-1.5">
              Al cerrarlo, el expediente pasa a <EstadoBadge estado={resultadoCierre(exp, aceptados.length).estado} />
            </p>
            <p className="text-xs text-muted-foreground">
              {plural(aceptados.length, "aceptado")} · {plural(rechazados.length, "rechazado")}. Antes de confirmar vas a
              ver qué notificaciones se envían.
            </p>
          </div>
        ) : null}
        {rechazados.length ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-violet-200/70 pt-2.5 text-xs text-muted-foreground">
            <FileTextIcon className="size-3.5" aria-hidden />
            La notificación de rechazo se emite al cerrar el dictamen.
            <Link
              href={rutaNotificacion(exp.id)}
              target="_blank"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver borrador
            </Link>
          </div>
        ) : null}
      </section>
    </>
  );
}

/** Calcula la fecha con prórroga (días hábiles con feriados) y muestra la confirmación. */
async function ProrrogaLegal({ expedienteId, vence }: { expedienteId: number; vence: FechaISO }) {
  const feriados = await cargarFeriados(await getDb());
  return (
    <DialogoProrroga
      expedienteId={expedienteId}
      venceActual={vence}
      venceConProrroga={sumarDiasHabiles(vence, PLAZOS.prorrogaDiasHabiles, feriados)}
    />
  );
}

function Avance({ decididos, total }: { decididos: number; total: number }) {
  const porcentaje = total ? Math.round((decididos / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span>
        <span className="font-medium text-foreground tabular-nums">
          {decididos} de {total}
        </span>{" "}
        decididos
      </span>
      <span
        className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Diagnósticos decididos"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={decididos}
      >
        <span className="block h-full rounded-full bg-violet-500" style={{ width: `${porcentaje}%` }} />
      </span>
    </div>
  );
}

function TarjetaDiagnostico({
  d,
  exp,
  motivos,
  cymatEnExpediente,
  puedeDecidir,
}: {
  d: DiagnosticoDetalle;
  exp: Expediente;
  motivos: MotivoRechazo[];
  cymatEnExpediente: boolean;
  puedeDecidir: boolean;
}) {
  const vigente = cie10Vigente(d);
  const evaluado = d.estado !== "invocado";
  const adecuado = d.cie10_adecuado && d.cie10_adecuado !== d.cie10;
  const paraDecidir: DiagnosticoParaDecidir = {
    id: d.id,
    orden: d.orden,
    codigo: vigente.codigo,
    descripcion: vigente.descripcion,
    estado: d.estado,
    motivo_rechazo: d.motivo_rechazo,
    fundamento: d.fundamento,
    estudios: d.estudios,
    cymat_adjunto: d.cymat_adjunto,
    en_listado: d.en_listado,
    patologia_constatada: d.patologia_constatada,
  };

  return (
    <li className="overflow-hidden rounded-lg border bg-background">
      <div className="flex flex-col gap-2.5 p-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            Diagnóstico {d.orden}
            <EstadoDiagnosticoBadge estado={d.estado} />
          </div>
          <div className="mt-1 text-sm leading-snug font-medium">
            <span className="font-mono">{vigente.codigo}</span> · {vigente.descripcion}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <StethoscopeIcon className="size-3.5" aria-hidden />
            Evaluación médica
          </div>
          {evaluado ? (
            <>
              <p className="text-muted-foreground">
                {adecuado ? (
                  <>
                    CIE-10 adecuado por el área médica. Invocado:{" "}
                    <span className="font-mono text-foreground">{d.cie10}</span> · {d.cie10_descripcion}
                  </>
                ) : (
                  "CIE-10 adecuado: coincide con el invocado."
                )}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <Constatacion
                  valor={d.patologia_constatada}
                  si="Patología constatada"
                  no="Patología no constatada"
                  sinDato="Patología: sin dato"
                />
                {exp.tipo === "EP" ? (
                  <Constatacion
                    valor={d.en_listado}
                    si="En el Listado de EP"
                    no="Fuera del Listado de EP"
                    sinDato="Listado: sin dato"
                  />
                ) : null}
              </div>
              {exp.tipo === "EP" && d.agente_causante ? (
                <p>
                  <span className="text-muted-foreground">Agente de riesgo: </span>
                  <span className="font-mono">{d.agente_causante}</span>
                  {d.agente_descripcion ? ` · ${d.agente_descripcion}` : ""}
                </p>
              ) : null}
              {d.observacion_medica ? (
                <p className="whitespace-pre-line">
                  <span className="text-muted-foreground">Observación: </span>
                  {d.observacion_medica}
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-muted-foreground">Pendiente de evaluación del área médica.</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-2 border-t bg-muted/30 px-3 py-2.5">
        <div className="min-w-0 flex-1 basis-48">
          <DecisionActual d={d} />
        </div>
        {puedeDecidir && evaluado ? (
          <DialogoDecision
            expedienteId={exp.id}
            diagnostico={paraDecidir}
            motivos={motivos}
            tipo={exp.tipo}
            cymatEnExpediente={cymatEnExpediente}
          />
        ) : null}
      </div>
    </li>
  );
}

/** Dato de la evaluación médica como etiqueta: verde si se cumple, ámbar si no. */
function Constatacion({ valor, si, no, sinDato }: { valor: boolean | null; si: string; no: string; sinDato: string }) {
  if (valor === null) return <Etiqueta className="bg-zinc-50 text-zinc-600 ring-zinc-500/20">{sinDato}</Etiqueta>;
  return valor ? (
    <Etiqueta className="bg-green-50 text-green-800 ring-green-600/20">
      <CircleCheckIcon className="size-3" aria-hidden />
      {si}
    </Etiqueta>
  ) : (
    <Etiqueta className="bg-amber-50 text-amber-800 ring-amber-600/25">
      <CircleXIcon className="size-3" aria-hidden />
      {no}
    </Etiqueta>
  );
}

/** Decisión actual del Área legal sobre el diagnóstico. */
function DecisionActual({ d }: { d: DiagnosticoDetalle }) {
  if (d.estado === "aceptado") {
    return (
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
        <CircleCheckIcon className="size-4 shrink-0 text-green-700" aria-hidden />
        <span className="font-medium text-green-800">Aceptado</span>
        {d.decidido_en ? (
          <span className="text-xs text-muted-foreground">· {formatoFechaHora(d.decidido_en)}</span>
        ) : null}
      </div>
    );
  }
  if (d.estado === "rechazado" && d.motivo_rechazo) {
    const info = MOTIVO_RECHAZO_INFO[d.motivo_rechazo];
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm">
          <CircleXIcon className="size-4 shrink-0 text-red-700" aria-hidden />
          <span className="font-medium text-red-800">Rechazado</span>
          <Etiqueta className={CLASE_MOTIVO} title={info.detalle}>
            {d.motivo_rechazo}
          </Etiqueta>
          <span className="text-xs">{info.nombre}</span>
        </div>
        <dl className="space-y-1 text-xs">
          <div>
            <dt className="inline text-muted-foreground">Fundamento: </dt>
            <dd className="inline whitespace-pre-line">{d.fundamento}</dd>
          </div>
          {d.motivo_rechazo === "P" ? (
            <div>
              <dt className="inline text-muted-foreground">Estudios en que se basa: </dt>
              <dd className="inline whitespace-pre-line">{d.estudios}</dd>
            </div>
          ) : null}
          {d.motivo_rechazo === "E" ? (
            <div>
              <dt className="inline text-muted-foreground">Relevamiento CYMAT: </dt>
              <dd className="inline">{d.cymat_adjunto ? "adjunto al expediente" : "sin adjuntar"}</dd>
            </div>
          ) : null}
        </dl>
        {d.decidido_en ? (
          <div className="text-xs text-muted-foreground">Decidido el {formatoFechaHora(d.decidido_en)}</div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <CircleDashedIcon className="size-4" aria-hidden />
      Sin decidir
    </div>
  );
}

/** Estado al que pasa el expediente al cerrar el dictamen (misma regla que cerrarDictamen). */
function resultadoCierre(exp: Expediente, aceptados: number): { estado: EstadoExpediente; texto: string } {
  if (!aceptados) {
    return {
      estado: "rechazado",
      texto: "Todos los diagnósticos quedan rechazados: el expediente se cierra como rechazado.",
    };
  }
  if (exp.con_baja) {
    return {
      estado: "licencia_activa",
      texto: `Contingencia aceptada con baja laboral: pasa a Seguimiento de licencias, con la primera presentación a los ${PLAZOS.primeraPresentacionDias} días.`,
    };
  }
  return {
    estado: "sin_baja",
    texto: `Contingencia aceptada sin baja laboral: empiezan a correr ${PLAZOS.sinBajaDiasHabiles} días hábiles para presentar el trámite ante la Comisión Médica.`,
  };
}

/** Qué pasa al cerrar el dictamen con las decisiones tomadas: estado nuevo y notificaciones. */
function ConsecuenciasCierre({ exp, aceptados, rechazados }: { exp: Expediente; aceptados: number; rechazados: number }) {
  const resultado = resultadoCierre(exp, aceptados);

  const avisos: Array<{ icono: LucideIcon; texto: string }> = [];
  if (rechazados) {
    avisos.push({
      icono: MailIcon,
      texto: `Notificación de rechazo (${plural(rechazados, "diagnóstico")}) al trabajador por e-Servicios SRT y email.`,
    });
  }
  if (aceptados) {
    avisos.push({
      icono: MailIcon,
      texto: "Aceptación al trabajador por e-Servicios SRT y al empleador por Ventanilla Electrónica.",
    });
  }
  if (exp.tipo === "EP" && exp.fodep_codigo) {
    avisos.push({ icono: SendIcon, texto: "Resolución informada a la SRT: el formulario FODEP pasa a “Finalizada”." });
  }

  return (
    <div className="space-y-2.5 text-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <CircleCheckIcon className="size-3.5 text-green-700" aria-hidden />
          {plural(aceptados, "aceptado")}
        </span>
        <span className="flex items-center gap-1.5">
          <CircleXIcon className="size-3.5 text-red-700" aria-hidden />
          {plural(rechazados, "rechazado")}
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          El expediente pasa a <EstadoBadge estado={resultado.estado} />
        </span>
      </div>
      <p>{resultado.texto}</p>
      <div>
        <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Notificaciones <Simulado />
        </div>
        <ul className="space-y-1">
          {avisos.map(({ icono: Icono, texto }) => (
            <li key={texto} className="flex items-start gap-2 text-xs">
              <Icono className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span>{texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Aceptado sin baja: Comisión Médica
// ---------------------------------------------------------------------------
function ComisionMedica({ exp, plazo }: { exp: Expediente; plazo: PlazoExpediente | undefined }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 @xl/legal:flex-row @xl/legal:items-center @xl/legal:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <LandmarkIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Presentación ante la Comisión Médica</span>
            {plazo ? <PlazoBadge plazo={plazo} /> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {UERT.comisionMedica.nombre} · {UERT.comisionMedica.direccion}
          </p>
          <p className="text-xs text-muted-foreground">
            {PLAZOS.sinBajaDiasHabiles} días hábiles desde el dictamen
            {exp.cm_vence ? `: vence el ${formatoFecha(exp.cm_vence)}` : ""}. También lo puede registrar Seguimiento de
            licencias.
          </p>
        </div>
      </div>
      <div className="shrink-0">
        <DialogoPresentacionCM expedienteId={exp.id} hoy={hoy()} vence={exp.cm_vence} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Notificación de rechazo (dictamen cerrado)
// ---------------------------------------------------------------------------
function NotificacionRechazo({ expedienteId, rechazados }: { expedienteId: number; rechazados: DiagnosticoDetalle[] }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3 @xl/legal:flex-row @xl/legal:items-start @xl/legal:justify-between">
      <div className="flex min-w-0 items-start gap-2.5">
        <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-medium">Notificación de rechazo</div>
          <ul className="mt-1.5 space-y-1">
            {rechazados.map((d) => {
              const vigente = cie10Vigente(d);
              return (
                <li key={d.id} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  {d.motivo_rechazo ? (
                    <Etiqueta className={cn(CLASE_MOTIVO, "shrink-0")} title={MOTIVO_RECHAZO_INFO[d.motivo_rechazo].nombre}>
                      {d.motivo_rechazo}
                    </Etiqueta>
                  ) : null}
                  <span>
                    Diagnóstico {d.orden}: <span className="font-mono">{vigente.codigo}</span> · {vigente.descripcion}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0 self-start">
        <Link href={rutaNotificacion(expedienteId)} target="_blank">
          <PrinterIcon />
          Ver e imprimir
        </Link>
      </Button>
    </div>
  );
}
