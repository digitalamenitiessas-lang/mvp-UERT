"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRightIcon } from "lucide-react";
import { ingresar } from "@/app/acciones";
import { Spinner } from "@/components/ui/spinner";
import { ROL_INFO, type Rol } from "@/lib/dominio/constantes";
import { cn } from "@/lib/utils";

interface UsuarioDemo {
  id: number;
  nombre: string;
  rol: Rol;
}

/**
 * Tarjetas de /ingresar: una por rol. Mientras entra (y la bandeja se arma)
 * la elegida muestra «Entrando…» y las demás quedan deshabilitadas.
 */
export function TarjetasRol({ usuarios }: { usuarios: UsuarioDemo[] }) {
  const [elegido, setElegido] = useState<number | null>(null);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy={elegido !== null || undefined}>
      {usuarios.map((u) => (
        <form key={u.id} action={ingresar.bind(null, u.id)} onSubmit={() => setElegido(u.id)} className="flex">
          <TarjetaRol usuario={u} elegida={elegido === u.id} bloqueada={elegido !== null} />
        </form>
      ))}
    </div>
  );
}

function TarjetaRol({ usuario, elegida, bloqueada }: { usuario: UsuarioDemo; elegida: boolean; bloqueada: boolean }) {
  const { pending } = useFormStatus();
  const entrando = pending || elegida;
  const r = ROL_INFO[usuario.rol];
  return (
    <button
      type="submit"
      disabled={bloqueada || pending}
      aria-busy={entrando || undefined}
      className={cn(
        "group flex w-full flex-col gap-3 rounded-xl border bg-background p-4 text-left shadow-xs transition hover:border-primary/40 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default disabled:hover:border-border disabled:hover:shadow-xs",
        bloqueada && !entrando && "opacity-60",
        entrando && "border-primary/40",
      )}
    >
      <span className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", r.punto)} />
        <span className="font-medium">{r.nombre}</span>
        <span className="ml-auto text-xs text-muted-foreground">{r.submodulo}</span>
      </span>
      <span className="text-sm text-muted-foreground">{r.descripcion}</span>
      <span className="mt-auto flex items-center justify-between pt-1 text-sm">
        <span className="text-muted-foreground">{usuario.nombre}</span>
        {entrando ? (
          <span className="flex items-center gap-1.5 text-primary">
            <Spinner />
            Entrando…
          </span>
        ) : (
          <ArrowRightIcon className="size-4 text-primary transition group-hover:translate-x-0.5" aria-hidden />
        )}
      </span>
    </button>
  );
}
