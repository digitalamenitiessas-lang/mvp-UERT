import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { descripcionDe } from "@/lib/datos/catalogos";
import { usuarioActual } from "@/lib/sesion";

/**
 * Nombre de una localidad por id. Lo usa el formulario de denuncia para
 * mostrar la localidad precargada de una persona ya registrada o de una
 * denuncia que se edita (la búsqueda de /api/catalogos busca por nombre o CP).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await usuarioActual())) return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  const { id } = await params;
  // Entero positivo que entra en un int de Postgres
  const numero = /^\d{1,9}$/.test(id) ? Number(id) : 0;
  if (numero <= 0) {
    return NextResponse.json({ error: "Localidad inválida" }, { status: 400 });
  }
  const nombre = await descripcionDe(await getDb(), "localidad", numero);
  if (!nombre) return NextResponse.json({ error: "Localidad inexistente" }, { status: 404 });
  return NextResponse.json({ codigo: String(numero), descripcion: nombre });
}
