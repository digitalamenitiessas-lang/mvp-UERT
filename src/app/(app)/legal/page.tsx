import type { Metadata } from "next";
import Link from "next/link";
import {
  AlarmClockIcon,
  GavelIcon,
  HourglassIcon,
  InfoIcon,
  LandmarkIcon,
  PrinterIcon,
} from "lucide-react";
import { Etiqueta } from "@/components/comun/badges";
import { EncabezadoPagina, Seccion } from "@/components/comun/pagina";
import { TablaExpedientes, type ColumnaExtra } from "@/components/comun/tabla-expedientes";
import { GrillaIndicadores, TarjetaIndicador } from "@/components/comun/tarjeta-indicador";
import { APLICA_TEXTO, CLASE_MOTIVO } from "@/components/legal/motivos";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getDb } from "@/lib/db";
import { listarExpedientes, plazosDe, type ExpedienteFila } from "@/lib/datos/expedientes";
import { MOTIVO_RECHAZO_INFO, MOTIVOS_RECHAZO, PLAZOS, ROL_INFO, UERT } from "@/lib/dominio/constantes";
import { fechaDe, formatoFecha } from "@/lib/dominio/fechas";
import { cargarFeriados } from "@/lib/operaciones/contexto";
import { requerirUsuario } from "@/lib/sesion";
import { cn } from "@/lib/utils";
import { listarRechazosRecientes, type RechazoReciente } from "./lecturas";

export const metadata: Metadata = { title: "Área legal" };

/** Ventana de la sección de rechazados. */
const DIAS_RECHAZOS = 60;

export default async function BandejaLegal() {
  const usuario = await requerirUsuario();
  const db = await getDb();
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - DIAS_RECHAZOS * 86_400_000);

  const [enDictamen, sinBaja, rechazos, feriados] = await Promise.all([
    listarExpedientes(db, { estados: ["dictamen_legal"], orden: "legal_vence" }),
    listarExpedientes(db, { estados: ["sin_baja"], orden: "cm_vence" }),
    listarRechazosRecientes(db, desde),
    cargarFeriados(db),
  ]);

  // Filas de la tabla para los rechazos, en el orden de la decisión (más recientes primero)
  const filasDeRechazo = rechazos.length
    ? await listarExpedientes(db, { estados: [...new Set(rechazos.map((r) => r.estado))], limite: 500 })
    : [];
  const filaPorId = new Map(filasDeRechazo.map((f) => [f.id, f]));
  const rechazoPorId = new Map(rechazos.map((r) => [r.expediente_id, r]));
  const rechazados = rechazos.map((r) => filaPorId.get(r.expediente_id)).filter((f): f is ExpedienteFila => !!f);

  // Resumen de plazos del dictamen
  const plazosLegales = enDictamen.map((f) => plazosDe(f, ahora, feriados).find((p) => p.clave === "legal"));
  const vencidos = plazosLegales.filter((p) => p?.nivel === "vencido").length;
  const porVencer = plazosLegales.filter((p) => p && p.dias >= 0 && p.dias <= 2).length;

  const columnasDictamen: ColumnaExtra[] = [
    {
      titulo: "Diagnósticos decididos",
      celda: (f) => <Decididos decididos={f.diagnosticos_decididos} total={f.diagnosticos_total} />,
    },
    {
      titulo: "Prórroga",
      celda: (f) =>
        f.legal_prorroga_usada ? (
          <Etiqueta className="bg-violet-50 text-violet-800 ring-violet-600/20">Usada</Etiqueta>
        ) : (
          <Etiqueta className="bg-zinc-50 text-zinc-600 ring-zinc-500/20">Disponible</Etiqueta>
        ),
    },
  ];

  const columnasSinBaja: ColumnaExtra[] = [
    {
      titulo: "Fecha límite",
      celda: (f) => <span className="text-sm tabular-nums">{formatoFecha(f.cm_vence)}</span>,
    },
  ];

  const columnasRechazo: ColumnaExtra[] = [
    {
      titulo: "Rechazo",
      celda: (f) => {
        const r = rechazoPorId.get(f.id);
        return r ? <ResumenRechazo rechazo={r} /> : null;
      },
    },
    {
      titulo: "Decidido",
      celda: (f) => {
        const r = rechazoPorId.get(f.id);
        return r ? <span className="text-sm tabular-nums">{formatoFecha(fechaDe(r.rechazado_en))}</span> : null;
      },
    },
    {
      titulo: "Notificación",
      celda: (f) => (
        <Link
          href={`/imprimir/rechazo/${f.id}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <PrinterIcon className="size-3.5" aria-hidden />
          Imprimir
        </Link>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <EncabezadoPagina
          titulo="Área legal"
          descripcion={
            <>
              Desde que recibe el expediente, el Área legal tiene {PLAZOS.legalDiasHabiles} días hábiles para aceptar o
              rechazar cada diagnóstico y cerrar el dictamen. Puede pedir una única prórroga de{" "}
              {PLAZOS.prorrogaDiasHabiles} días hábiles (plazo a confirmar con la UERT). Al cerrarlo se notifica al
              trabajador y, si se acepta, al empleador.
            </>
          }
        >
          {usuario.rol !== "legal" ? (
            <Alert className="max-w-3xl">
              <InfoIcon />
              <AlertTitle>Estás viendo la bandeja como {ROL_INFO[usuario.rol].nombre}</AlertTitle>
              <AlertDescription>
                Las decisiones las toma el Área legal: para probarlas, cambiá de rol desde “Viendo como”.
              </AlertDescription>
            </Alert>
          ) : null}
        </EncabezadoPagina>

        <GrillaIndicadores>
          <TarjetaIndicador
            titulo="En dictamen"
            valor={enDictamen.length}
            detalle="Expedientes a resolver"
            icono={GavelIcon}
            tono={enDictamen.length ? "neutro" : "apagado"}
          />
          <TarjetaIndicador
            titulo="Vencidos"
            valor={vencidos}
            detalle="Superaron el plazo para expedirse"
            icono={AlarmClockIcon}
            tono={vencidos ? "critico" : "apagado"}
          />
          <TarjetaIndicador
            titulo="Vencen en 2 días hábiles o menos"
            valor={porVencer}
            detalle="Incluye los que vencen hoy"
            icono={HourglassIcon}
            tono={porVencer ? "alerta" : "apagado"}
          />
          <TarjetaIndicador
            titulo="Para la Comisión Médica"
            valor={sinBaja.length}
            detalle="Aceptados sin baja laboral"
            icono={LandmarkIcon}
            tono={sinBaja.length ? "neutro" : "apagado"}
          />
        </GrillaIndicadores>
      </div>

      <Seccion
        titulo="En dictamen"
        descripcion="Ordenados por vencimiento. Entrá al expediente para decidir cada diagnóstico y cerrar el dictamen."
      >
        <TablaExpedientes
          filas={enDictamen}
          columnas={columnasDictamen}
          ocultar={["estado"]}
          vacio="No hay expedientes esperando el dictamen legal."
        />
      </Seccion>

      <Seccion
        titulo="Aceptados sin baja: presentar ante la Comisión Médica"
        descripcion={`Hay ${PLAZOS.sinBajaDiasHabiles} días hábiles desde el dictamen para presentar el trámite ante la ${UERT.comisionMedica.nombre}. Lo registra el Área legal o Seguimiento de licencias.`}
      >
        <TablaExpedientes
          filas={sinBaja}
          columnas={columnasSinBaja}
          ocultar={["estado"]}
          vacio="No hay contingencias aceptadas sin baja pendientes de presentar."
        />
      </Seccion>

      <Seccion
        titulo={`Rechazados en los últimos ${DIAS_RECHAZOS} días`}
        descripcion="Expedientes con diagnósticos rechazados en un dictamen cerrado (rechazo total o parcial). Desde acá se vuelve a imprimir la notificación."
      >
        <TablaExpedientes
          filas={rechazados}
          columnas={columnasRechazo}
          ocultar={["plazo", "reparticion"]}
          vacio={`No hubo rechazos en los últimos ${DIAS_RECHAZOS} días.`}
        />
      </Seccion>

      <Seccion
        titulo="Motivos de rechazo"
        descripcion="Cada diagnóstico se decide por separado. El motivo depende del tipo de denuncia."
      >
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {MOTIVOS_RECHAZO.map((m) => {
            const info = MOTIVO_RECHAZO_INFO[m];
            return (
              <li key={m} className="flex flex-col gap-1.5 rounded-lg border bg-background p-3">
                <div className="flex items-start gap-2">
                  <Etiqueta className={CLASE_MOTIVO}>{m}</Etiqueta>
                  <span className="text-sm leading-snug font-medium">{info.nombre}</span>
                </div>
                <p className="text-xs text-muted-foreground">{info.detalle}</p>
                <p className="mt-auto pt-1 text-xs font-medium text-foreground/80">{APLICA_TEXTO[info.aplica]}</p>
              </li>
            );
          })}
        </ul>
      </Seccion>
    </div>
  );
}

function Decididos({ decididos, total }: { decididos: number; total: number }) {
  const porcentaje = total ? Math.round((decididos / total) * 100) : 0;
  const completo = total > 0 && decididos === total;
  return (
    <div className="flex items-center gap-2">
      <span className={cn("text-sm font-medium tabular-nums", completo && "text-green-700")}>
        {decididos}/{total}
      </span>
      <span
        className="h-1.5 w-14 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Diagnósticos decididos"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={decididos}
      >
        <span
          className={cn("block h-full rounded-full", completo ? "bg-green-600" : "bg-violet-500")}
          style={{ width: `${porcentaje}%` }}
        />
      </span>
    </div>
  );
}

function ResumenRechazo({ rechazo }: { rechazo: RechazoReciente }) {
  const parcial = rechazo.rechazados < rechazo.total;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {rechazo.motivos.map((m) => (
          <Etiqueta key={m} className={CLASE_MOTIVO} title={MOTIVO_RECHAZO_INFO[m].nombre}>
            {m}
          </Etiqueta>
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        {parcial ? `Parcial: ${rechazo.rechazados} de ${rechazo.total} diagnósticos` : "Total"}
      </span>
    </div>
  );
}
