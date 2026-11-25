import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { MailCheckIcon } from "lucide-react";
import { BarraImpresion, Hoja, Membrete, PieDocumento } from "@/components/comun/documento";
import { getDb } from "@/lib/db";
import { obtenerFicha } from "@/lib/datos/expedientes";
import { CANAL_INFO, DENUNCIANTE_INFO, TIPO_INFO, UERT } from "@/lib/dominio/constantes";
import { documentosFaltantes, nombreDocumento } from "@/lib/dominio/documentos";
import { fechaDe, formatoFechaHora, formatoFechaLarga, formatoHora } from "@/lib/dominio/fechas";
import { numeroSiniestroSRT } from "@/lib/dominio/numeracion";
import { formatoCuil, formatoDni } from "@/lib/dominio/validaciones";
import { formatoTamano } from "@/lib/formato";

type Props = { params: Promise<{ id: string }> };

function idDe(valor: string): number | null {
  if (!/^\d{1,9}$/.test(valor)) return null;
  const n = Number(valor);
  return n > 0 ? n : null;
}

const cargarFicha = cache(async (id: number) => obtenerFicha(await getDb(), id));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idDe((await params).id);
  const ficha = id ? await cargarFicha(id) : null;
  // El título es también el nombre que propone el navegador al guardar como PDF
  return { title: ficha ? `Constancia de recepción ${ficha.expediente.numero}` : "Constancia de recepción" };
}

function Fila({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[11rem_1fr] gap-3 border-b border-zinc-200 py-1.5 last:border-b-0 print:grid-cols-[10rem_1fr]">
      <dt className="text-zinc-500">{etiqueta}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Titulo({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-600 uppercase">{children}</h2>;
}

/** Constancia de recepción de la denuncia, para imprimir o guardar como PDF. */
export default async function ConstanciaRecepcion({ params }: Props) {
  const id = idDe((await params).id);
  if (!id) notFound();
  const ficha = await cargarFicha(id);
  if (!ficha) notFound();

  const e = ficha.expediente;
  const p = ficha.persona;
  const esEP = e.tipo === "EP";
  const fecha = fechaDe(e.recibido_en);
  const invocados = ficha.diagnosticos.filter((d) => d.origen === "denuncia");
  const recibidos = ficha.documentos.filter((d) => d.etapa === "recepcion");
  const pendientes =
    e.es_reingreso || e.es_intercurrencia ? [] : documentosFaltantes(e.tipo, recibidos.map((d) => d.tipo));
  const destinatarios = [
    e.denunciante_tipo !== "trabajador" && e.denunciante_email ? `${e.denunciante_email} (denunciante)` : null,
    p.email ? `${p.email} (trabajador)` : null,
  ].filter(Boolean);
  const generada = new Date();

  return (
    <>
      <BarraImpresion expedienteId={e.id} textoBoton="Imprimir constancia" />
      <Hoja>
        <Membrete area="Mesa de entrada">
          <h1 className="text-xl font-semibold">Constancia de recepción</h1>
          <p className="text-xs text-zinc-600">Denuncia de {TIPO_INFO[e.tipo].nombre.toLowerCase()}</p>
          {esEP ? <p className="text-xs text-zinc-600">Res. SRT de Enfermedades Profesionales, art. 3</p> : null}
        </Membrete>

        <section className="grid gap-4 rounded-lg border-2 border-zinc-900 p-4 sm:grid-cols-2 print:grid-cols-2">
          <div>
            <p className="text-xs text-zinc-600">N° de denuncia (número de siniestro)</p>
            <p className="font-mono text-2xl font-bold tracking-tight">{e.numero}</p>
            <p className="text-xs text-zinc-600">
              Para la SRT: <span className="font-mono">{numeroSiniestroSRT(e.anio, e.contador, e.sufijo)}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-600">Fecha y hora de presentación</p>
            <p className="text-lg font-semibold">{formatoFechaHora(e.recibido_en)} h</p>
            <p className="text-xs text-zinc-600 first-letter:uppercase">{formatoFechaLarga(fecha)}</p>
          </div>
        </section>

        <p className="text-justify">
          Se deja constancia de que el {formatoFechaLarga(fecha)}, a las {formatoHora(e.recibido_en)} h, la{" "}
          {UERT.nombre} recibió por canal {CANAL_INFO[e.canal].toLowerCase()} la denuncia de{" "}
          <strong>{TIPO_INFO[e.tipo].nombre.toLowerCase()}</strong>
          {e.es_reingreso ? " (reingreso)" : e.es_intercurrencia ? " (intercurrencia)" : ""} de{" "}
          <strong>
            {p.apellido}, {p.nombres}
          </strong>
          , CUIL {formatoCuil(p.cuil)}, que presta servicios en {e.reparticion}. La denuncia quedó registrada con el
          número {e.numero}.
        </p>

        <section>
          <Titulo>Datos de la denuncia</Titulo>
          <dl>
            <Fila etiqueta="Tipo de denuncia">{TIPO_INFO[e.tipo].nombre}</Fila>
            <Fila etiqueta="Canal">{CANAL_INFO[e.canal]}</Fila>
            <Fila etiqueta="Denunciante">
              {DENUNCIANTE_INFO[e.denunciante_tipo]}
              {e.denunciante_tipo !== "trabajador" && e.denunciante_nombre ? ` · ${e.denunciante_nombre}` : ""}
            </Fila>
            <Fila etiqueta="Trabajador/a">
              {p.apellido}, {p.nombres}
            </Fila>
            <Fila etiqueta="CUIL / DNI">
              <span className="font-mono">{formatoCuil(p.cuil)}</span> · DNI{" "}
              <span className="font-mono">{formatoDni(p.dni)}</span>
            </Fila>
            <Fila etiqueta="Empleador">
              Provincia de {UERT.provincia} (CUIT {formatoCuil(e.cuit_empleador)}) · {e.reparticion}
            </Fila>
            <Fila etiqueta="Recibió">{ficha.recibido_por_nombre ?? "Mesa de entrada"}</Fila>
          </dl>
        </section>

        <section>
          <Titulo>Diagnósticos invocados</Titulo>
          {invocados.length ? (
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {invocados.map((d) => (
                <li key={d.id}>
                  <span className="font-mono font-semibold">{d.cie10}</span> {d.cie10_descripcion}
                  {esEP && d.agente_causante ? (
                    <span className="block text-zinc-600">
                      Agente causante: <span className="font-mono">{d.agente_causante}</span>{" "}
                      {d.agente_descripcion ?? ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-zinc-600">
              No se invocaron diagnósticos al presentar la denuncia: los define el área médica de la UERT.
            </p>
          )}
        </section>

        <section>
          <Titulo>Documentación recibida</Titulo>
          {recibidos.length ? (
            <ol className="flex list-decimal flex-col gap-1 pl-5">
              {recibidos.map((d) => (
                <li key={d.id}>
                  {nombreDocumento(d.tipo)}
                  {d.nombre_archivo ? (
                    <span className="text-zinc-600">
                      {" "}
                      · {d.nombre_archivo}
                      {d.tamano_bytes !== null ? ` (${formatoTamano(d.tamano_bytes)})` : ""}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-zinc-600">No se recibió documentación con la denuncia.</p>
          )}
          {pendientes.length ? (
            <div className="mt-3 rounded-md border border-zinc-400 border-dashed px-3 py-2">
              <p className="font-medium">Documentación obligatoria pendiente de presentar</p>
              <ul className="list-disc pl-5 text-zinc-700">
                {pendientes.map((d) => (
                  <li key={d.clave}>{d.nombre}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="flex flex-wrap items-start gap-2 rounded-md bg-zinc-100 px-3 py-2.5 print:bg-transparent print:px-0">
          <MailCheckIcon className="mt-0.5 size-4 shrink-0 text-zinc-600" aria-hidden />
          <p className="min-w-0 flex-1">
            La constancia se envió al denunciante y al trabajador por correo electrónico
            {destinatarios.length ? `: ${destinatarios.join(" y ")}` : ""}.
          </p>
        </section>

        <section className="mt-6 grid gap-10 sm:grid-cols-2 print:mt-12 print:grid-cols-2">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-28 w-44 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-xs text-zinc-400">
              Sello
            </div>
            <p className="text-xs text-zinc-600">Sello de la Mesa de entrada · {UERT.sigla}</p>
          </div>
          <div className="flex flex-col justify-end gap-1 pt-16 text-center">
            <div className="border-t border-zinc-900" />
            <p className="text-xs">Firma y aclaración de quien recibe</p>
            <p className="text-xs text-zinc-600">{ficha.recibido_por_nombre ?? "Mesa de entrada"}</p>
          </div>
        </section>

        <PieDocumento>
          Constancia generada el {formatoFechaHora(generada)} por el sistema de gestión de denuncias de la{" "}
          {UERT.sigla}.
        </PieDocumento>
      </Hoja>
    </>
  );
}
