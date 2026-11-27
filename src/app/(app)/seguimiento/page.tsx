import type { Metadata } from "next";
import { ActivityIcon, CalendarClockIcon, CircleCheckIcon, HourglassIcon, InfoIcon, LandmarkIcon } from "lucide-react";
import { Etiqueta, PlazoBadge } from "@/components/comun/badges";
import { EncabezadoPagina, Seccion } from "@/components/comun/pagina";
import { TablaExpedientes, type ColumnaExtra } from "@/components/comun/tabla-expedientes";
import { GrillaIndicadores, TarjetaIndicador } from "@/components/comun/tarjeta-indicador";
import { BarraIlt } from "@/components/seguimiento/barra-ilt";
import { DialogoPresentacion } from "@/components/seguimiento/dialogo-presentacion";
import { resumenIlt } from "@/components/seguimiento/ilt";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDb } from "@/lib/db";
import { listarExpedientes, plazosDe, type ExpedienteFila, type PlazoExpediente } from "@/lib/datos/expedientes";
import { MOTIVO_CESE_ILT_INFO, PLAZOS, ROL_INFO } from "@/lib/dominio/constantes";
import { formatoFecha, hoy as hoyArgentina, sumarDias, type FechaISO, type NivelPlazo } from "@/lib/dominio/fechas";
import { puede } from "@/lib/dominio/permisos";
import { plural } from "@/lib/formato";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import { requerirUsuario } from "@/lib/sesion";
import { datosDeLicencias } from "./lecturas";

export const metadata: Metadata = { title: "Seguimiento de licencias" };

const ORDEN_NIVEL: Record<NivelPlazo, number> = { vencido: 0, hoy: 1, proximo: 2, en_termino: 3 };
/** Altas que se muestran en la bandeja: las de los últimos N días. */
const DIAS_ALTAS = 30;

/** Bandeja del submódulo 3: licencias activas, sus presentaciones y vencimientos. */
export default async function BandejaSeguimiento() {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const ahora = new Date();
  const hoy = hoyArgentina(ahora);

  const [feriados, licencias, sinBaja, altas] = await Promise.all([
    cargarFeriados(db),
    listarExpedientes(db, { estados: ["licencia_activa"], orden: "proxima_presentacion", limite: 500 }),
    listarExpedientes(db, { estados: ["sin_baja"], orden: "cm_vence", limite: 500 }),
    listarExpedientes(db, { estados: ["alta"], limite: 500 }),
  ]);
  const desdeAltas = sumarDias(hoy, -DIAS_ALTAS);
  const altasRecientes = altas
    .filter((f) => f.fecha_fin_ilt !== null && f.fecha_fin_ilt >= desdeAltas)
    .sort((a, b) => (b.fecha_fin_ilt ?? "").localeCompare(a.fecha_fin_ilt ?? ""));
  const licencia = await datosDeLicencias(db, [...licencias, ...altasRecientes].map((f) => f.id));

  // Plazos de cada expediente: presentación y tope de la ILT, o Comisión Médica
  const plazos = new Map<number, PlazoExpediente[]>();
  for (const f of [...licencias, ...sinBaja]) plazos.set(f.id, plazosDe(f, ahora, feriados));
  const plazo = (f: ExpedienteFila, clave: PlazoExpediente["clave"]) =>
    plazos.get(f.id)?.find((p) => p.clave === clave) ?? null;
  const ilt = (f: ExpedienteFila, hasta: FechaISO) =>
    resumenIlt(
      { fecha_inicio_inasistencia: licencia.get(f.id)?.fecha_inicio_inasistencia ?? null, fecha_ocurrencia: f.fecha_ocurrencia },
      hasta,
    );

  // (a) Presentaciones vencidas, que vencen hoy o dentro del aviso (RF-15), o sin fecha
  const aControlar = licencias
    .filter((f) => plazo(f, "presentacion")?.nivel !== "en_termino")
    .sort((a, b) => {
      const pa = plazo(a, "presentacion");
      const pb = plazo(b, "presentacion");
      if (!pa || !pb) return pa ? -1 : pb ? 1 : 0;
      return ORDEN_NIVEL[pa.nivel] - ORDEN_NIVEL[pb.nivel] || pa.vence.localeCompare(pb.vence);
    });
  const vencidas = aControlar.filter((f) => plazo(f, "presentacion")?.nivel === "vencido").length;
  const sinFecha = aControlar.filter((f) => !plazo(f, "presentacion")).length;
  const porVencer = aControlar.length - vencidas - sinFecha;

  // (b) Tope de la ILT a 30 días o menos (RF-22)
  const topeCercano = licencias
    .filter((f) => {
      const p = plazo(f, "tope_ilt");
      return p !== null && p.nivel !== "en_termino";
    })
    .sort((a, b) => (plazo(a, "tope_ilt")?.vence ?? "").localeCompare(plazo(b, "tope_ilt")?.vence ?? ""));

  const proximoCM = sinBaja
    .map((f) => plazo(f, "comision_medica"))
    .filter((p): p is PlazoExpediente => p !== null)
    .sort((a, b) => a.vence.localeCompare(b.vence))[0];
  const puedeRegistrar = puede(usuario.rol, "registrar_presentacion", "licencia_activa");

  // -------------------------------------------------------------------------
  // Columnas
  // -------------------------------------------------------------------------
  const columnaProxima: ColumnaExtra = {
    titulo: "Próxima presentación",
    celda: (f) => {
      const p = plazo(f, "presentacion");
      return p ? (
        <div className="flex flex-col items-start gap-1">
          <span className="tabular-nums">{formatoFecha(p.vence)}</span>
          <PlazoBadge plazo={p} />
        </div>
      ) : (
        <Etiqueta className="bg-zinc-50 text-zinc-700 ring-zinc-500/20">Sin fecha programada</Etiqueta>
      );
    },
  };
  const columnaUltima: ColumnaExtra = {
    titulo: "Última presentación",
    className: "hidden max-w-72 whitespace-normal xl:table-cell",
    celda: (f) => {
      const d = licencia.get(f.id);
      return d?.ultima_presentacion ? (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm tabular-nums">{formatoFecha(d.ultima_presentacion)}</span>
          <span className="line-clamp-2 text-xs text-muted-foreground">{d.ultima_presentacion_detalle}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Todavía no hay presentaciones</span>
      );
    },
  };
  const columnaDiasIlt: ColumnaExtra = {
    titulo: "Días de ILT",
    celda: (f) => <BarraIlt ilt={ilt(f, hoy)} nivel={plazo(f, "tope_ilt")?.nivel} />,
  };
  const columnaTope: ColumnaExtra = {
    titulo: "Tope de la ILT",
    celda: (f) => {
      const p = plazo(f, "tope_ilt");
      return p ? (
        <div className="flex flex-col items-start gap-1">
          <span className="tabular-nums">{formatoFecha(p.vence)}</span>
          <PlazoBadge plazo={p} />
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  };
  const columnaAccion: ColumnaExtra = {
    titulo: "Acción",
    className: "text-right",
    celda: (f) => (
      <DialogoPresentacion
        compacto
        expedienteId={f.id}
        numero={f.numero}
        trabajador={`${f.apellido}, ${f.nombres}`}
        hoy={hoy}
      />
    ),
  };
  const columnaVenceCM: ColumnaExtra = {
    titulo: "Vencimiento",
    celda: (f) => <span className="tabular-nums">{formatoFecha(f.cm_vence)}</span>,
  };
  const columnaFechaAlta: ColumnaExtra = {
    titulo: "Fecha de alta",
    celda: (f) => <span className="tabular-nums">{formatoFecha(f.fecha_fin_ilt)}</span>,
  };
  const columnaMotivo: ColumnaExtra = {
    titulo: "Motivo del cese",
    className: "whitespace-normal",
    celda: (f) => {
      const m = licencia.get(f.id)?.motivo_cese_ilt;
      return m ? (
        <span>
          {MOTIVO_CESE_ILT_INFO[m]} <span className="font-mono text-xs text-muted-foreground">({m})</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  };
  const columnaDuracion: ColumnaExtra = {
    titulo: "Duración de la ILT",
    celda: (f) => {
      const r = ilt(f, f.fecha_fin_ilt ?? hoy);
      return r.dias !== null ? (
        <div className="flex flex-col">
          <span className="tabular-nums">{plural(r.dias, "día")}</span>
          <span className="text-xs text-muted-foreground">desde el {formatoFecha(r.inicio)}</span>
        </div>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  };

  // -------------------------------------------------------------------------
  // Resumen
  // -------------------------------------------------------------------------
  const detallePresentaciones = aControlar.length
    ? [
        vencidas ? plural(vencidas, "vencida") : null,
        porVencer ? `${porVencer} por vencer` : null,
        sinFecha ? `${sinFecha} sin fecha` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "Todas en término";
  const indicadores: Array<React.ComponentProps<typeof TarjetaIndicador> & { href: string }> = [
    {
      href: "#presentaciones",
      titulo: "Presentaciones a controlar",
      valor: aControlar.length,
      detalle: detallePresentaciones,
      icono: CalendarClockIcon,
      tono: vencidas ? "critico" : aControlar.length ? "alerta" : "apagado",
    },
    {
      href: "#tope",
      titulo: "Tope de la ILT cercano",
      valor: topeCercano.length,
      detalle: `A ${PLAZOS.avisoTopeIltDias} días o menos de los ${PLAZOS.topeIltDias}`,
      icono: HourglassIcon,
      tono: topeCercano.length ? "alerta" : "apagado",
    },
    {
      href: "#licencias",
      titulo: "Licencias activas",
      valor: licencias.length,
      detalle: licencias.length
        ? `${licencias.length - aControlar.length} con la presentación en término`
        : "No hay licencias activas",
      icono: ActivityIcon,
      tono: licencias.length ? "neutro" : "apagado",
    },
    {
      href: "#comision-medica",
      titulo: "Sin baja: Comisión Médica",
      valor: sinBaja.length,
      detalle: proximoCM ? `Próximo vencimiento: ${formatoFecha(proximoCM.vence)}` : "Nada pendiente",
      icono: LandmarkIcon,
      tono: sinBaja.length ? "neutro" : "apagado",
    },
    {
      href: "#altas",
      titulo: `Altas de los últimos ${DIAS_ALTAS} días`,
      valor: altasRecientes.length,
      detalle: "Fin de la ILT",
      icono: CircleCheckIcon,
      tono: altasRecientes.length ? "ok" : "apagado",
    },
  ];

  return (
    <>
      <EncabezadoPagina
        titulo="Seguimiento de licencias"
        descripcion="Controlá las presentaciones de cada licencia y sus vencimientos, el tope de 365 días de la ILT y las contingencias sin baja que van a la Comisión Médica. Las intercurrencias, las altas y el resto de las acciones se registran desde la ficha de cada expediente."
      />

      <div className="flex flex-col gap-8">
        {usuario.rol !== "seguimiento" ? (
          <Alert>
            <InfoIcon />
            <AlertTitle>Estás viendo como {ROL_INFO[usuario.rol].nombre}</AlertTitle>
            <AlertDescription>
              Las presentaciones, intercurrencias y altas las registra Seguimiento de licencias. Cambiá de rol con el
              selector “Viendo como” para hacerlo.
            </AlertDescription>
          </Alert>
        ) : null}

        <GrillaIndicadores columnas={5}>
          {indicadores.map((indicador) => (
            <TarjetaIndicador key={indicador.href} {...indicador} />
          ))}
        </GrillaIndicadores>

        <div id="presentaciones" className="scroll-mt-32">
          <Seccion
            recorrido="presentaciones"
            titulo={<Titulo texto="Presentaciones vencidas o por vencer" cantidad={aControlar.length} />}
            descripcion={`Licencias con la próxima presentación vencida o dentro de los próximos ${PLAZOS.avisoPresentacionDias} días (la anticipación del aviso está a definir con la UERT).${puedeRegistrar && aControlar.length ? " Podés registrar la presentación desde acá." : ""}`}
          >
            <TablaExpedientes
              filas={aControlar}
              ocultar={["estado", "plazo", "novedad"]}
              columnas={[columnaProxima, columnaUltima, ...(puedeRegistrar ? [columnaAccion] : [])]}
              vacio={`No hay presentaciones vencidas ni por vencer en los próximos ${PLAZOS.avisoPresentacionDias} días.`}
            />
          </Seccion>
        </div>

        <div id="tope" className="scroll-mt-32">
          <Seccion
            recorrido="tope-ilt"
            titulo={<Titulo texto="Tope de la ILT cercano" cantidad={topeCercano.length} />}
            descripcion={`La ILT no puede superar los ${PLAZOS.topeIltDias} días desde el siniestro (Ley 24.557, art. 7). Se avisa con ${PLAZOS.avisoTopeIltDias} días de anticipación; al cumplirse, el alta se registra con el motivo «Transcurso de un año».`}
          >
            <TablaExpedientes
              filas={topeCercano}
              ocultar={["estado", "plazo", "novedad"]}
              columnas={[columnaDiasIlt, columnaTope]}
              vacio={`Ninguna licencia está a ${PLAZOS.avisoTopeIltDias} días o menos del tope de ${PLAZOS.topeIltDias} días.`}
            />
          </Seccion>
        </div>

        <div id="licencias" className="scroll-mt-32">
          <Seccion
            recorrido="licencias"
            titulo={<Titulo texto="Licencias activas" cantidad={licencias.length} />}
            descripcion={`Todas, por fecha de la próxima presentación. En «Días de ILT», la cifra son los días de licencia y la barra, cuánto pasó del año de tope contado desde el siniestro (N/${PLAZOS.topeIltDias}).`}
          >
            <TablaExpedientes
              filas={licencias}
              ocultar={["estado", "plazo", "novedad"]}
              columnas={[columnaDiasIlt, columnaProxima, columnaUltima]}
              vacio="No hay licencias activas."
            />
          </Seccion>
        </div>

        <div id="comision-medica" className="scroll-mt-32">
          <Seccion
            titulo={<Titulo texto="Aceptados sin baja (Comisión Médica)" cantidad={sinBaja.length} />}
            descripcion={`Contingencias aceptadas sin baja laboral: hay ${PLAZOS.sinBajaDiasHabiles} días hábiles para presentar el trámite ante la Comisión Médica (Res. EP, art. 9). La presentación se registra desde la ficha.`}
          >
            <TablaExpedientes
              filas={sinBaja}
              ocultar={["estado"]}
              columnas={[columnaVenceCM]}
              vacio="No hay contingencias sin baja pendientes de presentar ante la Comisión Médica."
            />
          </Seccion>
        </div>

        <div id="altas" className="scroll-mt-32">
          <Seccion
            titulo={<Titulo texto={`Altas de los últimos ${DIAS_ALTAS} días`} cantidad={altasRecientes.length} />}
            descripcion="Fin de la ILT. Si surge una complicación del mismo siniestro, Mesa de entrada puede cargar un reingreso."
          >
            <TablaExpedientes
              filas={altasRecientes}
              ocultar={["estado", "plazo", "novedad"]}
              columnas={[columnaFechaAlta, columnaMotivo, columnaDuracion]}
              vacio={`No hubo altas en los últimos ${DIAS_ALTAS} días.`}
            />
          </Seccion>
        </div>
      </div>
    </>
  );
}

function Titulo({ texto, cantidad }: { texto: string; cantidad: number }) {
  return (
    <span className="flex items-center gap-2">
      {texto}
      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
        {cantidad}
      </span>
    </span>
  );
}
