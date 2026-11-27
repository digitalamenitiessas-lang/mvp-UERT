"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ClipboardListIcon,
  FilePlus2Icon,
  FolderSearchIcon,
  GavelIcon,
  InboxIcon,
  LayoutDashboardIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  StethoscopeIcon,
} from "lucide-react";
import type { Rol } from "@/lib/dominio/constantes";
import { cn } from "@/lib/utils";

const ICONOS = {
  bandeja: InboxIcon,
  nueva: FilePlus2Icon,
  medica: StethoscopeIcon,
  legal: GavelIcon,
  seguimiento: ActivityIcon,
  tablero: LayoutDashboardIcon,
  expedientes: ClipboardListIcon,
  buscar: SearchIcon,
  srt: SendIcon,
  admin: SettingsIcon,
  todos: FolderSearchIcon,
};

type Enlace = { href: string; texto: string; icono: keyof typeof ICONOS };

export const MENU: Record<Rol, Enlace[]> = {
  mesa_entrada: [
    { href: "/mesa", texto: "Bandeja", icono: "bandeja" },
    { href: "/mesa/nueva", texto: "Nueva denuncia", icono: "nueva" },
    { href: "/expedientes", texto: "Expedientes", icono: "expedientes" },
    { href: "/buscar", texto: "Búsqueda unificada", icono: "buscar" },
    { href: "/srt", texto: "Comunicación SRT", icono: "srt" },
  ],
  medico: [
    { href: "/medica", texto: "Bandeja médica", icono: "medica" },
    { href: "/expedientes", texto: "Expedientes", icono: "expedientes" },
    { href: "/buscar", texto: "Búsqueda unificada", icono: "buscar" },
  ],
  legal: [
    { href: "/legal", texto: "Bandeja legal", icono: "legal" },
    { href: "/expedientes", texto: "Expedientes", icono: "expedientes" },
    { href: "/buscar", texto: "Búsqueda unificada", icono: "buscar" },
  ],
  seguimiento: [
    { href: "/seguimiento", texto: "Licencias", icono: "seguimiento" },
    { href: "/expedientes", texto: "Expedientes", icono: "expedientes" },
    { href: "/buscar", texto: "Búsqueda unificada", icono: "buscar" },
  ],
  direccion: [
    { href: "/direccion", texto: "Tablero", icono: "tablero" },
    { href: "/expedientes", texto: "Expedientes", icono: "expedientes" },
    { href: "/buscar", texto: "Búsqueda unificada", icono: "buscar" },
    { href: "/srt", texto: "Comunicación SRT", icono: "srt" },
  ],
  admin: [
    { href: "/admin", texto: "Administración", icono: "admin" },
    { href: "/expedientes", texto: "Expedientes", icono: "expedientes" },
    { href: "/buscar", texto: "Búsqueda unificada", icono: "buscar" },
    { href: "/srt", texto: "Comunicación SRT", icono: "srt" },
  ],
};

export function Navegacion({ rol }: { rol: Rol }) {
  const ruta = usePathname();
  const enlaces = MENU[rol];
  const activo = (href: string) =>
    ruta === href || (ruta.startsWith(href + "/") && !enlaces.some((e) => e.href !== href && e.href.startsWith(href) && ruta.startsWith(e.href)));
  return (
    <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones" data-recorrido="navegacion">
      {enlaces.map((e) => {
        const Icono = ICONOS[e.icono];
        return (
          <Link
            key={e.href}
            href={e.href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              activo(e.href) && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            <Icono className="size-4" />
            {e.texto}
          </Link>
        );
      })}
    </nav>
  );
}
