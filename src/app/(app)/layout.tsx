import Link from "next/link";
import { FlaskConicalIcon } from "lucide-react";
import { Buscador } from "@/components/app/buscador";
import { Marca, PieSDE } from "@/components/app/marca";
import { Navegacion } from "@/components/app/navegacion";
import { SelectorUsuario } from "@/components/app/selector-usuario";
import { getDb } from "@/lib/db";
import { listarUsuarios } from "@/lib/datos/usuarios";
import { ROL_INFO } from "@/lib/dominio/constantes";
import { formatoFechaLarga, hoy } from "@/lib/dominio/fechas";
import { requerirUsuario } from "@/lib/sesion";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();
  const usuarios = await listarUsuarios(await getDb());
  return (
    <div className="flex min-h-screen flex-col">
      <div className="no-imprimir flex items-center justify-center gap-2 bg-amber-100 px-4 py-1 text-center text-xs text-amber-900">
        <FlaskConicalIcon className="size-3.5" />
        Demostración con datos ficticios · Las comunicaciones con la SRT son simuladas · Hoy es {formatoFechaLarga(hoy())}
      </div>
      {/* Barra institucional azul con el logo de la Provincia, como en sde.gob.ar; debajo, las secciones. */}
      <header className="no-imprimir sticky top-0 z-30 shadow-sm">
        <div className="bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5">
            <Link
              href={ROL_INFO[usuario.rol].inicio}
              aria-label="UERT · Ir al inicio"
              className="rounded-sm focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
            >
              <Marca sobre="azul" compactaEnMovil />
            </Link>
            {/* El buscador y el selector son blancos: que no hereden el texto blanco de la barra. */}
            <div className="ml-auto flex items-center gap-2 text-foreground">
              <div className="hidden md:block">
                <Buscador />
              </div>
              <SelectorUsuario actual={usuario} usuarios={usuarios} />
            </div>
          </div>
        </div>
        <div className="border-b bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5">
            <Navegacion rol={usuario.rol} />
            <span className="hidden text-xs text-muted-foreground lg:block">
              {usuario.nombre} · {usuario.cargo}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <PieSDE />
    </div>
  );
}
