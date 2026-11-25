import { FileWarningIcon, InfoIcon } from "lucide-react";
import { Hoja, Membrete, PieDocumento } from "@/components/comun/documento";
import type { ExpedienteFicha } from "@/lib/datos/expedientes";
import { MOTIVO_RECHAZO_INFO, TIPO_INFO, UERT, type MotivoRechazo } from "@/lib/dominio/constantes";
import { fechaDe, formatoFecha, formatoFechaHora, formatoFechaLarga, hoy } from "@/lib/dominio/fechas";
import { formatoCuil, formatoDni } from "@/lib/dominio/validaciones";
import type { DiagnosticoDetalle } from "@/lib/tipos";

/** Diagnósticos rechazados (con motivo) que van en la notificación. */
export function rechazadosDe(ficha: ExpedienteFicha): DiagnosticoDetalle[] {
  return ficha.diagnosticos.filter((d) => d.estado === "rechazado" && d.motivo_rechazo);
}

/**
 * La causal tal como se le explica al trabajador: la primera oración del
 * detalle (lo que sigue son indicaciones internas, que acá se reemplazan por
 * el párrafo propio de cada motivo).
 */
function causal(motivo: MotivoRechazo): string {
  const detalle = MOTIVO_RECHAZO_INFO[motivo].detalle;
  // Hasta el primer punto seguido de una oración nueva ("art. 6°" o "24.557" no cortan)
  return detalle.match(/^.*?\.(?=\s+[A-ZÁÉÍÓÚÑ]|$)/)?.[0] ?? detalle;
}

function adecuacion(d: DiagnosticoDetalle): string {
  if (!d.cie10_adecuado || d.cie10_adecuado === d.cie10) return "Se mantiene el código invocado.";
  return `${d.cie10_adecuado} – ${d.cie10_adecuado_descripcion ?? ""}`.trim();
}

/**
 * Hoja de la notificación de rechazo (estilo carta documento): membrete,
 * lugar y fecha, destinatario, referencia, cada diagnóstico rechazado con su
 * causal y fundamento, los aceptados y el pie con el envío (simulado).
 */
export function HojaRechazo({ ficha }: { ficha: ExpedienteFicha }) {
  const { expediente: exp, persona } = ficha;
  const rechazados = rechazadosDe(ficha);
  const aceptados = ficha.diagnosticos.filter((d) => d.estado === "aceptado");

  if (!rechazados.length) {
    return (
      <Hoja>
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-zinc-300 p-10 text-center">
          <FileWarningIcon className="size-8 text-zinc-400" aria-hidden />
          <h1 className="text-lg font-semibold">No hay nada que notificar</h1>
          <p className="max-w-md text-sm text-zinc-600">
            El expediente <span className="font-mono">{exp.numero}</span> no tiene diagnósticos rechazados, así que no
            corresponde emitir una notificación de rechazo.
          </p>
        </div>
      </Hoja>
    );
  }

  const borrador = exp.estado === "dictamen_legal";
  // Fecha y firmante: los de la notificación emitida al cerrar el dictamen (o los de la última decisión)
  const emitida = borrador ? undefined : ficha.movimientos.find((m) => m.accion === "notificacion_rechazo");
  const decision = ficha.movimientos.find((m) => m.accion === "decision");
  const fecha = emitida ? fechaDe(new Date(emitida.fecha)) : hoy();
  const firmante = emitida?.usuario_nombre ?? decision?.usuario_nombre ?? null;
  const notificado = persona.sexo === "F" ? "notificada" : persona.sexo === "M" ? "notificado" : "notificado/a";

  return (
    <Hoja className="gap-0">
      {borrador ? (
        <div className="mb-6 flex items-start gap-2 border-2 border-dashed border-zinc-400 px-3 py-2 text-xs text-zinc-700">
          <InfoIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="tracking-wide uppercase">Borrador.</strong> El dictamen todavía no se cerró: la
            notificación se emite y se envía al cerrarlo, con las decisiones que estén firmes en ese momento.
          </span>
        </div>
      ) : null}

      <Membrete area="Área legal">
        <h1 className="text-xl font-semibold">Notificación de rechazo</h1>
        <p className="font-mono text-sm">Expte. N° {exp.numero}</p>
        {exp.tipo === "EP" && exp.fodep_numero ? (
          <p className="text-xs text-zinc-600">Formulario FODEP N° {exp.fodep_numero}</p>
        ) : null}
      </Membrete>

      <p className="mt-5 text-right">
        {UERT.provincia}, {formatoFechaLarga(fecha)}
      </p>

      {/* Destinatario y remitente */}
      <section
        className="mt-5 grid border border-zinc-900 sm:grid-cols-2 print:grid-cols-2"
        aria-label="Destinatario y remitente"
      >
        <div className="border-b border-zinc-900 p-3 sm:border-r sm:border-b-0 print:border-r print:border-b-0">
          <div className="text-[10.5px] font-bold tracking-widest uppercase">Destinatario/a</div>
          <div className="mt-1 font-semibold">
            {persona.apellido.toUpperCase()}, {persona.nombres}
          </div>
          <div>
            CUIL {formatoCuil(persona.cuil)} · DNI {formatoDni(persona.dni)}
          </div>
          <div>
            {persona.domicilio ?? "Domicilio no informado"}
            {persona.localidad ? `, ${persona.localidad}` : ""}
          </div>
          {persona.email ? <div className="break-all">{persona.email}</div> : null}
        </div>
        <div className="p-3">
          <div className="text-[10.5px] font-bold tracking-widest uppercase">Remitente</div>
          <div className="mt-1 font-semibold">
            {UERT.nombre} ({UERT.sigla})
          </div>
          <div>Área legal</div>
          <div>Provincia de {UERT.provincia}</div>
        </div>
      </section>

      {/* Referencia */}
      <section className="mt-3 border border-zinc-900 p-3" aria-label="Referencia">
        <div className="text-[10.5px] font-bold tracking-widest uppercase">Referencia</div>
        <dl className="mt-1 grid gap-x-6 gap-y-0.5 sm:grid-cols-2 print:grid-cols-2">
          <Renglon etiqueta="Expediente">
            <span className="font-mono">{exp.numero}</span>
          </Renglon>
          <Renglon etiqueta="Tipo de denuncia">{TIPO_INFO[exp.tipo].nombre}</Renglon>
          <Renglon etiqueta="Denuncia recibida">{formatoFecha(fechaDe(new Date(exp.recibido_en)))}</Renglon>
          <Renglon etiqueta={exp.tipo === "EP" ? "Primera manifestación" : "Fecha del accidente"}>
            {formatoFecha(exp.fecha_ocurrencia)}
          </Renglon>
          <Renglon etiqueta="Repartición" className="sm:col-span-2 print:col-span-2">
            {exp.reparticion}
          </Renglon>
        </dl>
      </section>

      {/* Cuerpo */}
      <div className="mt-6 space-y-3 text-justify">
        <p>De nuestra consideración:</p>
        <p>
          Por la presente, la {UERT.nombre} de la Provincia de {UERT.provincia} le notifica que, analizada la denuncia
          del expediente de referencia y la evaluación del área médica, se resolvió <strong>RECHAZAR</strong>{" "}
          {rechazados.length > 1 ? "los siguientes diagnósticos" : "el siguiente diagnóstico"}, por la causal y los
          fundamentos que se detallan:
        </p>
      </div>

      <ol className="mt-4 space-y-4">
        {rechazados.map((d, i) => {
          const motivo = d.motivo_rechazo as MotivoRechazo;
          const info = MOTIVO_RECHAZO_INFO[motivo];
          return (
            <li key={d.id} className="break-inside-avoid border-l-2 border-zinc-900 pl-4">
              <div className="font-semibold">
                {i + 1}. Diagnóstico invocado: <span className="font-mono">{d.cie10}</span> – {d.cie10_descripcion}
              </div>
              <dl className="mt-1.5 space-y-1">
                <Renglon etiqueta="Adecuación CIE-10">{adecuacion(d)}</Renglon>
                {exp.tipo === "EP" && d.agente_causante ? (
                  <Renglon etiqueta="Agente de riesgo invocado">
                    {d.agente_causante}
                    {d.agente_descripcion ? ` – ${d.agente_descripcion}` : ""}
                  </Renglon>
                ) : null}
                <Renglon etiqueta="Causal">
                  <strong>
                    {motivo}) {info.nombre}.
                  </strong>{" "}
                  {causal(motivo)}
                </Renglon>
                <Renglon etiqueta="Fundamento">
                  <span className="whitespace-pre-line">{d.fundamento ?? "—"}</span>
                </Renglon>
                {motivo === "P" ? (
                  <Renglon etiqueta="Estudios en que se basa (Anexo III, estudios mínimos)">
                    <span className="whitespace-pre-line">{d.estudios ?? "—"}</span>
                  </Renglon>
                ) : null}
              </dl>
              {motivo === "E" ? (
                <p className="mt-1.5">Se acompaña copia íntegra del relevamiento CYMAT (Anexo II pto. 5.1.a).</p>
              ) : null}
              {motivo === "L" ? (
                <p className="mt-1.5">
                  Por tratarse de una patología no incluida en el Listado de Enfermedades Profesionales, usted puede
                  instar el trámite ante la {UERT.comisionMedica.nombre}, con domicilio en {UERT.comisionMedica.direccion}.
                </p>
              ) : null}
              {motivo === "D" && ficha.origen ? (
                <p className="mt-1.5">
                  Se ratifica el alta otorgada en el expediente <span className="font-mono">{ficha.origen.numero}</span>.
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>

      {aceptados.length ? (
        <div className="mt-5 space-y-2 text-justify">
          <p>
            Asimismo, se le hace saber que se <strong>ACEPTÓ</strong> el carácter laboral{" "}
            {aceptados.length > 1 ? "de los siguientes diagnósticos" : "del siguiente diagnóstico"}
            {exp.con_baja === null ? "" : exp.con_baja ? ", con baja laboral" : ", sin baja laboral"}:
          </p>
          <ul className="list-disc space-y-0.5 pl-6">
            {aceptados.map((d) => (
              <li key={d.id}>
                <span className="font-mono">{d.cie10_adecuado ?? d.cie10}</span> –{" "}
                {d.cie10_adecuado ? (d.cie10_adecuado_descripcion ?? d.cie10_descripcion) : d.cie10_descripcion}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-6">Queda usted debidamente {notificado}.</p>

      {/* Firma */}
      <div className="mt-16 flex break-inside-avoid justify-end">
        <div className="w-64 border-t border-zinc-900 pt-1.5 text-center text-xs leading-snug">
          {firmante ? <div className="font-semibold">{firmante}</div> : null}
          <div>Área legal</div>
          <div>
            {UERT.nombre} ({UERT.sigla})
          </div>
        </div>
      </div>

      <div className="mt-10">
        <PieDocumento>
          Notificación cursada por e-Servicios SRT (CUIL {formatoCuil(persona.cuil)})
          {persona.email ? ` y por correo electrónico a ${persona.email}` : ""}, conforme al Anexo II pto. 1.6. Expediente{" "}
          {exp.numero} · {emitida ? `Emitida el ${formatoFechaHora(emitida.fecha)}` : "Borrador sin emitir"}.
        </PieDocumento>
      </div>
    </Hoja>
  );
}

function Renglon({ etiqueta, children, className }: { etiqueta: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="inline text-zinc-600">{etiqueta}: </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}
