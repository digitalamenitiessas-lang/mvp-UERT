import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { EstadoCitacionBadge } from "@/components/comun/badges";
import { BarraImpresion, Hoja, Membrete, PieDocumento } from "@/components/comun/documento";
import { getDb } from "@/lib/db";
import {
  MOTIVO_CITACION_INFO,
  TIPO_INFO,
  UERT,
  type EstadoCitacion,
  type MotivoCitacion,
  type TipoDenuncia,
} from "@/lib/dominio/constantes";
import { fechaDe, formatoFechaHora, formatoFechaLarga, formatoHora } from "@/lib/dominio/fechas";
import { formatoCuil } from "@/lib/dominio/validaciones";

interface CitacionImprimible {
  id: number;
  expediente_id: number;
  reiteracion_de: number | null;
  fecha_hora: Date;
  motivo: MotivoCitacion;
  lugar: string;
  detalle: string | null;
  estado: EstadoCitacion;
  notificada_en: Date;
  numero: string;
  tipo: TipoDenuncia;
  reparticion: string;
  apellido: string;
  nombres: string;
  cuil: string;
  email: string | null;
  creada_por_nombre: string | null;
  creada_por_cargo: string | null;
  original_fecha_hora: Date | null;
}

/** Una sola consulta por pedido, compartida por los metadatos y la página. */
const obtenerCitacion = cache(async (id: number): Promise<CitacionImprimible | null> => {
  const db = await getDb();
  const { rows } = await db.query<CitacionImprimible>(
    `select c.id, c.expediente_id, c.reiteracion_de, c.fecha_hora, c.motivo, c.lugar, c.detalle, c.estado, c.notificada_en,
            e.numero, e.tipo, e.reparticion, p.apellido, p.nombres, p.cuil, p.email,
            u.nombre as creada_por_nombre, u.cargo as creada_por_cargo,
            o.fecha_hora as original_fecha_hora
       from citaciones c
       join expedientes e on e.id = c.expediente_id
       join personas p on p.id = e.persona_id
       left join usuarios u on u.id = c.creada_por
       left join citaciones o on o.id = c.reiteracion_de
      where c.id = $1`,
    [id],
  );
  return rows[0] ?? null;
});

async function citacionDe(params: Promise<{ id: string }>): Promise<CitacionImprimible | null> {
  const { id } = await params;
  return /^\d{1,9}$/.test(id) ? obtenerCitacion(Number(id)) : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const c = await citacionDe(params);
  if (!c) return { title: "Citación" };
  return { title: `${c.reiteracion_de ? "Reiteración de citación" : "Citación"} ${c.numero}` };
}

/** "martes 24 de noviembre de 2026" → "24 de noviembre de 2026". */
const sinDiaDeSemana = (texto: string) => texto.replace(/^\S+\s/, "");
const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** Citación (o reiteración) para entregar o enviar al trabajador. */
export default async function ImprimirCitacion({ params }: { params: Promise<{ id: string }> }) {
  const c = await citacionDe(params);
  if (!c) notFound();
  const reiteracion = c.reiteracion_de !== null;
  const nombre = `${c.apellido}, ${c.nombres}`;

  return (
    <>
      <BarraImpresion expedienteId={c.expediente_id} textoBoton="Imprimir citación">
        {c.estado !== "programada" ? (
          <span className="flex items-center gap-1.5 text-sm text-zinc-600">
            Resultado registrado: <EstadoCitacionBadge estado={c.estado} />
          </span>
        ) : null}
      </BarraImpresion>
      <Hoja>
        <Membrete area="Área médica">
          <h1 className="text-xl font-semibold">{reiteracion ? "Reiteración de citación" : "Citación"}</h1>
          <p className="font-mono text-sm">Expte. N° {c.numero}</p>
          <p className="text-xs text-zinc-600">
            {TIPO_INFO[c.tipo].nombre}
            {reiteracion ? " · Por única vez (Anexo II pto. 3.3)" : ""}
          </p>
        </Membrete>

        <div className="flex flex-col gap-5">
          <p className="text-right">
            {UERT.provincia}, {sinDiaDeSemana(formatoFechaLarga(fechaDe(c.notificada_en)))}.
          </p>

          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[9rem_1fr]">
            <dt className="text-zinc-500">Trabajador/a</dt>
            <dd className="font-semibold">{nombre}</dd>
            <dt className="text-zinc-500">CUIL</dt>
            <dd className="font-mono">{formatoCuil(c.cuil)}</dd>
            <dt className="text-zinc-500">Repartición</dt>
            <dd>{c.reparticion}</dd>
          </dl>

          <p>
            {reiteracion ? (
              <>
                No habiendo concurrido a la citación del {formatoFechaHora(c.original_fecha_hora)}, se reitera por única
                vez la citación a <strong>{nombre}</strong>
              </>
            ) : (
              <>
                Se cita a <strong>{nombre}</strong>
              </>
            )}{" "}
            a presentarse en la fecha, hora y lugar que se indican a continuación, en el marco del expediente N° {c.numero}.
          </p>

          <dl className="divide-y divide-zinc-200 rounded-lg border border-zinc-300">
            <Fila etiqueta="Fecha">{mayuscula(formatoFechaLarga(fechaDe(c.fecha_hora)))}</Fila>
            <Fila etiqueta="Hora">{formatoHora(c.fecha_hora)} h</Fila>
            <Fila etiqueta="Lugar">{c.lugar}</Fila>
            <Fila etiqueta="Motivo">{MOTIVO_CITACION_INFO[c.motivo]}</Fila>
            {c.detalle ? <Fila etiqueta="Indicaciones">{c.detalle}</Fila> : null}
          </dl>

          {reiteracion ? (
            <div className="flex gap-3 rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm [print-color-adjust:exact]">
              <TriangleAlertIcon className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
              <p>
                <strong>Bajo apercibimiento de caducidad del trámite (Anexo II pto. 3.3).</strong> Si no concurre, la
                denuncia se tendrá por desistida. El desistimiento no constituye un rechazo: puede efectuar una nueva
                presentación.
              </p>
            </div>
          ) : null}

          <p>Deberá concurrir con su DNI.</p>

          <p className="text-zinc-600">
            Notificada por e-Servicios SRT y al email del formulario{c.email ? ` (${c.email})` : ""} el{" "}
            {formatoFechaHora(c.notificada_en)}.
          </p>
        </div>

        <div className="mt-10 flex break-inside-avoid justify-end">
          <div className="w-64 border-t border-zinc-900 pt-1.5 text-center text-xs leading-snug">
            <p className="font-semibold">{c.creada_por_nombre ?? "Área médica"}</p>
            <p>
              {c.creada_por_cargo ? `${c.creada_por_cargo} · ` : null}
              {UERT.sigla}
            </p>
          </div>
        </div>

        <PieDocumento>Expediente {c.numero} · Citación notificada el {formatoFechaHora(c.notificada_en)}.</PieDocumento>
      </Hoja>
    </>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 gap-y-0.5 px-4 py-3 sm:grid-cols-[8rem_1fr]">
      <dt className="text-sm text-zinc-500">{etiqueta}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
