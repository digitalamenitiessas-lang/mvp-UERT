import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { obtenerLote } from "@/lib/datos/srt";
import { usuarioActual } from "@/lib/sesion";

/** Descarga un archivo (.AD, .AL o .AZ) de un lote del Sistema de Intercambio. */
export async function GET(_request: Request, { params }: { params: Promise<{ lote: string; extension: string }> }) {
  if (!(await usuarioActual())) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const { lote: id, extension } = await params;
  // Entero positivo que entra en un int de Postgres; si no, el lote no existe
  if (!/^\d{1,9}$/.test(id)) return NextResponse.json({ error: "No existe" }, { status: 404 });
  const lote = await obtenerLote(await getDb(), Number(id));
  const archivo = lote?.archivos.find((a) => a.extension === extension.toUpperCase());
  if (!archivo) return NextResponse.json({ error: "No existe" }, { status: 404 });
  return new NextResponse(archivo.contenido, {
    headers: {
      "Content-Type": "text/plain; charset=us-ascii",
      "Content-Disposition": `attachment; filename="${archivo.nombre}"`,
    },
  });
}
