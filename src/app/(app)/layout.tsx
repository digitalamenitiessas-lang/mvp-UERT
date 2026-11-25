import Link from "next/link";
import { FlaskConicalIcon, ShieldCheckIcon } from "lucide-react";
import { Buscador } from "@/components/app/buscador";
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
      <header className="no-imprimir sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <Link href={ROL_INFO[usuario.rol].inicio} className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <ShieldCheckIcon className="size-4.5" />
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold">UERT</span>
                <span className="block text-xs text-muted-foreground">Gestión de denuncias</span>
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden md:block">
                <Buscador />
              </div>
              <SelectorUsuario actual={usuario} usuarios={usuarios} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <Navegacion rol={usuario.rol} />
            <span className="hidden text-xs text-muted-foreground lg:block">
              {usuario.nombre} · {usuario.cargo}
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="no-imprimir border-t bg-background py-3 text-center text-xs text-muted-foreground">
        MVP · Unidad Ejecutora de Riesgos del Trabajo · Provincia de Santiago del Estero
      </footer>
    </div>
  );
}
