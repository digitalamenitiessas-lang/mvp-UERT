import type { Metadata } from "next";
import { FlaskConicalIcon } from "lucide-react";
import { Marca, PieSDE } from "@/components/app/marca";
import { TarjetasRol } from "@/components/app/tarjetas-rol";
import { getDb } from "@/lib/db";
import { listarUsuarios } from "@/lib/datos/usuarios";

export const metadata: Metadata = { title: "Ingresar" };

// Lee los usuarios de la base en cada pedido. Sin esto Next la pre-renderiza
// en el build (no usa cookies), cuando en la VPS la base todavía no tiene las
// tablas: las migraciones corren después de compilar.
export const dynamic = "force-dynamic";

/** Elegir con qué rol entrar. No hay contraseñas: es una demo con datos ficticios. */
export default async function Ingresar() {
  const usuarios = await listarUsuarios(await getDb());
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-3">
          <Marca sobre="azul" />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-4 py-10">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold tracking-wide text-primary uppercase">
            Unidad Ejecutora de Riesgos del Trabajo
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Gestión de denuncias</h1>
          <p className="max-w-3xl text-muted-foreground">
            Recorré el circuito completo de una denuncia —de la Mesa de entrada al alta— entrando con cada rol. Incluye
            la nueva denuncia de Enfermedad Profesional (FODEP) y la comunicación con la SRT.
          </p>
          <p className="flex items-center gap-2 text-sm text-amber-800">
            <FlaskConicalIcon className="size-4" />
            Demostración: los datos son ficticios y las comunicaciones con la SRT, simuladas.
          </p>
        </div>
        <TarjetasRol usuarios={usuarios.map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol }))} />
        <p className="text-xs text-muted-foreground">
          Una vez adentro podés cambiar de rol en cualquier momento desde el selector “Viendo como”, arriba a la
          derecha.
        </p>
      </main>
      <PieSDE ancho="max-w-5xl" />
    </div>
  );
}
