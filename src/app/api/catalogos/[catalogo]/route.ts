import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { buscarEnCatalogo, esCatalogo } from "@/lib/datos/catalogos";
import { usuarioActual } from "@/lib/sesion";

/** Búsqueda en un catálogo de la SRT para los combos con buscador. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ catalogo: string }> }) {
  if (!(await usuarioActual())) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const { catalogo } = await params;
  if (!esCatalogo(catalogo)) return NextResponse.json({ error: "Catálogo inexistente" }, { status: 404 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const opciones = await buscarEnCatalogo(await getDb(), catalogo, q, 30);
  return NextResponse.json(opciones);
}
