import Link from "next/link";
import {
  CalendarX2Icon,
  FileIcon,
  HistoryIcon,
  HourglassIcon,
  LandmarkIcon,
  RotateCcwIcon,
} from "lucide-react";
import { EstadoBadge, Etiqueta, PlazoBadge, TipoBadge } from "@/components/comun/badges";
import { Dato } from "@/components/comun/pagina";
import type { PanelProps } from "@/components/comun/panel";
import { PanelArea } from "@/components/comun/panel-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ExpedienteFicha, ExpedienteVinculado, PlazoExpediente } from "@/lib/datos/expedientes";
import { MOTIVO_CESE_ILT_INFO, PLAZOS, UERT, type EstadoExpediente } from "@/lib/dominio/constantes";
import { nombreDocumento } from "@/lib/dominio/documentos";
import { formatoFecha, formatoFechaHora, hoy as hoyArgentina, sumarDias, type FechaISO } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { formatoTamano, plural } from "@/lib/formato";
import { cn } from "@/lib/utils";
import { DialogoAlta } from "./dialogo-alta";
import { DialogoComisionMedica } from "./dialogo-comision-medica";
import { DialogoIntercurrencia } from "./dialogo-intercurrencia";
import { DialogoPresentacion } from "./dialogo-presentacion";
import { CLASE_BARRA_NIVEL, resumenIlt, textoRestante } from "./ilt";

/** Presentaciones que se muestran en el historial breve. */
const HISTORIAL_MAXIMO = 5;

type PropsInternas = PanelProps & { hoy: FechaISO };

/**
 * Acciones de Seguimiento de licencias en la ficha del expediente
 * (submódulo 3): presentaciones, intercurrencias, alta y presentación ante la
 * Comisión Médica. Devuelve null si no hay nada que hacer en este estado.
 */
export function PanelSeguimiento(props: PanelProps) {
  if (props.usuario.rol !== "seguimiento") return null;
  const e = props.ficha.expediente;
  const hoy = hoyArgentina();
  switch (e.estado) {
    case "licencia_activa":
      return <LicenciaActiva {...props} hoy={hoy} />;
    case "sin_baja":
      return <SinBaja {...props} hoy={hoy} />;
    case "alta":
      return <Alta {...props} hoy={hoy} />;
    case "cerrado":
      return e.cm_presentado_en ? <Cerrado {...props} hoy={hoy} /> : null;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Licencia activa
// ---------------------------------------------------------------------------
function LicenciaActiva({ ficha, usuario, plazos, hoy }: PropsInternas) {
  const e = ficha.expediente;
  const ilt = resumenIlt(e, hoy);
  const presentacion = buscarPlazo(plazos, "presentacion");
  const tope = buscarPlazo(plazos, "tope_ilt");
  const trabajador = nombreTrabajador(ficha);
  const desde = e.tipo === "EP" ? "la primera manifestación" : "el siniestro";
  const intercurrencias = ficha.vinculados.filter((v) => v.es_intercurrencia);

  return (
    <Marco
      estado={e.estado}
      descripcion="Controlá las presentaciones hasta el alta: en cada una se fija la próxima."
    >
      <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-4">
        <Dato etiqueta="Inicio de la licencia">{formatoFecha(ilt.inicio)}</Dato>
        <Dato etiqueta="Días de licencia">{ilt.dias !== null ? plural(ilt.dias, "día") : "—"}</Dato>
        <Dato etiqueta={e.tipo === "EP" ? "Primera manifestación" : "Fecha del siniestro"}>
          {formatoFecha(e.fecha_ocurrencia)}
        </Dato>
        <Dato etiqueta="Próxima presentación">
          {e.proxima_presentacion ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {formatoFecha(e.proxima_presentacion)}
              {presentacion ? <PlazoBadge plazo={presentacion} /> : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Sin fecha programada</span>
          )}
        </Dato>
      </dl>

      {ilt.tope && ilt.transcurridos !== null ? (
        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">Tope de la ILT: {formatoFecha(ilt.tope)}</p>
              <p className="text-xs text-muted-foreground">
                {PLAZOS.topeIltDias} días corridos desde {desde} (Ley 24.557, art. 7).
              </p>
            </div>
            {tope ? <PlazoBadge plazo={tope} /> : null}
          </div>
          <Progress
            value={ilt.porcentaje}
            aria-label={`Pasaron ${ilt.transcurridos} de los ${PLAZOS.topeIltDias} días de la ILT`}
            className={cn("mt-3 h-2", CLASE_BARRA_NIVEL[tope?.nivel ?? "en_termino"])}
          />
          <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted-foreground tabular-nums">
            <span>
              {ilt.transcurridos} de {PLAZOS.topeIltDias} días
            </span>
            <span>{textoRestante(ilt.restantes)}</span>
          </div>
        </div>
      ) : null}

      {presentacion?.nivel === "vencido" ? (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <CalendarX2Icon />
          <AlertTitle>La presentación está vencida</AlertTitle>
          <AlertDescription className="text-red-800">
            Debía presentarse el {formatoFecha(presentacion.vence)}. Registrala cuando llegue la documentación o contactá
            al trabajador.
          </AlertDescription>
        </Alert>
      ) : null}
      {!e.proxima_presentacion ? (
        <Alert>
          <CalendarX2Icon />
          <AlertTitle>No hay próxima presentación programada</AlertTitle>
          <AlertDescription>
            Registrá una presentación con la próxima fecha o, si terminó el tratamiento, dale el alta.
          </AlertDescription>
        </Alert>
      ) : null}
      {tope && tope.nivel !== "en_termino" ? (
        <Alert
          className={
            tope.nivel === "proximo" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900"
          }
        >
          <HourglassIcon />
          <AlertTitle>
            {tope.nivel === "vencido" ? "Se cumplió el tope de la ILT" : "El tope de la ILT está cerca"}
          </AlertTitle>
          <AlertDescription className={tope.nivel === "proximo" ? "text-amber-800" : "text-red-800"}>
            {tope.nivel === "vencido"
              ? `El ${formatoFecha(tope.vence)} se cumplieron ${PLAZOS.topeIltDias} días desde ${desde}: registrá el alta con el motivo «Transcurso de un año» (T).`
              : `El ${formatoFecha(tope.vence)} se cumplen ${PLAZOS.topeIltDias} días desde ${desde}. Si para entonces no hay alta médica, la ILT cesa por «Transcurso de un año» (T).`}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {puede(usuario.rol, "registrar_presentacion", e.estado) ? (
          <DialogoPresentacion expedienteId={e.id} numero={e.numero} trabajador={trabajador} hoy={hoy} />
        ) : null}
        {puede(usuario.rol, "registrar_intercurrencia", e.estado) ? (
          <DialogoIntercurrencia expedienteId={e.id} numero={e.numero} hoy={hoy} inicioLicencia={ilt.inicio} />
        ) : null}
        {puede(usuario.rol, "dar_alta", e.estado) ? (
          <DialogoAlta
            expedienteId={e.id}
            numero={e.numero}
            trabajador={trabajador}
            hoy={hoy}
            inicioLicencia={ilt.inicio}
            tope={e.fecha_ocurrencia ? sumarDias(e.fecha_ocurrencia, PLAZOS.topeIltDias) : null}
            plazoTope={tope}
          />
        ) : null}
      </div>

      {intercurrencias.length ? <Vinculados titulo="Intercurrencias de esta licencia" items={intercurrencias} /> : null}

      <Historial ficha={ficha} />
    </Marco>
  );
}

// ---------------------------------------------------------------------------
// Aceptado sin baja: Comisión Médica
// ---------------------------------------------------------------------------
function SinBaja({ ficha, usuario, plazos, hoy }: PropsInternas) {
  const e = ficha.expediente;
  const plazo = buscarPlazo(plazos, "comision_medica");
  return (
    <Marco
      estado={e.estado}
      descripcion={`Aceptada sin baja laboral: hay ${PLAZOS.sinBajaDiasHabiles} días hábiles para presentar el trámite ante la Comisión Médica (Res. EP, art. 9).`}
    >
      <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2">
        <Dato etiqueta="Vencimiento del plazo">
          {e.cm_vence ? (
            <span className="flex flex-wrap items-center gap-1.5">
              {formatoFecha(e.cm_vence)}
              {plazo ? <PlazoBadge plazo={plazo} /> : null}
            </span>
          ) : (
            "—"
          )}
        </Dato>
        <Dato etiqueta="Comisión Médica">
          <span className="flex items-start gap-2">
            <LandmarkIcon className="mt-0.5 size-4 shrink-0 text-teal-700" />
            <span>
              {UERT.comisionMedica.nombre}
              <span className="block text-xs text-muted-foreground">{UERT.comisionMedica.direccion}</span>
            </span>
          </span>
        </Dato>
      </dl>

      {plazo && plazo.nivel !== "en_termino" ? (
        <Alert
          className={
            plazo.nivel === "proximo" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-900"
          }
        >
          <HourglassIcon />
          <AlertTitle>
            {plazo.nivel === "vencido" ? "El plazo para la Comisión Médica venció" : "El plazo para la Comisión Médica vence pronto"}
          </AlertTitle>
          <AlertDescription className={plazo.nivel === "proximo" ? "text-amber-800" : "text-red-800"}>
            {plazo.nivel === "vencido"
              ? `Venció el ${formatoFecha(plazo.vence)}. Registrá la presentación para cerrar el trámite.`
              : `Vence el ${formatoFecha(plazo.vence)} (${plazo.texto.toLowerCase()}).`}
          </AlertDescription>
        </Alert>
      ) : null}

      {puede(usuario.rol, "registrar_presentacion_cm", e.estado) ? (
        <div>
          <DialogoComisionMedica
            expedienteId={e.id}
            numero={e.numero}
            trabajador={nombreTrabajador(ficha)}
            hoy={hoy}
            vence={e.cm_vence}
            plazo={plazo}
          />
        </div>
      ) : null}
    </Marco>
  );
}

// ---------------------------------------------------------------------------
// Alta médica
// ---------------------------------------------------------------------------
function Alta({ ficha, hoy }: PropsInternas) {
  const e = ficha.expediente;
  const ilt = resumenIlt(e, e.fecha_fin_ilt ?? hoy);
  const reingresos = ficha.vinculados.filter((v) => v.es_reingreso);
  return (
    <Marco estado={e.estado} descripcion="La licencia terminó. La fecha de alta es la de cese de la ILT.">
      <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2 @3xl:grid-cols-3">
        <Dato etiqueta="Fecha de alta (fin de la ILT)">{formatoFecha(e.fecha_fin_ilt)}</Dato>
        <Dato etiqueta="Motivo del cese">
          {e.motivo_cese_ilt ? (
            <>
              {MOTIVO_CESE_ILT_INFO[e.motivo_cese_ilt]}{" "}
              <span className="font-mono text-xs text-muted-foreground">({e.motivo_cese_ilt})</span>
            </>
          ) : (
            "—"
          )}
        </Dato>
        <Dato etiqueta="Duración de la licencia">
          {ilt.dias !== null ? (
            <>
              {plural(ilt.dias, "día")}
              <span className="block text-xs text-muted-foreground">
                Del {formatoFecha(ilt.inicio)} al {formatoFecha(e.fecha_fin_ilt)}
              </span>
            </>
          ) : (
            "—"
          )}
        </Dato>
      </dl>

      <Alert>
        <RotateCcwIcon />
        <AlertTitle>¿Surgió una complicación del mismo siniestro?</AlertTitle>
        <AlertDescription>
          Mesa de entrada puede cargar un reingreso: conserva el número de siniestro con el sufijo siguiente y
          vuelve a recorrer el circuito desde la recepción.
        </AlertDescription>
      </Alert>

      {reingresos.length ? <Vinculados titulo="Reingresos de este siniestro" items={reingresos} /> : null}

      <Historial ficha={ficha} />
    </Marco>
  );
}

// ---------------------------------------------------------------------------
// Cerrado: presentado ante la Comisión Médica
// ---------------------------------------------------------------------------
function Cerrado({ ficha }: PropsInternas) {
  const e = ficha.expediente;
  const enTermino = e.cm_vence && e.cm_presentado_en ? e.cm_presentado_en <= e.cm_vence : null;
  return (
    <Marco estado={e.estado} descripcion="Contingencia aceptada sin baja: el trámite se presentó ante la Comisión Médica.">
      <dl className="grid gap-x-6 gap-y-4 @md:grid-cols-2">
        <Dato etiqueta="Presentado ante la Comisión Médica">
          <span className="flex flex-wrap items-center gap-1.5">
            {formatoFecha(e.cm_presentado_en)}
            {enTermino === true ? (
              <Etiqueta className="bg-green-50 text-green-800 ring-green-600/20">En término</Etiqueta>
            ) : enTermino === false ? (
              <Etiqueta className="bg-red-50 text-red-800 ring-red-600/20">Fuera de término</Etiqueta>
            ) : null}
          </span>
        </Dato>
        <Dato etiqueta="Comisión Médica">
          {UERT.comisionMedica.nombre}
          {e.cm_vence ? (
            <span className="block text-xs text-muted-foreground">El plazo vencía el {formatoFecha(e.cm_vence)}.</span>
          ) : null}
        </Dato>
      </dl>
    </Marco>
  );
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------
function Marco({
  estado,
  descripcion,
  children,
}: {
  estado: EstadoExpediente;
  descripcion: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PanelArea rol="seguimiento" className="@container" descripcion={descripcion} accion={<EstadoBadge estado={estado} />}>
      <CardContent className="flex flex-col gap-5">{children}</CardContent>
    </PanelArea>
  );
}

function Vinculados({ titulo, items }: { titulo: string; items: ExpedienteVinculado[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{titulo}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm">
            <Link href={`/expedientes/${v.id}`} className="font-mono font-medium text-primary hover:underline">
              {v.numero}
            </Link>
            <TipoBadge tipo={v.tipo} />
            <EstadoBadge estado={v.estado} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Historial breve de presentaciones, con los documentos que se cargaron con cada una. */
function Historial({ ficha }: { ficha: ExpedienteFicha }) {
  const presentaciones = ficha.presentaciones;
  const visibles = presentaciones.slice(0, HISTORIAL_MAXIMO);
  // Los documentos de una presentación se graban en la misma transacción: comparten el momento.
  const documentos = ficha.documentos.filter((d) => d.etapa === "seguimiento");
  const documentosDe = (registradaEn: Date) =>
    documentos.filter((d) => new Date(d.cargado_en).getTime() === new Date(registradaEn).getTime());

  return (
    <section className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-medium">
        <HistoryIcon className="size-4 text-muted-foreground" />
        Presentaciones
        {presentaciones.length ? (
          <span className="font-normal text-muted-foreground">({presentaciones.length})</span>
        ) : null}
      </h3>
      {visibles.length ? (
        <ol className="flex flex-col divide-y rounded-lg border bg-background">
          {visibles.map((p) => {
            const docs = documentosDe(p.registrada_en);
            return (
              <li key={p.id} className="flex flex-col gap-1.5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium tabular-nums">{formatoFecha(p.fecha)}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.proxima_fecha ? `Próxima: ${formatoFecha(p.proxima_fecha)}` : "Sin próxima presentación"}
                  </span>
                </div>
                <p className="text-sm text-foreground/90">{p.detalle}</p>
                {docs.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Documentos presentados">
                    {docs.map((d) => (
                      <li
                        key={d.id}
                        title={d.nombre_archivo ?? undefined}
                        className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs"
                      >
                        <FileIcon className="size-3 shrink-0 text-muted-foreground" />
                        <span className="truncate">{nombreDocumento(d.tipo)}</span>
                        {d.tamano_bytes !== null ? (
                          <span className="shrink-0 text-muted-foreground">· {formatoTamano(d.tamano_bytes)}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  Registró {p.registrada_por_nombre ?? "—"} · {formatoFechaHora(p.registrada_en)}
                </span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-lg border border-dashed bg-background px-3 py-4 text-center text-sm text-muted-foreground">
          Todavía no hay presentaciones registradas.
        </p>
      )}
      {presentaciones.length > visibles.length ? (
        <p className="text-xs text-muted-foreground">
          Se muestran las últimas {visibles.length}. Las anteriores figuran en el historial del expediente.
        </p>
      ) : null}
    </section>
  );
}

function buscarPlazo(plazos: PlazoExpediente[], clave: PlazoExpediente["clave"]): PlazoExpediente | null {
  return plazos.find((p) => p.clave === clave) ?? null;
}

function nombreTrabajador(ficha: ExpedienteFicha): string {
  return `${ficha.persona.apellido}, ${ficha.persona.nombres}`;
}
