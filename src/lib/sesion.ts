/**
 * Sesión de la demo: no hay login real. El usuario elige con quién entrar
 * (un usuario por rol) y queda en una cookie. En el sistema real esto se
 * reemplaza por usuarios con contraseña y permisos administrados.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/lib/db";
import { obtenerUsuario } from "@/lib/datos/usuarios";
import type { Ctx } from "@/lib/operaciones/contexto";
import type { Usuario } from "@/lib/tipos";

export const COOKIE_USUARIO = "uert_demo_usuario";

/** Usuario de la demo o null (memoizado por pedido). */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const valor = (await cookies()).get(COOKIE_USUARIO)?.value;
  if (!valor) return null;
  return obtenerUsuario(await getDb(), Number(valor));
});

/** Usuario de la demo; si no hay, manda a elegir uno. */
export async function requerirUsuario(): Promise<Usuario> {
  const usuario = await usuarioActual();
  if (!usuario) redirect("/ingresar");
  return usuario;
}

/** Contexto para las operaciones: base, usuario y hora actual. */
export async function contextoActual(): Promise<Ctx> {
  return { db: await getDb(), usuario: await requerirUsuario(), ahora: new Date() };
}
