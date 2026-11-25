import { ActivityIcon, LandmarkIcon, ListChecksIcon } from "lucide-react";
import { PlazoBadge } from "@/components/comun/badges";
import { Dato, Datos } from "@/components/comun/pagina";
import { resumenIlt } from "@/components/seguimiento/ilt";
import type { ExpedienteFicha, PlazoExpediente } from "@/lib/datos/expedientes";
import { MOTIVO_CESE_ILT_INFO, PLAZOS, UERT } from "@/lib/dominio/constantes";
import { formatoFecha, formatoFechaHora, type FechaISO } from "@/lib/dominio/fechas";
import { plural } from "@/lib/formato";
import { Hito, LineaTiempo } from "./linea-tiempo";
import { Tarjeta, Vacio } from "./util";

function ComisionMedica({ ficha, plazo }: { ficha: ExpedienteFicha; plazo?: PlazoExpediente }) {
  const e = ficha.expediente;
  return (
    <Tarjeta
      titulo="Presentación ante la Comisión Médica"
      icono={LandmarkIcon}
      descripcion={`Contingencia aceptada sin baja laboral: hay ${PLAZOS.sinBajaDiasHabiles} días hábiles para presentar el trámite (Res. SRT de EP, art. 9).`}
    >
      <Datos>
        <Dato etiqueta="Comisión Médica">
          {UERT.comisionMedica.nombre}
          <span className="block text-xs text-muted-foreground">{UERT.comisionMedica.direccion}</span>
        </Dato>
        <Dato etiqueta="Vence">
          {e.cm_vence ? (
            <span className="flex flex-wrap items-center gap-2">
              {formatoFecha(e.cm_vence)}
              {plazo ? <PlazoBadge plazo={plazo} /> : null}
            </span>
          ) : null}
        </Dato>
        <Dato etiqueta="Presentado">
          {e.cm_presentado_en ? formatoFecha(e.cm_presentado_en) : <span className="text-muted-foreground">Pendiente</span>}
        </Dato>
      </Datos>
    </Tarjeta>
  );
}

/** Solapa "Licencia": la ILT, sus presentaciones, el tope de 365 días y el alta. */
export function LicenciaFicha({
  ficha,
  plazos,
  hoyISO,
}: {
  ficha: ExpedienteFicha;
  plazos: PlazoExpediente[];
  hoyISO: FechaISO;
}) {
  const e = ficha.expediente;
  const presentaciones = ficha.presentaciones;
  const plazo = (clave: PlazoExpediente["clave"]) => plazos.find((p) => p.clave === clave);
  const conComisionMedica = e.estado === "sin_baja" || e.cm_vence !== null || e.cm_presentado_en !== null;
  const tuvoLicencia = e.con_baja === true || presentaciones.length > 0 || e.fecha_fin_ilt !== null;

  if (!tuvoLicencia) {
    return (
      <div className="flex flex-col gap-4">
        {conComisionMedica ? <ComisionMedica ficha={ficha} plazo={plazo("comision_medica")} /> : null}
        <Vacio
          icono={ActivityIcon}
          titulo={e.con_baja === false ? "Contingencia sin baja laboral" : "Sin licencia todavía"}
          descripcion={
            e.con_baja === false
              ? "El Área médica definió que no hay baja laboral, así que no se abre una licencia por incapacidad laboral temporaria (ILT)."
              : "La licencia (ILT) empieza cuando el Área legal acepta la contingencia con baja laboral. Desde ahí, Seguimiento controla cada presentación hasta el alta."
          }
        />
      </div>
    );
  }

  const enCurso = e.estado === "licencia_activa";
  // La misma cuenta que la bandeja, el panel de Seguimiento y el diálogo de alta
  const ilt = resumenIlt(e, e.fecha_fin_ilt ?? hoyISO);
  const plazoPresentacion = plazo("presentacion");
  const plazoTope = plazo("tope_ilt");

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta
        titulo="Licencia por incapacidad laboral temporaria (ILT)"
        icono={ActivityIcon}
        descripcion={enCurso ? "Licencia en curso: Seguimiento controla las presentaciones y los vencimientos." : undefined}
      >
        <Datos>
          <Dato etiqueta="Inicio de la licencia">{ilt.inicio ? formatoFecha(ilt.inicio) : null}</Dato>
          <Dato etiqueta="Días de licencia">
            {ilt.dias !== null ? `${plural(ilt.dias, "día", "días")}${enCurso ? " (en curso)" : ""}` : null}
          </Dato>
          <Dato etiqueta="Próxima presentación">
            {enCurso && e.proxima_presentacion ? (
              <span className="flex flex-wrap items-center gap-2">
                {formatoFecha(e.proxima_presentacion)}
                {plazoPresentacion ? <PlazoBadge plazo={plazoPresentacion} /> : null}
              </span>
            ) : (
              <span className="text-muted-foreground">No corresponde</span>
            )}
          </Dato>
          <Dato etiqueta={`Tope de la ILT (${PLAZOS.topeIltDias} días)`}>
            {ilt.tope ? (
              <span className="flex flex-wrap items-center gap-2">
                {formatoFecha(ilt.tope)}
                {enCurso && plazoTope ? <PlazoBadge plazo={plazoTope} /> : null}
              </span>
            ) : null}
            <span className="block text-xs text-muted-foreground">
              Desde {e.tipo === "EP" ? "la primera manifestación" : "el siniestro"} (Ley 24.557, art. 7)
            </span>
          </Dato>
          <Dato etiqueta="Fin de la ILT">
            {e.fecha_fin_ilt ? (
              <>
                {formatoFecha(e.fecha_fin_ilt)}
                {e.motivo_cese_ilt ? (
                  <span className="block text-xs text-muted-foreground">{MOTIVO_CESE_ILT_INFO[e.motivo_cese_ilt]}</span>
                ) : null}
              </>
            ) : (
              <span className="text-muted-foreground">Sin alta todavía</span>
            )}
          </Dato>
        </Datos>
      </Tarjeta>

      <Tarjeta
        titulo={`Presentaciones (${presentaciones.length})`}
        icono={ListChecksIcon}
        descripcion="Certificados de control y pedidos de prácticas que presenta el trabajador durante la licencia."
      >
        <LineaTiempo>
          {enCurso && e.proxima_presentacion ? (
            <Hito hueco>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                Próxima presentación: {formatoFecha(e.proxima_presentacion)}
                {plazoPresentacion ? <PlazoBadge plazo={plazoPresentacion} /> : null}
              </p>
              <p className="text-xs text-muted-foreground">Pendiente</p>
            </Hito>
          ) : null}
          {e.fecha_fin_ilt ? (
            <Hito punto="bg-green-600">
              <p className="text-sm font-medium">
                {e.motivo_cese_ilt ? MOTIVO_CESE_ILT_INFO[e.motivo_cese_ilt] : "Fin de la ILT"}:{" "}
                {formatoFecha(e.fecha_fin_ilt)}
              </p>
              <p className="text-xs text-muted-foreground">Cese de la incapacidad laboral temporaria</p>
            </Hito>
          ) : null}
          {presentaciones.map((p) => (
            <Hito key={p.id} punto="bg-amber-500">
              <p className="text-sm font-medium">Presentación del {formatoFecha(p.fecha)}</p>
              <p className="mt-0.5 text-sm whitespace-pre-line">{p.detalle}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.proxima_fecha ? `Próxima presentación fijada: ${formatoFecha(p.proxima_fecha)} · ` : ""}
                Registró {p.registrada_por_nombre ?? "—"} el {formatoFechaHora(p.registrada_en)}
              </p>
            </Hito>
          ))}
          {e.fecha_inicio_inasistencia ? (
            <Hito punto="bg-muted-foreground/60">
              <p className="text-sm font-medium">Inicio de la inasistencia: {formatoFecha(e.fecha_inicio_inasistencia)}</p>
              <p className="text-xs text-muted-foreground">Comienzo de la licencia por ILT</p>
            </Hito>
          ) : null}
        </LineaTiempo>
        {!presentaciones.length ? (
          <p className="mt-4 text-sm text-muted-foreground">Todavía no se registraron presentaciones.</p>
        ) : null}
      </Tarjeta>

      {conComisionMedica ? <ComisionMedica ficha={ficha} plazo={plazo("comision_medica")} /> : null}
    </div>
  );
}
