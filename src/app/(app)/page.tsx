import { redirect } from "next/navigation";
import { ROL_INFO } from "@/lib/dominio/constantes";
import { requerirUsuario } from "@/lib/sesion";

/** La portada lleva a la bandeja del rol elegido. */
export default async function Inicio() {
  const usuario = await requerirUsuario();
  redirect(ROL_INFO[usuario.rol].inicio);
}
