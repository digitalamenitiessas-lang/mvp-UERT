"use client";

import { useTransition } from "react";
import { usePathname } from "next/navigation";
import { CheckIcon, ChevronsUpDownIcon, LogOutIcon, RefreshCwIcon } from "lucide-react";
import { cambiarUsuario, salir } from "@/app/acciones";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import { ROL_INFO } from "@/lib/dominio/constantes";
import type { Usuario } from "@/lib/tipos";
import { cn } from "@/lib/utils";

/** Ruta actual con su búsqueda o solapa (?tab=…), sin el aviso de denuncia recién cargada. */
function rutaParaVolver(ruta: string): string {
  const parametros = new URLSearchParams(window.location.search);
  parametros.delete("nueva");
  const consulta = parametros.toString();
  return consulta ? `${ruta}?${consulta}` : ruta;
}

/**
 * "Ver como": cambia de usuario (y de rol) en un clic. Es el corazón de la demo.
 * En la ficha, el listado o la búsqueda se queda en la misma pantalla (con su
 * solapa o su búsqueda); en una bandeja va a la del rol nuevo.
 */
export function SelectorUsuario({ actual, usuarios }: { actual: Usuario; usuarios: Usuario[] }) {
  const [pendiente, iniciar] = useTransition();
  const ruta = usePathname();
  const info = ROL_INFO[actual.rol];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-auto gap-2 py-1.5 pr-2 pl-2.5" disabled={pendiente}>
          {pendiente ? <Spinner /> : <span className={cn("size-2.5 rounded-full", info.punto)} />}
          <span className="flex flex-col items-start leading-tight">
            <span className="text-xs text-muted-foreground">Viendo como</span>
            <span className="text-sm font-medium">{info.nombre}</span>
          </span>
          <ChevronsUpDownIcon className="ml-1 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
          <RefreshCwIcon className="size-3.5" />
          Cambiá de rol para ver qué hace cada área
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {usuarios.map((u) => {
            const r = ROL_INFO[u.rol];
            return (
              <DropdownMenuItem
                key={u.id}
                className="items-start gap-2.5 py-2"
                onSelect={() => iniciar(() => cambiarUsuario(u.id, rutaParaVolver(ruta)))}
              >
                <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", r.punto)} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{r.nombre}</span>
                  <span className="text-xs text-muted-foreground">
                    {u.nombre} · {r.submodulo}
                  </span>
                </span>
                {u.id === actual.id ? <CheckIcon className="mt-1 size-4" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => iniciar(() => salir())}>
          <LogOutIcon />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
