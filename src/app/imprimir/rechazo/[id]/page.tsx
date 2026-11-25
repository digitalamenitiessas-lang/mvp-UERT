import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BarraImpresion } from "@/components/comun/documento";
import { HojaRechazo, rechazadosDe } from "@/components/legal/hoja-rechazo";
import { getDb } from "@/lib/db";
import { obtenerFicha } from "@/lib/datos/expedientes";

type Props = { params: Promise<{ id: string }> };

/** Id de expediente válido (entero positivo que entra en un int de Postgres). */
function idDe(valor: string): number | null {
  if (!/^\d{1,9}$/.test(valor)) return null;
  const n = Number(valor);
  return n > 0 ? n : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idDe((await params).id);
  if (!id) return { title: "Notificación de rechazo" };
  const { rows } = await (await getDb()).query<{ numero: string }>("select numero from expedientes where id = $1", [id]);
  // El título es también el nombre que sugiere el navegador al guardar como PDF
  return { title: rows[0] ? `Notificación de rechazo ${rows[0].numero}` : "Notificación de rechazo" };
}

/** Notificación de rechazo del expediente, para imprimir o guardar como PDF. */
export default async function NotificacionRechazo({ params }: Props) {
  const id = idDe((await params).id);
  if (!id) notFound();
  const ficha = await obtenerFicha(await getDb(), id);
  if (!ficha) notFound();

  return (
    <>
      <BarraImpresion
        expedienteId={ficha.expediente.id}
        textoBoton="Imprimir notificación"
        imprimible={rechazadosDe(ficha).length > 0}
      />
      <HojaRechazo ficha={ficha} />
    </>
  );
}
